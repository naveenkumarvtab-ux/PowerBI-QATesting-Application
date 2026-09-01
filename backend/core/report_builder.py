import os
import json
import datetime
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

class ReportBuilder:
    @classmethod
    def build_json(cls, job, violations, total_measures=None, unused_measures_count=None, layout_str=None, excluded_counts=None):
        """
        Builds and returns the normalized JSON schema for the report results.
        """
        import re
        # Group violations by category
        categories_map = {
            "power_query_naming": "Power Query Step Naming",
            "dax_naming": "DAX Measure Naming",
            "dax_calculated_columns": "DAX Calculated Column Naming",
            "dax_complexity": "DAX Complexity & VAR Check",
            "font_consistency": "Font Consistency Check",
            "unused_measures": "Unused Measures Check",
            "unused_columns": "Unused Columns Check",
            "data_model": "Data Model Alignment",
            "visual_alignment": "Visual Alignment Check",
            "functional": "Functional UI Testing",
            "export_pdf": "PDF Export Verification",
            "export_excel": "Excel Export Verification"
        }
        
        # Define expected manifest based on job method
        method = getattr(job, "method", "pbix").lower()
        if method in ("service", "cloud"):
            manifest = [
                "power_query_naming", "dax_naming", "dax_calculated_columns", 
                "unused_measures", "unused_columns", "data_model", "font_consistency", "visual_alignment", 
                "functional", "export_pdf", "export_excel"
            ]
        else:
            manifest = [
                "power_query_naming", "dax_naming", "dax_calculated_columns", 
                "unused_measures", "unused_columns", "data_model", "font_consistency", "visual_alignment", 
                "functional"
            ]
            
        # Normalize violations list to dicts
        normalized_violations = [v.to_dict() if hasattr(v, "to_dict") else v for v in violations]
            
        sections_dict = {}
        for cat_key in manifest:
            cat_name = categories_map.get(cat_key, cat_key.replace("_", " ").title())
            sections_dict[cat_key] = {
                "category": cat_key,
                "category_name": cat_name,
                "title": cat_name,
                "results": []
            }
            
        total = 0
        passed = 0
        failed = 0
        warnings = 0
        errors = 0
        
        # Keep track of power query step name groupings
        pq_tables = {}
        
        for v in normalized_violations:
            cat = v.get("category", "functional")
            if cat not in sections_dict:
                cat_title = categories_map.get(cat, cat.replace("_", " ").title())
                sections_dict[cat] = {
                    "category": cat,
                    "category_name": cat_title,
                    "title": cat_title,
                    "results": []
                }
                
            status = v.get("status", "pass")
            total += 1
            if status == "pass":
                passed += 1
            elif status == "fail":
                failed += 1
            elif status == "warning":
                warnings += 1
            elif status == "error":
                errors += 1
                
            # Restructure power_query_naming table-wise
            if cat == "power_query_naming":
                target_str = v.get("target", "")
                table_name = "Model Query"
                step_name = target_str
                
                # Match target like "Query: Sheet1 (Step: Source)" or "Query: Sheet1"
                m = re.match(r'Query:\s*([^\(]+)(?:\s*\(Step:\s*([^\)]+)\))?', target_str)
                if m:
                    table_name = m.group(1).strip()
                    step_name = f"Step: {m.group(2).strip()}" if m.group(2) else "Query Config"
                elif target_str.startswith("Query: "):
                    table_name = target_str.replace("Query: ", "").strip()
                    step_name = "Query Config"
                    
                if table_name not in pq_tables:
                    pq_tables[table_name] = {
                        "summary": {"total": 0, "passed": 0, "warnings": 0, "failed": 0},
                        "results": []
                    }
                    
                summary = pq_tables[table_name]["summary"]
                summary["total"] += 1
                if status == "pass":
                    summary["passed"] += 1
                elif status == "warning":
                    summary["warnings"] += 1
                elif status == "fail":
                    summary["failed"] += 1
                    
                pq_tables[table_name]["results"].append({
                    "target": step_name,
                    "status": status,
                    "message": v.get("message", ""),
                    "suggested_fix": v.get("suggested_fix", "")
                })
            
            sections_dict[cat]["results"].append({
                "target": v.get("target", ""),
                "status": status,
                "message": v.get("message", ""),
                "suggested_fix": v.get("suggested_fix", ""),
                "screenshot_url": v.get("screenshot_url"),
                "screenshot_note": v.get("screenshot_note")
            })
            
        # Add placeholders for any missing check categories in the manifest
        for cat in manifest:
            if len(sections_dict[cat]["results"]) == 0:
                total += 1
                errors += 1
                sections_dict[cat]["results"].append({
                    "target": f"{cat} — Check did not run",
                    "status": "error",
                    "message": "This check did not produce any results. It may not be implemented, may have failed silently, or was skipped for this job configuration.",
                    "suggested_fix": "",
                    "screenshot_url": None
                })
            
        # Add tables field to power_query_naming
        if "power_query_naming" in sections_dict:
            sections_dict["power_query_naming"]["tables"] = [
                {
                    "table_name": name,
                    "summary": item["summary"],
                    "results": item["results"]
                } for name, item in pq_tables.items()
            ]

        # Add metadata and caveats for unused measures
        if "unused_measures" in sections_dict and len(sections_dict["unused_measures"]["results"]) > 0:
            sect = sections_dict["unused_measures"]
            sect["caveat"] = "Note: measures used only by external connections (Analyze in Excel, other reports via live connection, paginated reports) cannot be detected by this check and may show as false positives."
            if total_measures is not None and unused_measures_count is not None:
                sect["summary_info"] = f"{unused_measures_count} of {total_measures} measures unused"
            else:
                warning_results = [r for r in sect["results"] if r["status"] == "warning"]
                sect["summary_info"] = f"{len(warning_results)} measures unused"

        # Add metadata and caveats for unused columns
        if "unused_columns" in sections_dict and len(sections_dict["unused_columns"]["results"]) > 0:
            sect = sections_dict["unused_columns"]
            sect["caveat"] = "Note: columns used only by external connections (Analyze in Excel, other reports via live connection, paginated reports) cannot be detected by this check and may show as false positives."
            total_cols_count = len(sect["results"])
            unused_cols_count = sum(1 for r in sect["results"] if r["status"] == "warning")
            sect["summary_info"] = f"{unused_cols_count} of {total_cols_count} columns unused"
                
        # Add section-level exclusion notes
        if excluded_counts:
            for cat_key, sect in sections_dict.items():
                cnt = excluded_counts.get(cat_key, 0)
                if cnt > 0:
                    if cat_key == "power_query_naming":
                        sect["excluded_note"] = f"{cnt} hidden {'query was' if cnt == 1 else 'queries were'} (Enable Load disabled) excluded from this check."
                    elif cat_key in ("data_model", "unused_columns", "unused_measures"):
                        sect["excluded_note"] = f"{cnt} hidden {'table was' if cnt == 1 else 'tables were'} excluded from this check."
                    else:
                        sect["excluded_note"] = f"{cnt} hidden {'item was' if cnt == 1 else 'items were'} excluded from this check."

        # Parse layout JSON to generate page-grouped view
        layout = None
        if layout_str:
            try:
                layout = json.loads(layout_str)
            except Exception:
                pass

        # Standalone sections (Power Query and Data Model)
        standalone_sections = []
        if "power_query_naming" in sections_dict:
            standalone_sections.append(sections_dict["power_query_naming"])
        if "data_model" in sections_dict:
            standalone_sections.append(sections_dict["data_model"])

        # Category view sections (excluding standalone sections)
        category_sections = [
            s for s in sections_dict.values()
            if s["category"] not in ("power_query_naming", "data_model")
        ]

        # Extract field-to-page mappings from layout visual containers
        measure_to_pages = {}
        column_to_pages = {}

        def record_field(field_name, page_name):
            if not field_name or not isinstance(field_name, str):
                return
            cleaned = field_name.strip()
            col_part = cleaned.split("[")[-1].rstrip("]") if "[" in cleaned else cleaned
            for k in (cleaned.lower(), col_part.lower()):
                if k not in measure_to_pages:
                    measure_to_pages[k] = set()
                measure_to_pages[k].add(page_name)
                if k not in column_to_pages:
                    column_to_pages[k] = set()
                column_to_pages[k].add(page_name)

        def scan_node_fields(node, page_name):
            if isinstance(node, dict):
                if "Property" in node and isinstance(node["Property"], str):
                    record_field(node["Property"], page_name)
                if "queryRef" in node and isinstance(node["queryRef"], str):
                    q = node["queryRef"]
                    q_val = q.split(".", 1)[1] if "." in q else q
                    record_field(q, page_name)
                    record_field(q_val, page_name)
                if "displayName" in node and isinstance(node["displayName"], str):
                    record_field(node["displayName"], page_name)
                for v in node.values():
                    scan_node_fields(v, page_name)
            elif isinstance(node, list):
                for item in node:
                    scan_node_fields(item, page_name)

        pages_list = []
        pages_dict = {}

        if layout:
            for sec in layout.get("sections", []):
                is_hidden = False
                if sec.get("visibility") == 1:
                    is_hidden = True
                else:
                    cfg_str = sec.get("config")
                    if cfg_str:
                        try:
                            cfg = json.loads(cfg_str)
                            if cfg.get("visibility") == 1:
                                is_hidden = True
                        except Exception:
                            pass
                if is_hidden:
                    continue

                page_name = sec.get("displayName") or sec.get("name")
                
                # Scan visual containers on this page
                for vc in sec.get("visualContainers", []):
                    cfg_str = vc.get("config")
                    if cfg_str:
                        try:
                            cfg = json.loads(cfg_str)
                            scan_node_fields(cfg, page_name)
                        except Exception:
                            pass
                    flt_str = vc.get("filters")
                    if flt_str:
                        try:
                            flt = json.loads(flt_str)
                            scan_node_fields(flt, page_name)
                        except Exception:
                            pass

                # Scan page-level filters
                pflt_str = sec.get("filters")
                if pflt_str:
                    try:
                        pflt = json.loads(pflt_str)
                        scan_node_fields(pflt, page_name)
                    except Exception:
                        pass

                page_obj = {
                    "page_name": page_name,
                    "page_level_results": [],
                    "visual_results": [],
                    "dax_results": []
                }
                pages_dict[page_name.lower()] = page_obj
                pages_list.append(page_obj)

        not_used_on_any_page = []
        report_level_checks = []

        def extract_clean_target_name(target_str):
            t = target_str
            for prefix in ("Measure:", "Calculated Column:", "Complex Measure:", "Column:", "Table:"):
                if t.startswith(prefix):
                    t = t[len(prefix):].strip()
            if "[" in t and "]" in t:
                col_part = t.split("[")[-1].split("]")[0].strip()
                return col_part.lower(), t.lower()
            return t.strip().lower(), t.strip().lower()

        # Map each violation into the appropriate bucket
        for v in normalized_violations:
            cat = v.get("category")
            status = v.get("status", "pass")
            target = v.get("target", "")
            
            res_item = {
                "category": cat,
                "target": target,
                "status": status,
                "message": v.get("message", ""),
                "suggested_fix": v.get("suggested_fix", "")
            }

            # 1. Standalone sections (Power Query and Data Model) are kept out of page cards
            if cat in ("power_query_naming", "data_model"):
                continue

            # 2. Unused measures and Unused columns -> "Not Used On Any Page"
            if cat in ("unused_measures", "unused_columns"):
                not_used_on_any_page.append(res_item)
                continue

            # 3. PDF and Excel Export Verifications -> "Report-Level Checks"
            if cat in ("pdf_export", "excel_export"):
                report_level_checks.append(res_item)
                continue

            # 4. DAX Measure Naming, Calculated Column Naming, DAX Complexity & VAR Check
            if cat in ("dax_naming", "dax_calculated_columns", "dax_calculated_column_naming", "dax_complexity"):
                short_name, full_name = extract_clean_target_name(target)
                matched_pages = measure_to_pages.get(short_name) or measure_to_pages.get(full_name) or column_to_pages.get(short_name) or column_to_pages.get(full_name)
                
                if matched_pages:
                    for p_name in matched_pages:
                        p_key = p_name.lower()
                        if p_key in pages_dict:
                            pages_dict[p_key]["dax_results"].append(res_item)
                else:
                    # Not referenced on any visible page
                    not_used_on_any_page.append(res_item)
                continue

            # 5. Page-level & Visual checks (Font, Alignment, Functional UI)
            v_page = v.get("page_name")
            v_vis_id = v.get("visual_id")
            
            # Heuristic page name resolution if not set explicitly
            if not v_page:
                t_str = target + " " + v.get("message", "")
                for p_obj in pages_list:
                    if p_obj["page_name"].lower() in t_str.lower():
                        v_page = p_obj["page_name"]
                        break
                        
            if v_page and v_page.lower() in pages_dict:
                target_page = pages_dict[v_page.lower()]
                # If visual-specific (e.g. font consistency, visual alignment, visual action)
                if cat in ("font_consistency", "visual_alignment") or v_vis_id or "visual" in target.lower():
                    target_page["visual_results"].append(res_item)
                else:
                    target_page["page_level_results"].append(res_item)
            else:
                report_level_checks.append(res_item)

        # Structured Page-Grouped View Object
        page_grouped_data = {
            "standalone_sections": standalone_sections,
            "pages": pages_list,
            "unassigned": {
                "not_used_on_any_page": not_used_on_any_page,
                "report_level_checks": report_level_checks
            }
        }
        
        return {
            "job_id": job.id,
            "method": job.method,
            "source": job.source,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": datetime.datetime.utcnow().isoformat(),
            "summary": {
                "total_checks": total,
                "passed": passed,
                "failed": failed,
                "warnings": warnings
            },
            "sections": category_sections,
            "standalone_sections": standalone_sections,
            "page_grouped_view": page_grouped_data
        }

    @classmethod
    def generate_html_report(cls, report_json, output_path):
        """
        Generates a clean HTML report and saves it to output_path.
        """
        summary = report_json["summary"]
        method_label = "PBIX File Upload" if report_json["method"] == "pbix" else "Power BI Service (API & Playwright)"
        
        sections_html = ""
        for sec in report_json["sections"]:
            results_html = ""
            for res in sec["results"]:
                status_color = "bg-green-100 text-green-800 border-green-300"
                if res["status"] == "fail":
                    status_color = "bg-red-100 text-red-800 border-red-300"
                elif res["status"] == "error":
                    status_color = "bg-rose-100 text-rose-800 border-rose-300"
                elif res["status"] == "warning":
                    status_color = "bg-yellow-100 text-yellow-800 border-yellow-300"
                    
                fix_html = ""
                if res["suggested_fix"]:
                    fix_html = f'''
                    <div class="mt-2 p-2 bg-slate-50 border border-slate-200 rounded text-xs">
                        <strong class="text-slate-700">Suggested Fix:</strong> {res['suggested_fix']}
                    </div>
                    '''
                    
                results_html += f'''
                <div class="border-b border-gray-100 py-3 last:border-0">
                    <div class="flex items-center justify-between">
                        <h4 class="font-medium text-gray-800 text-sm">{res['target']}</h4>
                        <span class="px-2 py-0.5 text-xs font-semibold border rounded-full uppercase {status_color}">
                            {res['status']}
                        </span>
                    </div>
                    <p class="text-gray-600 text-xs mt-1">{res['message']}</p>
                    {fix_html}
                </div>
                '''
                
            sections_html += f'''
            <div class="mb-6 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h3 class="font-semibold text-gray-800 text-sm">{sec['category_name']}</h3>
                </div>
                <div class="p-4 divide-y divide-gray-100">
                    {results_html}
                </div>
            </div>
            '''

        html_content = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PBI QA Suite Report - {report_json['job_id']}</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 text-gray-900 font-sans py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-4xl mx-auto">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-gray-200 mb-6">
            <div>
                <h1 class="text-2xl font-bold text-gray-900">PBI QA Suite Report</h1>
                <p class="text-xs text-gray-500 mt-1">Job ID: {report_json['job_id']} | Generated: {report_json['completed_at']}</p>
            </div>
            <div class="mt-4 sm:mt-0 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                <span class="text-xs text-indigo-700 font-semibold uppercase tracking-wider block">Analysis Mode</span>
                <span class="text-sm font-bold text-indigo-900">{method_label}</span>
            </div>
        </div>

        <!-- Meta -->
        <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-6">
            <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Analysis Source</h2>
            <code class="text-xs bg-gray-100 block p-2 rounded text-gray-800 break-all">{report_json['source']}</code>
        </div>

        <!-- Summary -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4 text-center">
                <span class="text-xs font-medium text-gray-500 block uppercase">Total Checks</span>
                <span class="text-2xl font-bold text-gray-900">{summary['total_checks']}</span>
            </div>
            <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4 text-center border-l-4 border-l-green-500">
                <span class="text-xs font-medium text-gray-500 block uppercase">Passed</span>
                <span class="text-2xl font-bold text-green-700">{summary['passed']}</span>
            </div>
            <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4 text-center border-l-4 border-l-yellow-500">
                <span class="text-xs font-medium text-gray-500 block uppercase">Warnings</span>
                <span class="text-2xl font-bold text-yellow-600">{summary['warnings']}</span>
            </div>
            <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4 text-center border-l-4 border-l-red-500">
                <span class="text-xs font-medium text-gray-500 block uppercase">Failed</span>
                <span class="text-2xl font-bold text-red-700">{summary['failed']}</span>
            </div>
        </div>

        <!-- Sections -->
        {sections_html}
    </div>
