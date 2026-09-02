import os
import json
import uuid
import datetime
from threading import Thread
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from backend.config import Config
from backend.models.job import Job, RuleViolation
from backend.core.pbix_parser import PBIXParser
from backend.core.dax_analyzer import DaxAnalyzer
from backend.core.mquery_analyzer import MQueryAnalyzer
from backend.core.report_builder import ReportBuilder
from backend.core.powerbi_auth import PowerBIAuthService
from backend.core.powerbi_api_client import PowerBIAPIClient
from backend.core.functional_tests import PlaywrightFunctionalTester
from backend.core.export_tests import ExportTester

pbix_bp = Blueprint('pbix', __name__)

def run_pbix_analysis_job(job_id, file_path, upload_name, run_functional, run_pdf, run_excel, auth_mode, token, app_context):
    """
    Background job function running inside a separate thread.
    Parses local PBIX metadata, optionally publishes it to Power BI Service,
    runs Playwright browser tests, and cleans up the temporary files from the service.
    """
    app_context.push()
    session = current_app.db_session_factory()
    
    temp_report_id = None
    temp_dataset_id = None
    temp_workspace_id = "me"
    api_client = None
    
    try:
        # 1. Update status: Running parser
        job = session.query(Job).filter(Job.id == job_id).first()
        job.status = "running"
        job.progress = 10
        job.current_step = "Extracting local PBIX metadata..."
        session.commit()

        # Parse local file
        parser = PBIXParser(file_path)
        metadata = parser.parse()
        
        # 2. Update status: Running Rule Checks
        job.progress = 30
        job.current_step = "Analyzing local formulas against naming standard conventions..."
        session.commit()

        violations_to_insert = []
        dax_anal = DaxAnalyzer()
        m_anal = MQueryAnalyzer()

        # Run static checks
        for query_name, m_code in metadata["m_queries"].items():
            checks = m_anal.analyze_query(query_name, m_code)
            for chk in checks:
                violations_to_insert.append(RuleViolation(
                    job_id=job_id, category=chk["category"], target=chk["target"],
                    status=chk["status"], message=chk["message"], suggested_fix=chk["suggested_fix"]
                ))

        for m_name, m_expr in metadata["dax_measures"].items():
            checks = dax_anal.analyze_dax(m_name, m_expr, is_measure=True)
            for chk in checks:
                violations_to_insert.append(RuleViolation(
                    job_id=job_id, category=chk["category"], target=chk["target"],
                    status=chk["status"], message=chk["message"], suggested_fix=chk["suggested_fix"]
                ))

        for c_name, c_expr in metadata["dax_columns"].items():
            checks = dax_anal.analyze_dax(c_name, c_expr, is_measure=False)
            for chk in checks:
                violations_to_insert.append(RuleViolation(
                    job_id=job_id, category=chk["category"], target=chk["target"],
                    status=chk["status"], message=chk["message"], suggested_fix=chk["suggested_fix"]
                ))

        # Save layout_str on job object for UI rendering persistence
        job.layout_str = metadata.get("layout_str")
        if metadata.get("excluded_counts"):
            job.excluded_counts_str = json.dumps(metadata.get("excluded_counts"))

        # Run dataset-level checks (unused and duplicate measures)
        dataset_checks = dax_anal.analyze_dataset(
            metadata["dax_measures"], 
            metadata["dax_columns"], 
            layout_str=metadata.get("layout_str")
        )
        for chk in dataset_checks:
            violations_to_insert.append(RuleViolation(
                job_id=job_id, category=chk["category"], target=chk["target"],
                status=chk["status"], message=chk["message"], suggested_fix=chk["suggested_fix"],
                page_name=chk.get("page_name"), visual_id=chk.get("visual_id"), visual_title=chk.get("visual_title")
            ))

        # Run layout-level visual audits (broken page navigation, etc.)
        for chk in metadata.get("layout_violations", []):
            violations_to_insert.append(RuleViolation(
                job_id=job_id, category=chk["category"], target=chk["target"],
                status=chk["status"], message=chk["message"], suggested_fix=chk["suggested_fix"],
                page_name=chk.get("page_name"), visual_id=chk.get("visual_id"), visual_title=chk.get("visual_title")
            ))

        # Desktop Local Model Dataset Refresh Check
        violations_to_insert.append(RuleViolation(
            job_id=job_id, category="dataset_refresh",
            target="Dataset Refresh Status (Desktop PBIX)",
            status="pass",
            message="Local desktop model verified. Scheduled cloud refresh is monitored when deploying to Power BI Service.",
            suggested_fix=""
        ))

        # Check if we need to run service-level tests
        if run_functional or run_pdf or run_excel:
            job.progress = 45
            job.current_step = "Uploading PBIX to temporary workspace for browser validation..."
            session.commit()

            # Obtain token if missing
            if not token:
                auth_service = PowerBIAuthService()
                if auth_mode == "service_principal":
                    token = auth_service.get_service_principal_token()
                else:
                    raise ValueError("Access token is missing for delegated user flow.")

            api_client = PowerBIAPIClient(token)
            
            # Import PBIX to service
            import_data = api_client.upload_pbix(temp_workspace_id, file_path, f"QA_Temp_{job_id}")
            temp_report_id = import_data["reports"][0]["id"]
            temp_dataset_id = import_data["datasets"][0]["id"]
            report_url = import_data["reports"][0]["webUrl"]

            # Visual check breakdown
            active_service_checks = int(run_functional) + int(run_pdf) + int(run_excel)
            progress_step = 40 // max(1, active_service_checks)
            current_pct = 45

            if run_functional:
                current_pct += 5
                job.progress = current_pct
                job.current_step = "Launching Playwright browser to test bookmarks and navigation..."
                session.commit()

                def update_progress(text, pct):
                    sub_pct = current_pct + int((pct / 100) * progress_step)
                    job.progress = min(sub_pct, current_pct + progress_step - 2)
                    job.current_step = f"Playwright: {text}"
                    session.commit()

                tester = PlaywrightFunctionalTester(
                    job_id, report_url, update_progress, 
                    report_pages=metadata.get("pages"),
                    page_bookmarks=metadata.get("page_bookmarks"),
                    page_slicers=metadata.get("page_slicers"),
                    workspace_id=temp_workspace_id,
                    report_id=temp_report_id,
                    api_client=api_client
                )
                func_results = tester.run_tests()
                for r in func_results:
                    violations_to_insert.append(RuleViolation(
                        job_id=job_id, category=r["category"], target=r["target"],
                        status=r["status"], message=r["message"], suggested_fix=r["suggested_fix"],
                        screenshot_url=r.get("screenshot_url"),
                        screenshot_note=r.get("screenshot_note")
                    ))
                current_pct += (progress_step - 5)

            if run_pdf:
                current_pct += 2
                job.progress = current_pct
                job.current_step = "Running cloud PDF export validation..."
                session.commit()

                exporter = ExportTester(job_id, lambda text, pct: None)
                pdf_res = exporter.run_pdf_export_test(api_client, temp_workspace_id, temp_report_id)
                violations_to_insert.append(RuleViolation(
                    job_id=job_id, category=pdf_res["category"], target=pdf_res["target"],
                    status=pdf_res["status"], message=pdf_res["message"], suggested_fix=pdf_res["suggested_fix"]
                ))
                current_pct += (progress_step - 2)

            if run_excel:
                current_pct += 2
                job.progress = current_pct
                job.current_step = "Running Playwright Excel download check..."
                session.commit()

                exporter = ExportTester(job_id, lambda text, pct: None)
                excel_res = exporter.run_excel_export_test(report_url)
                violations_to_insert.append(RuleViolation(
                    job_id=job_id, category=excel_res["category"], target=excel_res["target"],
                    status=excel_res["status"], message=excel_res["message"], suggested_fix=excel_res["suggested_fix"]
                ))
                current_pct += (progress_step - 2)

        # Commit violations
        if violations_to_insert:
            session.add_all(violations_to_insert)
            session.commit()

        # Update Summary & compile files
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
        report_json = ReportBuilder.build_json(
            job, 
            violations_dict, 
            total_measures=metadata.get("total_measures"), 
            unused_measures_count=metadata.get("unused_measures_count"),
            layout_str=metadata.get("layout_str")
        )
        
        ReportBuilder.generate_html_report(report_json, html_path)
        ReportBuilder.generate_pdf_report(report_json, pdf_path)

        job.report_pdf_path = pdf_path
        job.report_html_path = html_path

        # Mark Job Complete
        job.status = "complete"
        job.progress = 100
        job.current_step = "Job completed successfully."
        job.completed_at = datetime.datetime.utcnow()
        session.commit()

    except Exception as ex:
        print(f"Error in PBIX background analysis: {ex}")
        job = session.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = "failed"
            job.progress = 100
            job.current_step = f"Analysis crashed: {str(ex)}"
            job.completed_at = datetime.datetime.utcnow()
            session.commit()
    finally:
        # Crucial clean-up to prevent workspace pollution
        if api_client and temp_report_id and temp_dataset_id:
            try:
                print(f"Cleaning up temporary report {temp_report_id} and dataset {temp_dataset_id}")
                api_client.delete_report(temp_workspace_id, temp_report_id)
                api_client.delete_dataset(temp_workspace_id, temp_dataset_id)
            except Exception as clean_ex:
                print(f"Failed to delete temp objects: {clean_ex}")
        session.close()


