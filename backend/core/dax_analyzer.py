import re
from backend.core.naming_rules import NamingRulesEngine

class DaxAnalyzer:
    def __init__(self, rules_engine=None):
        self.rules_engine = rules_engine or NamingRulesEngine()
        self.config = self.rules_engine.config["dax_complexity"]

    def analyze_dax(self, name, expression, is_measure=True):
        """
        Runs rules checks on a DAX expression.
        Returns a list of violations (dicts) or empty list if passed.
        """
        violations = []
        expression = expression or ""
        
        # 1. Check name
        if is_measure:
            name_check = self.rules_engine.check_dax_measure_name(name)
            category = "dax_naming"
        else:
            name_check = self.rules_engine.check_dax_column_name(name)
            category = "dax_calculated_columns"
            
        if name_check["status"] != "pass":
            violations.append({
                "target": f"{'Measure' if is_measure else 'Column'}: {name}",
                "category": category,
                "status": name_check["status"],
                "message": name_check["message"],
                "suggested_fix": name_check["suggested_fix"]
            })
        else:
            violations.append({
                "target": f"{'Measure' if is_measure else 'Column'}: {name}",
                "category": category,
                "status": "pass",
                "message": f"Naming conforms to rules.",
                "suggested_fix": ""
            })

        # 2. Complexity check (VAR check)
        expr_len = len(expression)
        
        # Count target function calls (case-insensitive)
        nested_count = 0
        for func in self.config["functions_to_check"]:
            # Find all matches as words
            matches = re.findall(rf"\b{func}\b", expression, re.IGNORECASE)
            nested_count += len(matches)
            
        # Check if VAR keyword is used
        has_var = bool(re.search(r"\bVAR\b", expression))
        
        # Evaluate complexity rule:
        # Exceeds max length OR exceeds max nested functions AND has no variables
        is_complex = expr_len > self.config["max_length"] or nested_count >= self.config["max_nested_functions"]
        
        if is_complex and not has_var and self.config["require_var_if_complex"]:
            violations.append({
                "target": f"{'Measure' if is_measure else 'Column'}: {name}",
                "category": "dax_complexity",
                "status": "warning",
                "message": (f"DAX expression is complex (Length: {expr_len} chars, "
                            f"Contains {nested_count} nested engine functions like CALCULATE/FILTER/SWITCH) "
                            f"but does not declare variables (VAR)."),
                "suggested_fix": "Refactor the expression by declaring intermediate variables using 'VAR x = ...' and return them using 'RETURN ...' to improve readability and query plan caching."
            })
        elif expression.strip(): # if there is code
            violations.append({
                "target": f"{'Measure' if is_measure else 'Column'}: {name}",
                "category": "dax_complexity",
                "status": "pass",
                "message": f"Expression complexity is within acceptable limits.",
                "suggested_fix": ""
            })
            
        return violations

    def analyze_dataset(self, dax_measures, dax_columns, layout_str=None):
        """
        Check for unused measures and duplicate/reusable measures across the entire dataset.
        """
        violations = []
        
        # 1. Unused Measures Check
        for name, expr in dax_measures.items():
            is_referenced = False
            
            # Check other measures
            for other_name, other_expr in dax_measures.items():
                if other_name == name:
                    continue
                if re.search(r'\[\s*' + re.escape(name) + r'\s*\]', other_expr or ''):
                    is_referenced = True
                    break
                    
            if not is_referenced:
                # Check calculated columns
                for col_name, col_expr in dax_columns.items():
                    if re.search(r'\[\s*' + re.escape(name) + r'\s*\]', col_expr or ''):
                        is_referenced = True
                        break
                        
            if not is_referenced and layout_str:
                # Check layout JSON string
                if name.lower() in layout_str.lower():
                    is_referenced = True
                    
            if not is_referenced:
                msg = f"Measure '[{name}]' is defined in the model but is not referenced in any visual layouts, columns, or other measures."
                suggested = "Remove this unused measure from the model to clean up the schema, reduce file size, and improve performance."
                if not layout_str:
                    msg = f"Measure '[{name}]' is not referenced by any other DAX formulas in the model. (Note: Cloud analysis cannot verify visual-level references.)"
                    suggested = "Confirm if this measure is used in visual charts. If not, delete it to improve performance."
                    
                violations.append({
                    "target": f"Measure: {name}",
                    "category": "dax_complexity",
                    "status": "warning",
                    "message": msg,
                    "suggested_fix": suggested
                })
            else:
                violations.append({
                    "target": f"Measure: {name}",
                    "category": "dax_complexity",
                    "status": "pass",
                    "message": f"Measure '[{name}]' is actively referenced in the report.",
                    "suggested_fix": ""
                })
                
        # 2. Duplicate / Reusable Measures Check
        expr_to_names = {}
        for name, expr in dax_measures.items():
            clean_expr = re.sub(r'\s+', '', expr or '').lower()
            if not clean_expr:
                continue
            if clean_expr not in expr_to_names:
                expr_to_names[clean_expr] = []
            expr_to_names[clean_expr].append(name)
            
        for clean_expr, names in expr_to_names.items():
            if len(names) > 1:
                targets = ", ".join([f"[{n}]" for n in names])
                violations.append({
                    "target": f"Duplicate Measures: {names[0]}",
                    "category": "dax_complexity",
                    "status": "warning",
                    "message": f"Measures {targets} contain identical DAX expressions.",
                    "suggested_fix": f"Consolidate these duplicate definitions. Reuse the primary measure [{names[0]}] across all visuals and delete the others to keep the model clean."
                })
                
        return violations