</body>
</html>
'''
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html_content)

    @classmethod
    def generate_pdf_report(cls, report_json, output_path):
        """
        Generates a clean PDF report using ReportLab and saves it to output_path.
        """
        # Create PDF document
        doc = SimpleDocTemplate(
            output_path,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )
        
        styles = getSampleStyleSheet()
        
        # Define styles
        title_style = ParagraphStyle(
            'ReportTitle',
            parent=styles['Heading1'],
            fontSize=22,
            leading=26,
            textColor=colors.HexColor("#1e293b"),
            spaceAfter=6
        )
        
        meta_style = ParagraphStyle(
            'ReportMeta',
            parent=styles['Normal'],
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#64748b")
        )
        
        h2_style = ParagraphStyle(
            'SectionHeader',
            parent=styles['Heading2'],
            fontSize=14,
            leading=18,
            textColor=colors.HexColor("#0f172a"),
            spaceBefore=12,
            spaceAfter=6,
            keepWithNext=True
        )
        
        body_style = ParagraphStyle(
            'ReportBody',
            parent=styles['Normal'],
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#334155")
        )
        
        code_style = ParagraphStyle(
            'ReportCode',
            parent=styles['Normal'],
            fontName='Helvetica-Oblique',
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#1e293b")
        )
        
        fix_style = ParagraphStyle(
            'ReportFix',
            parent=styles['Normal'],
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#475569")
        )
        
        story = []
        
        # 1. Header
        story.append(Paragraph("PBI QA Suite - Analysis Report", title_style))
        completed_time = report_json.get("completed_at", datetime.datetime.utcnow().isoformat())
        story.append(Paragraph(f"Job ID: {report_json['job_id']}  |  Generated: {completed_time}", meta_style))
        story.append(Spacer(1, 10))
        
        # 2. Source Meta Table
        method_lbl = "PBIX File Analysis" if report_json["method"] == "pbix" else "Power BI Service QA"
        meta_data = [
            [Paragraph("<b>Analysis Source:</b>", body_style), Paragraph(report_json['source'], code_style)],
            [Paragraph("<b>Analysis Method:</b>", body_style), Paragraph(method_lbl, body_style)]
        ]
        meta_table = Table(meta_data, colWidths=[100, 440])
        meta_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor("#f1f5f9")),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 15))
        
        # 3. Summary Stats Table
        summary = report_json["summary"]
        stat_data = [
            ["Total Checks", "Passed", "Warnings", "Failed"],
            [str(summary['total_checks']), str(summary['passed']), str(summary['warnings']), str(summary['failed'])]
        ]
        stat_table = Table(stat_data, colWidths=[135, 135, 135, 135])
        stat_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 1), (-1, 1), 16),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            # Color overrides for status columns
            ('TEXTCOLOR', (1, 1), (1, 1), colors.HexColor("#15803d")), # Passed - Green
            ('TEXTCOLOR', (2, 1), (2, 1), colors.HexColor("#b45309")), # Warnings - Yellow
            ('TEXTCOLOR', (3, 1), (3, 1), colors.HexColor("#b91c1c")), # Failed - Red
        ]))
        story.append(stat_table)
        story.append(Spacer(1, 20))
        
        # 4. Detailed Sections
        for sec in report_json["sections"]:
            sec_story = []
            sec_story.append(Paragraph(sec["category_name"], h2_style))
            
            # Setup Table Headers
            table_data = [
                ["Target Object", "Status", "Description / Suggested Fix"]
            ]
            
            for res in sec["results"]:
                status_color = colors.HexColor("#15803d") # green
                if res["status"] == "fail":
                    status_color = colors.HexColor("#b91c1c") # red
                elif res["status"] == "warning":
                    status_color = colors.HexColor("#b45309") # amber
                    
                target_p = Paragraph(f"<b>{res['target']}</b>", body_style)
                
                status_p = Paragraph(f"<font color='{status_color.hexval()}'><b>{res['status'].upper()}</b></font>", body_style)
                
                desc_text = f"{res['message']}"
                if res['suggested_fix']:
                    desc_text += f"<br/><br/><b>Suggested Fix:</b> {res['suggested_fix']}"
                desc_p = Paragraph(desc_text, fix_style)
                
                table_data.append([target_p, status_p, desc_p])
                
            sec_table = Table(table_data, colWidths=[150, 60, 330])
            sec_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f8fafc")),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor("#cbd5e1")),
            ]))
            
            sec_story.append(sec_table)
            sec_story.append(Spacer(1, 15))
            story.append(KeepTogether(sec_story))
            
        doc.build(story)
