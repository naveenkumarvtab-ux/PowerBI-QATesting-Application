import json
import re
from pathlib import Path

class NamingRulesEngine:
    def __init__(self, config_path=None):
        if not config_path:
            config_path = Path(__file__).resolve().parent.parent / "rules_config.json"
        
        try:
            with open(config_path, "r") as f:
                self.config = json.load(f)
        except Exception:
            # Sensible fallback defaults
            self.config = {
                "power_query": {
                    "default_step_pattern": "^(Source|Changed Type|Filtered Rows|Renamed Columns|Removed Columns|Navigation)\\d*$",
                    "source_step_prefix": "^Src_",
                    "flag_inlined_source": True
                },
                "dax_measure": {
                    "pattern": "^[A-Z][a-zA-Z0-9_]*$",
                    "invalid_prefixes": ["Measure", "Calculated"],
                    "allowed_spaces": False
                },
                "dax_column": {
                    "pattern": "^[A-Z][a-zA-Z0-9_]*$",
                    "invalid_prefixes": ["Column"],
                    "allowed_spaces": False
                },
                "dax_complexity": {
                    "max_length": 150,
                    "max_nested_functions": 2,
                    "functions_to_check": ["CALCULATE", "FILTER", "SWITCH"],
                    "require_var_if_complex": True
                }
            }

    def check_pq_step_name(self, step_name):
        """
        Flag step names matching default patterns like 'Changed Type1', 'Filtered Rows2' etc.
        """
        pattern = self.config["power_query"]["default_step_pattern"]
        if re.match(pattern, step_name):
            return {
                "status": "warning",
                "message": f"Step name '{step_name}' uses Power BI's auto-generated pattern.",
                "suggested_fix": f"Rename '{step_name}' to a descriptive name representing what the step does (e.g. 'FilteredNulls' or 'ParsedJson')."
            }
        return {"status": "pass", "message": "", "suggested_fix": ""}

    def check_pq_source_step(self, step_name, all_steps):
        """
        Check if the first step starts with the required prefix or references system naming correctly.
        """
        prefix_pattern = self.config["power_query"]["source_step_prefix"]
        if not re.match(prefix_pattern, step_name):
            return {
                "status": "warning",
                "message": f"First step/source variable '{step_name}' does not follow naming standards.",
                "suggested_fix": f"Rename the source step '{step_name}' to start with '{prefix_pattern.replace('^', '')}' (e.g. 'Src_SalesDatabase') to distinguish data sources."
            }
        return {"status": "pass", "message": "", "suggested_fix": ""}

    def check_dax_measure_name(self, name):
        """
        Check if DAX measure matches the naming standards.
        """
        # 1. Spaces check
        if not self.config["dax_measure"]["allowed_spaces"] and " " in name:
            return {
                "status": "fail",
                "message": f"Measure name '{name}' contains spaces, which is forbidden.",
                "suggested_fix": f"Remove spaces and rename to PascalCase: '{name.replace(' ', '')}'."
            }
        
        # 2. Pattern check
        pattern = self.config["dax_measure"]["pattern"]
        if not re.match(pattern, name):
            return {
                "status": "warning",
                "message": f"Measure name '{name}' does not match pattern '{pattern}' (PascalCase).",
                "suggested_fix": f"Format measure name in PascalCase (e.g. 'TotalSalesRevenue')."
            }
            
        # 3. Invalid prefixes check
        for pref in self.config["dax_measure"]["invalid_prefixes"]:
            if name.lower().startswith(pref.lower()):
                return {
                    "status": "fail",
                    "message": f"Measure name '{name}' starts with invalid auto-generated prefix '{pref}'.",
                    "suggested_fix": f"Provide a descriptive business name instead of the default '{pref}' prefix."
                }
        return {"status": "pass", "message": "", "suggested_fix": ""}

    def check_dax_column_name(self, name):
        """
        Check if DAX calculated column matches naming standards.
        """
        # 1. Spaces check
        if not self.config["dax_column"]["allowed_spaces"] and " " in name:
            return {
                "status": "fail",
                "message": f"Calculated column name '{name}' contains spaces, which is forbidden.",
                "suggested_fix": f"Remove spaces and rename to PascalCase: '{name.replace(' ', '')}'."
            }
        
        # 2. Pattern check
        pattern = self.config["dax_column"]["pattern"]
        if not re.match(pattern, name):
            return {
                "status": "warning",
                "message": f"Calculated column name '{name}' does not match pattern '{pattern}'.",
                "suggested_fix": f"Format calculated column name in PascalCase (e.g. 'SalesDateKey')."
            }
            
        # 3. Invalid prefixes check
        for pref in self.config["dax_column"]["invalid_prefixes"]:
            if name.lower().startswith(pref.lower()):
                return {
                    "status": "fail",
                    "message": f"Calculated column name '{name}' starts with invalid auto-generated prefix '{pref}'.",
                    "suggested_fix": f"Provide a descriptive business name instead of the default '{pref}' prefix."
                }
        return {"status": "pass", "message": "", "suggested_fix": ""}