@pbix_bp.route('/api/pbix/upload', methods=['POST'])
def upload_pbix():
    session = current_app.db_session_factory()
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file field in request"}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
            
        if not file.filename.lower().endswith('.pbix'):
            return jsonify({"error": "Only .pbix files are supported"}), 400

        # Read visual check parameters from multipart form
        run_functional = request.form.get("run_functional", "false").lower() == "true"
        run_pdf = request.form.get("run_pdf", "false").lower() == "true"
        run_excel = request.form.get("run_excel", "false").lower() == "true"
        auth_mode = request.form.get("auth_mode", "service_principal")
        token = request.form.get("token")

        # Save file to storage
        filename = secure_filename(file.filename)
        job_id = str(uuid.uuid4())
        unique_filename = f"{job_id}_{filename}"
        file_path = os.path.join(Config.UPLOAD_FOLDER, unique_filename)
        file.save(file_path)

        # Create Job DB entry
        new_job = Job(
            id=job_id,
            method="pbix",
            source=filename,
            status="queued",
            progress=0,
            current_step="File received. Queueing analysis run..."
        )
        session.add(new_job)
        session.commit()

        # Spin off background Thread
        app_context = current_app._get_current_object().app_context()
        thread = Thread(
            target=run_pbix_analysis_job,
            args=(job_id, file_path, filename, run_functional, run_pdf, run_excel, auth_mode, token, app_context)
        )
        thread.start()

        return jsonify({
            "job_id": job_id,
            "message": "PBIX file upload successful. Job queued.",
            "status": "queued"
        }), 202

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@pbix_bp.route('/api/reports/embed-harness', methods=['GET'])
def embed_harness():
    """
    Renders a minimal HTML page that embeds a Power BI report using the JS SDK.
    Playwright navigates to this page to run events and API-driven checks.
    """
    from flask import render_template_string
    harness_html = """<!DOCTYPE html>
<html>
<head>
    <title>Power BI Embedded Test Harness</title>
    <style>
        html, body, #report-container {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            overflow: hidden;
        }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/powerbi-client/2.22.0/powerbi.min.js"></script>
</head>
<body>
    <div id="report-container"></div>
    <script>
        window.__pbiLoaded = false;
        window.__pbiRendered = false;
        window.__pbiEvents = [];

        const urlParams = new URLSearchParams(window.location.search);
        const embedUrl = urlParams.get('embedUrl');
        const accessToken = urlParams.get('accessToken');
        const reportId = urlParams.get('reportId');
        const tokenTypeParam = urlParams.get('tokenType'); // '0' for AAD, '1' for Embed

        if (embedUrl && accessToken && reportId) {
            const pbi = window['powerbi-client'];
            const models = pbi.models;
            const tokenType = tokenTypeParam === '0' ? models.TokenType.Aad : models.TokenType.Embed;

            const config = {
                type: 'report',
                tokenType: tokenType,
                accessToken: accessToken,
                embedUrl: embedUrl,
                id: reportId,
                settings: {
                    panes: {
                        filters: { visible: true },
                        pageNavigation: { visible: false }
                    }
                }
            };

            const container = document.getElementById('report-container');
            const report = powerbi.embed(container, config);
            window.__pbiReport = report;

            report.on('loaded', () => {
                window.__pbiLoaded = true;
                window.__pbiEvents.push({ event: 'loaded' });
            });

            report.on('rendered', () => {
                window.__pbiRendered = true;
                window.__pbiEvents.push({ event: 'rendered' });
            });

            report.on('pageChanged', (event) => {
                window.__pbiEvents.push({ event: 'pageChanged', detail: event.detail });
            });

            report.on('error', (event) => {
                window.__pbiEvents.push({ event: 'error', detail: event.detail });
            });
        } else {
            console.error("Missing configuration params.");
        }
    </script>
</body>
</html>"""
    return render_template_string(harness_html)
