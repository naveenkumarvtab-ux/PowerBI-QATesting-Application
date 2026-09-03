import os
import json
import re
import uuid
import datetime
from threading import Thread
from flask import Blueprint, request, jsonify, current_app, g
from backend.auth import require_auth
from backend.config import Config
from backend.models.job import Job, RuleViolation
from backend.core.powerbi_auth import PowerBIAuthService
from backend.core.powerbi_api_client import PowerBIAPIClient
from backend.core.naming_rules import NamingRulesEngine
from backend.core.dax_analyzer import DaxAnalyzer
from backend.core.mquery_analyzer import MQueryAnalyzer
from backend.core.functional_tests import PlaywrightFunctionalTester
from backend.core.export_tests import ExportTester
from backend.core.report_builder import ReportBuilder
from backend.core.pbix_parser import PBIXParser

service_bp = Blueprint('service', __name__)
auth_service = PowerBIAuthService()

# Global memory cache for user tokens
USER_TOKENS = {}

def extract_ids_from_url(url):
    """
    Parses Power BI URL and extracts workspace_id and report_id.
    Standard format: https://app.powerbi.com/groups/{workspace_id}/reports/{report_id}/...
    Personal workspace: https://app.powerbi.com/groups/me/reports/{report_id}
    """
    workspace_id = "me"
    report_id = None
    
    # Extract report ID
    report_match = re.search(r"reports/([a-f0-9\-]{36})", url, re.IGNORECASE)
    if report_match:
        report_id = report_match.group(1)
        
    # Extract workspace ID
    group_match = re.search(r"groups/([a-f0-9\-]{36})", url, re.IGNORECASE)
    if group_match:
        workspace_id = group_match.group(1)
        
    return workspace_id, report_id

