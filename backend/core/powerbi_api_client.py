import os
import requests
import json
import time
from backend.config import Config

class PowerBIAPIClient:
    def __init__(self, token):
        self.token = token
        self.is_mock = not token or str(token).startswith("MOCK_")
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        self.base_url = "https://api.powerbi.com/v1.0/myorg"

    def _get(self, endpoint):
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        res = requests.get(url, headers=self.headers)
        res.raise_for_status()
        return res.json()

    def _post(self, endpoint, payload=None):
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        res = requests.post(url, headers=self.headers, json=payload)
        res.raise_for_status()
        return res.json()

    def get_report(self, workspace_id, report_id):
        """
        Gets details of a specific report.
        """
        if self.is_mock:
            return {
                "id": report_id,
                "name": "Mock Sales Analysis Report",
                "datasetId": "mock-dataset-uuid-11111",
                "webUrl": f"https://app.powerbi.com/groups/{workspace_id}/reports/{report_id}"
            }
        return self._get(f"groups/{workspace_id}/reports/{report_id}")

    def query_dataset_metadata(self, dataset_id):
        """
        Query dataset schema using executeQueries DMV API.
        Extracts M query partition formulas, DAX measures, and DAX calculated columns.
        """
        if self.is_mock:
            # Return realistic mock metadata for testing
            mock_m = {
                "Src_SalesData": "let\n    Source = Sql.Database(\"localhost\", \"SalesDB\"),\n    Sales_Table = Source{[Schema=\"dbo\",Item=\"Sales\"]}[Data],\n    #\"Changed Type\" = Table.TransformColumnTypes(Sales_Table,{{\"Amount\", type number}})\nin\n    #\"Changed Type\"",
                "Customers": "let\n    Source = OData.Feed(\"https://services.odata.org/V3/Northwind/Northwind.svc/\"),\n    #\"Filtered Rows2\" = Table.SelectRows(Source, each [Country] = \"USA\")\nin\n    #\"Filtered Rows2\"",
                "DateTable": "let\n    Source = List.Dates(#date(2025, 1, 1), 365, #duration(1, 0, 0, 0))\nin\n    Source"
            }
            mock_measures = {
                "Total Revenue": "SUM(Sales[Amount])",
                "TotalRevenue": "SUM(Sales[Amount])",
                "YTD_Sales": "CALCULATE(SUM(Sales[Amount]), DATESYTD(DateTable[Date]))",
                "ComplexMeasureNoVar": "CALCULATE(CALCULATE(SUM(Sales[Amount]), FILTER(Customers, Customers[Country] = \"USA\")), FILTER(DateTable, DateTable[Year] = 2025))"
            }
            mock_columns = {
                "Profit Margin": "Sales[Profit] / Sales[Revenue]",
                "ProfitMargin": "Sales[Profit] / Sales[Revenue]",
                "Column 1": "Sales[Quantity] * 2"
            }
            return {
                "m_queries": mock_m,
                "dax_measures": mock_measures,
                "dax_columns": mock_columns,
                "tables": ["Sheet1", "DateTable", "DisconnectedTable"],
                "relationships": [
                    {"FromTable": "Sheet1", "FromColumn": "order_date", "ToTable": "DateTable", "ToColumn": "Date"}
                ]
            }

        # 1. Fetch partitions (M code)
        m_queries = {}
        try:
            res_partitions = self._post(f"datasets/{dataset_id}/executeQueries", {
                "queries": [{"query": "EVALUATE INFO.PARTITIONS()"}],
                "serializerSettings": {"includeNulls": True}
            })
            rows = res_partitions["results"][0]["tables"][0]["rows"]
            for r in rows:
                p_name = r.get("Name", "Partition")
                p_expr = r.get("QueryDefinition") or r.get("Expression") or ""
                if p_expr.strip():
                    m_queries[p_name] = p_expr
        except Exception as e:
            print(f"Error querying partitions DMV: {e}")

        # 2. Fetch measures
        dax_measures = {}
        try:
            res_measures = self._post(f"datasets/{dataset_id}/executeQueries", {
                "queries": [{"query": "EVALUATE INFO.MEASURES()"}],
                "serializerSettings": {"includeNulls": True}
            })
            rows = res_measures["results"][0]["tables"][0]["rows"]
            for r in rows:
                m_name = r.get("Name")
                m_expr = r.get("Expression") or ""
                if m_name and m_expr.strip():
                    dax_measures[m_name] = m_expr
        except Exception as e:
            print(f"Error querying measures DMV: {e}")

        # 3. Fetch calculated columns
        dax_columns = {}
        try:
            res_columns = self._post(f"datasets/{dataset_id}/executeQueries", {
                "queries": [{"query": "EVALUATE INFO.COLUMNS()"}],
                "serializerSettings": {"includeNulls": True}
            })
            rows = res_columns["results"][0]["tables"][0]["rows"]
            for r in rows:
                c_name = r.get("Name")
                c_expr = r.get("Expression") or ""
                # Only keep columns that have expressions (calculated columns)
                if c_name and c_expr.strip():
                    dax_columns[c_name] = c_expr
        except Exception as e:
            print(f"Error querying columns DMV: {e}")

        # 4. Fetch relationships
        relationships = []
        try:
            res_rels = self._post(f"datasets/{dataset_id}/executeQueries", {
                "queries": [{"query": "EVALUATE INFO.RELATIONSHIPS()"}],
                "serializerSettings": {"includeNulls": True}
            })
            rows = res_rels["results"][0]["tables"][0]["rows"]
            for r in rows:
                # DMV returns IDs or Names depending on version. Try to map them safely
                from_t = r.get("FromTable") or r.get("FromTableID")
                from_c = r.get("FromColumn") or r.get("FromColumnID")
                to_t = r.get("ToTable") or r.get("ToTableID")
                to_c = r.get("ToColumn") or r.get("ToColumnID")
                if from_t and to_t:
                    relationships.append({
                        "FromTable": str(from_t),
                        "FromColumn": str(from_c) if from_c else "",
                        "ToTable": str(to_t),
                        "ToColumn": str(to_c) if to_c else ""
                    })
        except Exception as e:
            print(f"Error querying relationships DMV: {e}")

        # 5. Fetch tables
        tables = []
        try:
            res_tables = self._post(f"datasets/{dataset_id}/executeQueries", {
                "queries": [{"query": "EVALUATE INFO.TABLES()"}],
                "serializerSettings": {"includeNulls": True}
            })
            rows = res_tables["results"][0]["tables"][0]["rows"]
            for r in rows:
                t_name = r.get("Name")
                if t_name and not t_name.startswith(("DateTableTemplate_", "LocalDateTable_", "__")):
                    tables.append(str(t_name))
        except Exception as e:
            print(f"Error querying tables DMV: {e}")

        return {
            "m_queries": m_queries,
            "dax_measures": dax_measures,
            "dax_columns": dax_columns,
            "relationships": relationships,
            "tables": tables
        }

    def export_report_to_pdf(self, workspace_id, report_id, output_path):
        """
        Calls Export To File REST API and polls until download completes.
        Saves PDF to output_path.
        """
        if self.is_mock:
            # Simulate a 3 second delay and write a mock report pdf
            time.sleep(3)
            try:
                from reportlab.pdfgen import canvas
                c = canvas.Canvas(output_path)
                c.drawString(100, 750, "Mock Power BI PDF Report Export")
                c.drawString(100, 730, f"Report ID: {report_id}")
                c.drawString(100, 710, f"Workspace ID: {workspace_id}")
                c.showPage()
                c.save()
            except Exception:
                with open(output_path, "wb") as f:
                    f.write(b"%PDF-1.4\n" + b"%" + b"A"*2000 + b"\n%%EOF")
            return True

        # Start export job
        payload = {
            "format": "PDF"
        }
        res = self._post(f"groups/{workspace_id}/reports/{report_id}/ExportTo", payload)
        export_id = res["id"]

        # Poll status
        max_attempts = 30
        attempt = 0
        while attempt < max_attempts:
            status_res = self._get(f"groups/{workspace_id}/reports/{report_id}/exports/{export_id}")
            status = status_res.get("status")
            percent = status_res.get("percentComplete", 0)
            print(f"Export progress: {percent}% - Status: {status}")

            if status == "Succeeded":
                # Get the binary file
                url = f"{self.base_url}/groups/{workspace_id}/reports/{report_id}/exports/{export_id}/file"
                file_res = requests.get(url, headers=self.headers)
                file_res.raise_for_status()
                with open(output_path, "wb") as f:
                    f.write(file_res.content)
                return True
            elif status == "Failed":
                raise Exception("Power BI Export-To-File job failed on the service.")
            
            time.sleep(5)
            attempt += 1

        raise Exception("Export-To-File job timed out after 150 seconds.")

    def upload_pbix(self, workspace_id, file_path, report_name):
        """
        Uploads a PBIX file to a workspace.
        """
        if self.is_mock:
            time.sleep(2)
            return {
                "id": "mock-import-uuid-22222",
                "reports": [{"id": "mock-report-uuid-33333", "name": report_name, "webUrl": f"https://app.powerbi.com/groups/{workspace_id}/reports/mock-report-uuid-33333"}],
                "datasets": [{"id": "mock-dataset-uuid-11111"}]
            }
            
        url = f"{self.base_url}/groups/{workspace_id}/imports?datasetDisplayName={report_name}&nameConflict=Abort"
        with open(file_path, 'rb') as f:
            files = {
                'file': (os.path.basename(file_path), f, 'application/octet-stream')
            }
            headers = {
                "Authorization": f"Bearer {self.token}"
            }
            res = requests.post(url, headers=headers, files=files)
            res.raise_for_status()
            import_data = res.json()
            import_id = import_data["id"]
            
            # Poll import status
            attempts = 0
            while attempts < 20:
                status_res = requests.get(f"{self.base_url}/groups/{workspace_id}/imports/{import_id}", headers=self.headers)
                status_res.raise_for_status()
                status_data = status_res.json()
                if status_data.get("importState") == "Succeeded":
                    return status_data
                elif status_data.get("importState") == "Failed":
                    raise Exception("Failed to import PBIX to workspace.")
                time.sleep(3)
                attempts += 1
            raise Exception("Import operation timed out.")

    def delete_report(self, workspace_id, report_id):
        if self.is_mock:
            return True
        url = f"{self.base_url}/groups/{workspace_id}/reports/{report_id}"
        res = requests.delete(url, headers=self.headers)
        res.raise_for_status()
        return True

    def delete_dataset(self, workspace_id, dataset_id):
        if self.is_mock:
            return True
        url = f"{self.base_url}/groups/{workspace_id}/datasets/{dataset_id}"
        res = requests.delete(url, headers=self.headers)
        res.raise_for_status()
        return True

    def get_report_pages(self, workspace_id, report_id):
        """
        Gets pages of a specific report.
        """
        if self.is_mock:
            return {
                "value": [
                    {"name": "ReportSection1", "displayName": "Sales Overview"},
                    {"name": "ReportSection2", "displayName": "Customer Overview"},
                    {"name": "ReportSection3", "displayName": "Sales Trends"},
                    {"name": "ReportSection4", "displayName": "Shipping and Order Details"},
                    {"name": "ReportSection5", "displayName": "Maps"},
                    {"name": "ReportSection6", "displayName": "ToolTip"},
                    {"name": "ReportSection7", "displayName": "Page 1"}
                ]
            }
        return self._get(f"groups/{workspace_id}/reports/{report_id}/pages")

    def generate_embed_token(self, workspace_id, report_id):
        """
        Generates an embed token for a specific report in a workspace.
        """
        if self.is_mock:
            return "mock-embed-token-xyz-12345"
        payload = {
            "accessLevel": "View"
        }
        res = self._post(f"groups/{workspace_id}/reports/{report_id}/GenerateToken", payload)
        return res.get("token")

    def download_report_pbix(self, workspace_id, report_id):
        """
        Downloads report PBIX binary from Power BI Service to enable full layout analysis.
        Endpoint: GET https://api.powerbi.com/v1.0/myorg/groups/{workspace_id}/reports/{report_id}/Export
        """
        if self.is_mock:
            return None
        url = f"{self.base_url}/groups/{workspace_id}/reports/{report_id}/Export"
        res = requests.get(url, headers=self.headers, stream=True)
        if res.status_code == 200:
            os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
            target_path = os.path.join(Config.UPLOAD_FOLDER, f"service_{report_id}.pbix")
            with open(target_path, "wb") as f:
                for chunk in res.iter_content(chunk_size=65536):
                    f.write(chunk)
            return target_path
        else:
            print(f"PBIX export returned HTTP {res.status_code}")
            return None

