import re
from backend.core.naming_rules import NamingRulesEngine

class MQueryAnalyzer:
    def __init__(self, rules_engine=None):
        self.rules_engine = rules_engine or NamingRulesEngine()
        self.config = self.rules_engine.config["power_query"]

    def extract_steps(self, m_code):
        """
        Extract Power Query step names from M expression using regex.
        Supports both bare steps (e.g. Source = ...) and quoted steps (e.g. #"Filtered Rows" = ...).
        """
        steps = []
        if not m_code:
            return steps
            
        # Strip comments to prevent false matches
        clean_code = re.sub(r"//.*", "", m_code)
        clean_code = re.sub(r"/\*.*?\*/", "", clean_code, flags=re.DOTALL)
        
        # Regex to capture assignments like Name = ... or #"Name with Spaces" = ...
        matches = re.finditer(r'(?:^|[\s,;])(#"[^"]+"|[a-zA-Z_][a-zA-Z0-9_\.]+)\s*=', clean_code)
        for m in matches:
            step = m.group(1).strip()
            # Remove quoted string surrounding
            if step.startswith('#"') and step.endswith('"'):
                step = step[2:-1]
            if step not in steps and step.lower() not in ('let', 'in', 'each', 'if', 'then', 'else'):
                steps.append(step)
        return steps

    def analyze_query(self, query_name, m_code):
        """
        Analyzes an M query's steps and structure.
        Returns a list of violations (dicts) or empty list.
        """
        violations = []
        m_code = m_code or ""
        
        steps = self.extract_steps(m_code)
        
        if not steps:
            # Empty query or failed to parse steps
            return [{
                "target": f"Query: {query_name}",
                "category": "power_query_naming",
                "status": "warning",
                "message": "Power Query code has no detectable steps or is empty.",
                "suggested_fix": "Add appropriate ingestion logic to this Power Query definition."
            }]

        # 1. Check if first step is source prefix
        first_step = steps[0]
        src_check = self.rules_engine.check_pq_source_step(first_step, steps)
        if src_check["status"] != "pass":
            violations.append({
                "target": f"Query: {query_name} (Step: {first_step})",
                "category": "power_query_naming",
                "status": src_check["status"],
                "message": src_check["message"],
                "suggested_fix": src_check["suggested_fix"]
            })
        else:
            violations.append({
                "target": f"Query: {query_name} (Step: {first_step})",
                "category": "power_query_naming",
                "status": "pass",
                "message": "Source step is named correctly.",
                "suggested_fix": ""
            })

        # 2. Check for inlined connections (e.g. directly calling Sql.Database without parameters)
        if self.config["flag_inlined_source"]:
            # If the source string contains server name, database name, folder paths hardcoded in quotes
            # and doesn't reference parameter objects
            # Simple check: search for patterns like Sql.Database("server", "db")
            # If there are multiple hardcoded string arguments in connection functions
            hardcoded_db = re.search(r'(Sql\.Database|Oracle\.Database|OData\.Feed|ActiveDirectory\.Domains)\s*\(\s*"[^"]+"', m_code, re.IGNORECASE)
            if hardcoded_db:
                violations.append({
                    "target": f"Query: {query_name}",
                    "category": "power_query_naming",
                    "status": "warning",
                    "message": "Data source connection parameters appear to be hardcoded inlined strings.",
                    "suggested_fix": "Extract database servers, file paths, and environment settings into Power Query parameters (e.g. #'ServerName' and #'DatabaseName') for dynamic configuration."
                })

        # 3. Check all steps for default naming conventions
        for step in steps:
            step_check = self.rules_engine.check_pq_step_name(step)
            if step_check["status"] != "pass":
                violations.append({
                    "target": f"Query: {query_name} (Step: {step})",
                    "category": "power_query_naming",
                    "status": step_check["status"],
                    "message": step_check["message"],
                    "suggested_fix": step_check["suggested_fix"]
                })
            else:
                violations.append({
                    "target": f"Query: {query_name} (Step: {step})",
                    "category": "power_query_naming",
                    "status": "pass",
                    "message": f"Step name '{step}' follows best practice conventions.",
                    "suggested_fix": ""
                })

        return violations
