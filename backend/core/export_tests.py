import os
import time
import pandas as pd
from backend.config import Config

class ExportTester:
    def __init__(self, job_id, update_progress_callback=None):
        self.job_id = job_id
        self.update_progress_callback = update_progress_callback
        self.report_folder = Config.REPORT_FOLDER
        
    def _log(self, step_name, progress):
        if self.update_progress_callback:
            self.update_progress_callback(step_name, progress)
        try:
            print(f"[Job {self.job_id}] ExportTest: {step_name} ({progress}%)")
        except Exception:
            pass

    def run_pdf_export_test(self, api_client, workspace_id, report_id):
        """
        Verify PDF exports over the API.
        """
        self._log("Initiating PDF export request via Power BI API", 15)
        
        pdf_path = os.path.join(self.report_folder, f"report_{self.job_id}.pdf")
        
        try:
            # Calls the REST API and waits for download
            success = api_client.export_report_to_pdf(workspace_id, report_id, pdf_path)
            if success and os.path.exists(pdf_path):
                size = os.path.getsize(pdf_path)
                if size < 1024:
                    return {
                        "target": "Export API: PDF Report Export",
                        "category": "export_pdf",
                        "status": "fail",
                        "message": f"Power BI PDF export service returned an empty or corrupt PDF (size: {size} bytes).",
                        "suggested_fix": "Verify that your capacity settings permit PDF exports and that report visual queries are not failing."
                    }
                self._log("PDF export completed successfully", 80)
                return {
                    "target": "Export API: PDF Report Export",
                    "category": "export_pdf",
                    "status": "pass",
                    "message": f"Successfully exported PDF. File size: {size} bytes.",
                    "suggested_fix": ""
                }
            else:
                raise ValueError("Generated PDF file is empty or missing.")
        except Exception as e:
            self._log(f"PDF export check failed: {e}", 80)
            return {
                "target": "Export API: PDF Report Export",
                "category": "export_pdf",
                "status": "fail",
                "message": f"Power BI PDF export service returned an error: {str(e)}",
                "suggested_fix": "Verify that your Azure app registration has 'Report.ReadWrite.All' or 'Dataset.ReadWrite.All' permissions, and that the report is not sensitivity-labeled with encryption."
            }

    def run_excel_export_test(self, report_url):
        """
        Verify Excel export by interacting with the visual dashboard using Playwright.
        Opens download, reads rows using pandas/openpyxl, and validates data.
        """
        self._log("Loading visual elements for data export", 20)
        
        if Config.MOCK_SERVICE:
            time.sleep(2)
            self._log("Simulating visual hover and 'Export Data' trigger", 50)
            time.sleep(1.5)
            
            # Create a mock Excel sheet and save it to test reading
            mock_excel_path = os.path.join(self.report_folder, f"data_export_{self.job_id}.xlsx")
            df = pd.DataFrame({
                "Date": ["2025-01-01", "2025-01-02", "2025-01-03"],
                "Region": ["East", "West", "Central"],
                "Total Revenue": [1000.0, 1500.0, 1200.0]
            })
            df.to_excel(mock_excel_path, index=False)
            
            self._log("Mock data download intercepted", 75)
            
            # Read and validate
            try:
                read_df = pd.read_excel(mock_excel_path)
                num_rows = len(read_df)
                columns = list(read_df.columns)
                
                self._log(f"Validated Excel export. Found {num_rows} records and columns: {columns}", 90)
                
                # Check naming standard check inside the downloaded Excel file too!
                # E.g. checks if columns contain spaces, violating column patterns
                violations = []
                for col in columns:
                    if " " in col:
                        violations.append(f"Column '{col}' in exported data contains spaces.")
                        
                if violations:
                    return {
                        "target": "Playwright: Excel Data Export",
                        "category": "export_excel",
                        "status": "warning",
                        "message": f"Excel file exported successfully with {num_rows} rows, but column schema violates naming standards: {', '.join(violations)}",
                        "suggested_fix": "Rename columns in the visual's parent fields (in Power BI Desktop) to PascalCase to align Excel export fields with database schemas."
                    }
                else:
                    return {
                        "target": "Playwright: Excel Data Export",
                        "category": "export_excel",
                        "status": "pass",
                        "message": f"Successfully exported Excel data with {num_rows} records. Columns validated.",
                        "suggested_fix": ""
                    }
            except Exception as e:
                return {
                    "target": "Playwright: Excel Data Export",
                    "category": "export_excel",
                    "status": "fail",
                    "message": f"Failed to parse downloaded Excel file: {str(e)}",
                    "suggested_fix": "Check visual configuration or Power BI service export restrictions."
                }

        # Real Playwright Excel Download Automation
        try:
            from playwright.sync_api import sync_playwright
            
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                state_path = os.path.join(Config.BASE_DIR, "storageState.json")
                
                if os.path.exists(state_path):
                    context = browser.new_context(storage_state=state_path)
                else:
                    context = browser.new_context()

                page = context.new_page()
                page.goto(report_url)
                
                # Wait for visual visual-container to load
                page.wait_for_selector(".visual-container", timeout=15000)
                
                # Hover on first visual container to reveal visual header icons
                first_visual = page.locator(".visual-container").first
                first_visual.hover()
                
                # Click the ellipsis / "More options" button
                more_options = first_visual.locator("button[title='More options']").first
                more_options.click()
                
                # Wait for menu, click "Export data"
                page.wait_for_selector(".vcMenuContainer", timeout=5000)
                export_btn = page.locator("text='Export data'").first
                
                # Intercept the download
                with page.expect_download() as download_info:
                    export_btn.click()
                    
                    # If dialogue opens, click "Export"
                    if page.locator("button:has-text('Export')").is_visible():
                        page.locator("button:has-text('Export')").click()
                        
                download = download_info.value
                excel_path = os.path.join(self.report_folder, f"data_export_{self.job_id}.xlsx")
                download.save_as(excel_path)
                browser.close()
                
                # Open Excel and validate
                df = pd.read_excel(excel_path)
                return {
                    "target": "Playwright: Excel Data Export",
                    "category": "export_excel",
                    "status": "pass",
                    "message": f"Successfully exported visual data. Row count: {len(df)}. Column columns: {list(df.columns)}",
                    "suggested_fix": ""
                }
                
        except Exception as ex:
            self._log(f"Excel export automation failed: {ex}", 90)
            return {
                "target": "Playwright: Excel Data Export",
                "category": "export_excel",
                "status": "fail",
                "message": f"Playwright visual automation failed to export excel sheet: {str(ex)}",
                "suggested_fix": "Ensure user has export rights, visual allows data exports, and page layout has visual containers visible."
            }