def run_service_analysis_job(job_id, report_url, checks, auth_token, app_context):
    """
    Background thread running service tests: Naming, Functional, PDF Export, Excel Export.
    Each check runs independently and appends violations.
    """
    app_context.push()
    session = current_app.db_session_factory()
    
    try:
        # Get Job DB entry
        job = session.query(Job).filter(Job.id == job_id).first()
        job.status = "running"
        job.progress = 10
        job.current_step = "Resolving Workspace and Report references..."
        session.commit()

        workspace_id, report_id = extract_ids_from_url(report_url)
        if not report_id and not Config.MOCK_SERVICE:
            raise ValueError(f"Could not parse a valid Report UUID from the URL: {report_url}")
            
        # Initialize API client
        api_client = PowerBIAPIClient(auth_token)
        
        violations_to_insert = []
        progress_per_step = 80 // max(1, len(checks))
        current_progress = 10

        # Step 1: Naming & Metadata Checks
        if "naming" in checks:
            current_progress += 5
            job.progress = current_progress
            job.current_step = "Fetching report layout and metadata from Power BI Service..."
            session.commit()
            
            try:
                # 1. Fetch report details
                report_meta = {}
                dataset_id = None
                try:
                    report_meta = api_client.get_report(workspace_id, report_id)
                    dataset_id = report_meta.get("datasetId")
                    rep_name = report_meta.get("name")
                    if rep_name:
                        job.current_step = f"Analyzing Power BI Report: '{rep_name}'..."
                        session.commit()
                except Exception as re:
                    print(f"Failed to fetch report metadata: {re}")

                # Check Dataset Refresh History via Power BI REST API
                if dataset_id:
                    try:
                        refresh_data = api_client.get_dataset_refreshes(workspace_id, dataset_id, top=1)
                        if refresh_data and "value" in refresh_data and len(refresh_data["value"]) > 0:
                            latest_ref = refresh_data["value"][0]
                            ref_status = latest_ref.get("status", "Unknown")
                            ref_end = latest_ref.get("endTime") or latest_ref.get("startTime") or "Recent"
                            ref_type = latest_ref.get("refreshType", "Scheduled")
                            
                            if ref_status == "Completed":
                                violations_to_insert.append(RuleViolation(
                                    job_id=job_id, category="dataset_refresh",
                                    target=f"Dataset Refresh Status ({ref_type})",
                                    status="pass",
                                    message=f"Latest dataset refresh succeeded on {ref_end}.",
                                    suggested_fix=""
                                ))
                            elif ref_status == "Failed":
                                err_info = latest_ref.get("serviceExceptionJson") or "Refresh job failed on Power BI Service."
                                violations_to_insert.append(RuleViolation(
                                    job_id=job_id, category="dataset_refresh",
                                    target=f"Dataset Refresh Status ({ref_type})",
                                    status="fail",
                                    message=f"Dataset refresh failed on {ref_end}: {err_info[:200]}",
                                    suggested_fix="Review scheduled refresh settings and credentials in Power BI Service workspace."
                                ))
                            else:
                                violations_to_insert.append(RuleViolation(
                                    job_id=job_id, category="dataset_refresh",
                                    target=f"Dataset Refresh Status ({ref_type})",
                                    status="warning",
                                    message=f"Dataset refresh status: {ref_status} (Started: {ref_end}).",
                                    suggested_fix="Check if a refresh job is currently in progress."
                                ))
                        else:
                            violations_to_insert.append(RuleViolation(
                                job_id=job_id, category="dataset_refresh",
                                target="Dataset Refresh Status",
                                status="pass",
                                message="Dataset is live-connected or no recent refresh failure recorded.",
                                suggested_fix=""
                            ))
                    except Exception as rfe:
                        print(f"Dataset refresh check notice: {rfe}")

                # 2. Download PBIX from Service for full deep analysis
                pbix_file = None
                if Config.MOCK_SERVICE:
                    uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "storage", "uploads")
                    import glob
                    pbix_files = glob.glob(os.path.join(uploads_dir, "*.pbix"))
                    if pbix_files:
                        pbix_files.sort(key=os.path.getmtime, reverse=True)
                        pbix_file = pbix_files[0]
                else:
                    try:
                        pbix_file = api_client.download_report_pbix(workspace_id, report_id)
                    except Exception as de:
                        print(f"Failed to download report PBIX from service: {de}")

                # 3. Parse PBIX file if available
                parsed_meta = {}
                layout_str = None
                if pbix_file:
                    try:
                        parser = PBIXParser(pbix_file)
                        parsed_meta = parser.parse()
                        layout_str = parsed_meta.get("layout_str")
                        job.layout_str = layout_str
                        if parsed_meta.get("excluded_counts"):
                            job.excluded_counts_str = json.dumps(parsed_meta.get("excluded_counts"))
                    except Exception as pe:
                        print(f"Failed to parse PBIX layout: {pe}")

                # 4. Supplemental DMV schema query (if PBIX did not contain measures or failed)
                dmv_meta = {}
                if (not parsed_meta.get("dax_measures") or not parsed_meta.get("m_queries")) and dataset_id:
                    try:
                        dmv_meta = api_client.query_dataset_metadata(dataset_id)
                    except Exception as dmve:
                        print(f"DMV query fallback notice: {dmve}")

                # 5. Combined metadata (PBIX extracted data takes priority)
                m_queries = parsed_meta.get("m_queries") or dmv_meta.get("m_queries") or {}
                dax_measures = parsed_meta.get("dax_measures") or dmv_meta.get("dax_measures") or {}
                dax_columns = parsed_meta.get("dax_columns") or dmv_meta.get("dax_columns") or {}

                dax_anal = DaxAnalyzer()
                m_anal = MQueryAnalyzer()

                # Analyze Power Query Step Naming
                for qname, m_code in m_queries.items():
                    res = m_anal.analyze_query(qname, m_code)
                    for r in res:
                        violations_to_insert.append(RuleViolation(
                            job_id=job_id, category=r["category"], target=r["target"],
                            status=r["status"], message=r["message"], suggested_fix=r["suggested_fix"]
                        ))

                # Analyze Measures (Naming + DAX Complexity & VAR check)
                for mname, mexpr in dax_measures.items():
                    res = dax_anal.analyze_dax(mname, mexpr, is_measure=True)
                    for r in res:
                        violations_to_insert.append(RuleViolation(
                            job_id=job_id, category=r["category"], target=r["target"],
                            status=r["status"], message=r["message"], suggested_fix=r["suggested_fix"]
                        ))

                # Analyze Columns
                for cname, cexpr in dax_columns.items():
                    res = dax_anal.analyze_dax(cname, cexpr, is_measure=False)
                    for r in res:
                        violations_to_insert.append(RuleViolation(
                            job_id=job_id, category=r["category"], target=r["target"],
                            status=r["status"], message=r["message"], suggested_fix=r["suggested_fix"]
                        ))

                # Add layout violations (Font Consistency, Visual Alignment, Static Actions)
                for r in parsed_meta.get("layout_violations", []):
                    violations_to_insert.append(RuleViolation(
                        job_id=job_id, category=r["category"], target=r["target"],
                        status=r["status"], message=r["message"], suggested_fix=r["suggested_fix"],
                        page_name=r.get("page_name"), visual_id=r.get("visual_id"), visual_title=r.get("visual_title")
                    ))

                # Analyze dataset-level rules (Unused Measures, Unused Columns, Data Model Alignment)
                dataset_checks = dax_anal.analyze_dataset(
                    dax_measures,
                    dax_columns,
                    layout_str=layout_str
                )
                for r in dataset_checks:
                    violations_to_insert.append(RuleViolation(
                        job_id=job_id, category=r["category"], target=r["target"],
                        status=r["status"], message=r["message"], suggested_fix=r["suggested_fix"],
                        page_name=r.get("page_name"), visual_id=r.get("visual_id"), visual_title=r.get("visual_title")
                    ))

            except Exception as e:
                print(f"Service naming check error: {e}")
                violations_to_insert.append(RuleViolation(
                    job_id=job_id, category="power_query_naming", target="Dataset Metadata Retrieval",
                    status="warning", message=f"Partial metadata analysis completed: {str(e)}",
                    suggested_fix="Ensure report has accessible tables and visual containers."
                ))
            
            current_progress += (progress_per_step - 5)

        # Step 2: Playwright Functional Checks
        if "functional" in checks:
            job.progress = current_progress
            job.current_step = "Launching functional Playwright web automation..."
            session.commit()
            
            report_pages = []
            try:
                pages_res = api_client.get_report_pages(workspace_id, report_id)
                report_pages = [p["displayName"] for p in pages_res.get("value", []) if p.get("displayName")]
            except Exception as e:
                print(f"Failed to fetch report pages over REST: {e}")
            
            def update_playwright_progress(step_text, pct):
                # Calculate sub-progress mapping inside the thread
                step_pct = current_progress + int((pct / 100) * progress_per_step)
                job.progress = min(step_pct, current_progress + progress_per_step - 2)
                job.current_step = f"Playwright: {step_text}"
                session.commit()
                
            tester = PlaywrightFunctionalTester(
                job_id, report_url, update_playwright_progress, 
                report_pages=report_pages or (parsed_meta.get("pages") if parsed_meta else None),
                page_bookmarks=parsed_meta.get("page_bookmarks") if parsed_meta else None,
                page_slicers=parsed_meta.get("page_slicers") if parsed_meta else None,
                workspace_id=workspace_id,
                report_id=report_id,
                api_client=api_client
            )
            
            try:
                func_results = tester.run_tests()
                for r in func_results:
                    violations_to_insert.append(RuleViolation(
                        job_id=job_id, category=r["category"], target=r["target"],
                        status=r["status"], message=r["message"], suggested_fix=r["suggested_fix"],
                        screenshot_url=r.get("screenshot_url"),
                        screenshot_note=r.get("screenshot_note"),
                        page_name=r.get("page_name")
                    ))
            except Exception as e:
                violations_to_insert.append(RuleViolation(
                    job_id=job_id, category="functional", target="Browser functional testing",
                    status="fail", message=f"Playwright automation crashed: {str(e)}",
                    suggested_fix="Inspect network issues or storage cookies."
                ))
                
            current_progress += progress_per_step

        # Step 3: Export PDF Check
        if "export_pdf" in checks:
            job.progress = current_progress
            job.current_step = "Executing PDF Export-To-File API request..."
            session.commit()
            
            exporter = ExportTester(job_id, lambda text, pct: None)
            try:
                res = exporter.run_pdf_export_test(api_client, workspace_id, report_id)
                violations_to_insert.append(RuleViolation(
                    job_id=job_id, category=res["category"], target=res["target"],
                    status=res["status"], message=res["message"], suggested_fix=res["suggested_fix"]
                ))
            except Exception as e:
                violations_to_insert.append(RuleViolation(
                    job_id=job_id, category="export_pdf", target="PDF Export API",
                    status="fail", message=str(e), suggested_fix="Ensure report isn't encrypted."
                ))
                
            current_progress += progress_per_step

        # Step 4: Export Excel / Data Check
        if "export_excel" in checks:
            job.progress = current_progress
            job.current_step = "Interacting with visuals to export Excel spreadsheet..."
            session.commit()
            
            exporter = ExportTester(job_id, lambda text, pct: None)
            try:
                res = exporter.run_excel_export_test(report_url)
                violations_to_insert.append(RuleViolation(
                    job_id=job_id, category=res["category"], target=res["target"],
                    status=res["status"], message=res["message"], suggested_fix=res["suggested_fix"]
                ))
            except Exception as e:
                violations_to_insert.append(RuleViolation(
                    job_id=job_id, category="export_excel", target="Excel Export Automation",
                    status="fail", message=str(e), suggested_fix="Confirm visual configurations."
                ))
                
            current_progress += progress_per_step

        # Commit all violations to DB
        if violations_to_insert:
            session.add_all(violations_to_insert)
            session.commit()

        # Update Summary & generate files
        job.progress = 90
        job.current_step = "Compiling report files..."
        session.commit()

        total = len(violations_to_insert)
        passed = sum(1 for v in violations_to_insert if v.status == "pass")
        failed = sum(1 for v in violations_to_insert if v.status == "fail")
        warnings = sum(1 for v in violations_to_insert if v.status == "warning")

        job.summary_total = total
        job.summary_passed = passed
        job.summary_failed = failed
        job.summary_warnings = warnings

        pdf_filename = f"report_{job_id}.pdf"
        html_filename = f"report_{job_id}.html"
        pdf_path = os.path.join(Config.REPORT_FOLDER, pdf_filename)
        html_path = os.path.join(Config.REPORT_FOLDER, html_filename)

        violations_dict = [v.to_dict() for v in violations_to_insert]
        report_json = ReportBuilder.build_json(job, violations_dict, layout_str=layout_str)
        
        ReportBuilder.generate_html_report(report_json, html_path)
        ReportBuilder.generate_pdf_report(report_json, pdf_path)

        job.report_pdf_path = pdf_path
        job.report_html_path = html_path
        
        job.status = "complete"
        job.progress = 100
        job.current_step = "All service tests completed successfully."
        job.completed_at = datetime.datetime.utcnow()
        session.commit()

    except Exception as ex:
        print(f"Error in Service background analysis: {ex}")
        job = session.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = "failed"
            job.progress = 100
            job.current_step = f"Service analysis crashed: {str(ex)}"
            job.completed_at = datetime.datetime.utcnow()
            session.commit()
    finally:
        session.close()


@service_bp.route('/api/service/connect', methods=['POST'])
@require_auth
def service_connect():
    """
    Accepts workspace_id/url and auth_mode.
    If Service Principal, resolves token instantly.
    If Delegated User, generates redirect login URL.
    """
    try:
        data = request.get_json() or {}
        auth_mode = data.get("auth_mode", "service_principal")
        redirect_uri = data.get("redirect_uri")
        
        if auth_mode == "service_principal":
            token = auth_service.get_service_principal_token()
            return jsonify({
                "success": True,
                "message": "Authenticated successfully as Service Principal.",
                "token": token
            })
            
        elif auth_mode == "delegated":
            if not redirect_uri:
                return jsonify({"error": "redirect_uri is required for delegated user auth"}), 400
                
            client_id = data.get("client_id")
            tenant_id = data.get("tenant_id")
            state = str(uuid.uuid4())
            auth_url = auth_service.get_auth_url(redirect_uri, state, client_id=client_id, tenant_id=tenant_id)
            return jsonify({
                "success": True,
                "auth_url": auth_url,
                "state": state
            })
        else:
            return jsonify({"error": "Invalid auth_mode. Must be 'service_principal' or 'delegated'"}), 400
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@service_bp.route('/api/service/oauth/callback', methods=['POST'])
@require_auth
def oauth_callback():
    """
    Exchanges code for AAD access token.
    Stores and returns username / status.
    """
    try:
        data = request.get_json() or {}
        code = data.get("code")
        state = data.get("state")
        redirect_uri = data.get("redirect_uri")
        client_id = data.get("client_id")
        client_secret = data.get("client_secret")
        tenant_id = data.get("tenant_id")
        
        if not code or not redirect_uri:
            return jsonify({"error": "code and redirect_uri are required"}), 400
            
        token_info = auth_service.acquire_token_by_auth_code(
            code, redirect_uri,
            state=state,
            client_id=client_id,
            client_secret=client_secret,
            tenant_id=tenant_id
        )
        session_id = str(uuid.uuid4())
        USER_TOKENS[session_id] = token_info
        
        return jsonify({
            "success": True,
            "session_id": session_id,
            "username": token_info.get("username"),
            "token": token_info.get("access_token")
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@service_bp.route('/api/service/test', methods=['POST'])
@require_auth
def service_test():
    """
    Trigger validation job on live Power BI Service report URL.
    """
    session = current_app.db_session_factory()
    try:
        data = request.get_json() or {}
        report_url = data.get("report_url")
        checks = data.get("checks", ["naming", "functional", "export_pdf", "export_excel"])
        auth_mode = data.get("auth_mode", "service_principal")
        token = data.get("token")  # If passed from frontend direct, or we fetch from principal
        
        if not report_url:
            return jsonify({"error": "report_url is required"}), 400
            
        # Obtain appropriate token if not passed directly
        if not token:
            if auth_mode == "service_principal":
                token = auth_service.get_service_principal_token()
            else:
                return jsonify({"error": "Auth token is missing for delegated user flow."}), 401

        job_id = str(uuid.uuid4())
        
        # Create Job entry in DB
        new_job = Job(
            id=job_id,
            user_id=g.user_id,
            method="service",
            source=report_url,
            status="queued",
            progress=0,
            current_step="Queueing Power BI Service test execution run..."
        )
        session.add(new_job)
        session.commit()

        # Spin off background Thread
        app_context = current_app._get_current_object().app_context()
        thread = Thread(
            target=run_service_analysis_job,
            args=(job_id, report_url, checks, token, app_context)
        )
        thread.start()

        return jsonify({
            "job_id": job_id,
            "message": "Power BI Service testing initiated. Job queued.",
            "status": "queued"
        }), 202

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()
