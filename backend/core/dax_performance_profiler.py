import re

class DaxPerformanceProfiler:
    """
    Deep DAX Engine and Query Performance Profiler.
    Calculates Storage Engine (SE / VertiPaq) vs. Formula Engine (FE) workload ratio,
    estimates query execution duration (ms), identifies performance anti-patterns,
    and generates optimized DAX recommendations.
    """

    @classmethod
    def profile_measure(cls, name, expression, table_name="Model"):
        """
        Profiles an individual DAX measure or calculated column.
        Returns:
            dict containing SE/FE breakdown, estimated ms, bottleneck diagnostics,
            optimization tier, and refactored DAX formula.
        """
        expression = expression or ""
        clean_expr = expression.strip()
        expr_len = len(clean_expr)

        # Detect Formula Engine (FE) Anti-Patterns
        bottlenecks = []
        fe_weight = 10  # Base Formula Engine weight
        se_weight = 90  # Base Storage Engine weight

        # 1. Iterators over entire tables
        iterators = ["SUMX", "AVERAGEX", "COUNTX", "MINX", "MAXX", "RANKX", "CONCATENATEX", "GEOMEANX"]
        found_iterators = []
        for it in iterators:
            if re.search(rf"\b{it}\s*\(", clean_expr, re.IGNORECASE):
                found_iterators.append(it)
                fe_weight += 30
                se_weight -= 25

        if found_iterators:
            bottlenecks.append({
                "type": "Row-by-Row Iterator Overhead",
                "severity": "high" if len(found_iterators) > 1 else "medium",
                "description": f"Uses iterative function(s) {', '.join(found_iterators)}. When iterating un-filtered tables, this forces single-threaded row-by-row CPU execution on the Formula Engine.",
                "recommendation": "Filter the iteration table first using KEEPFILTERS or summarize dimensions before aggregating."
            })

        # 2. FILTER(ALL(...)) anti-pattern
        if re.search(r"\bFILTER\s*\(\s*ALL\s*\(", clean_expr, re.IGNORECASE):
            fe_weight += 35
            se_weight -= 30
            bottlenecks.append({
                "type": "FILTER(ALL(...)) Table Scan",
                "severity": "critical",
                "description": "Uses 'FILTER(ALL(...))' which instantiates a temporary in-memory materialized table on the Formula Engine instead of leveraging VertiPaq index predicates.",
                "recommendation": "Replace 'FILTER(ALL(Table[Col]), Table[Col] = x)' with direct predicate filter syntax 'Table[Col] = x' or 'KEEPFILTERS(TREATAS({x}, Table[Col]))'."
            })

        # 3. Multiple nested CALCULATE depth
        calculate_matches = re.findall(r"\bCALCULATE\b", clean_expr, re.IGNORECASE)
        if len(calculate_matches) >= 3:
            fe_weight += 25
            se_weight -= 20
            bottlenecks.append({
                "type": "Deep CALCULATE Context Transition Nesting",
                "severity": "medium",
                "description": f"Detected {len(calculate_matches)} nested CALCULATE statements. Multiple context transitions increase call-stack depth and prevent caching.",
                "recommendation": "Declare intermediate filter scopes into named variables (VAR) prior to CALCULATE evaluation."
            })

        # 4. EARLIER or scalar row context lookups
        if re.search(r"\bEARLIER\s*\(", clean_expr, re.IGNORECASE):
            fe_weight += 40
            se_weight -= 35
            bottlenecks.append({
                "type": "Quadratic EARLIER Complexity",
                "severity": "critical",
                "description": "Uses legacy EARLIER function, causing O(N^2) quadratic row-by-row comparisons on the Formula Engine.",
                "recommendation": "Refactor immediately using local variables 'VAR CurrentValue = Table[Column]'."
            })

        # 5. Non-Sargable string searches inside calculation
        if re.search(r"\b(SEARCH|CONTAINSSTRING|FIND)\s*\(", clean_expr, re.IGNORECASE):
            fe_weight += 20
            se_weight -= 15
            bottlenecks.append({
                "type": "Non-Sargable String Scan",
                "severity": "low",
                "description": "Text substring search function inside measure evaluation prevents columnar indexing.",
                "recommendation": "Pre-calculate categorical indicator flags in Power Query (M) or SQL source table."
            })

        # Normalize FE/SE weights to 100%
        fe_weight = max(5, min(95, fe_weight))
        se_weight = 100 - fe_weight

        # Estimate Execution Duration in milliseconds
        base_ms = 45
        length_penalty = expr_len * 0.35
        fe_penalty = (fe_weight / 100.0) * 480
        estimated_ms = int(base_ms + length_penalty + fe_penalty)

        # Performance Tier Classification
        if estimated_ms <= 180 and fe_weight <= 35:
            tier = "Fast (<180ms)"
            status = "pass"
        elif estimated_ms <= 450:
            tier = "Moderate (180ms–450ms)"
            status = "warning"
        else:
            tier = "Critical Bottleneck (>450ms)"
            status = "fail"

        # Generate Optimized DAX recommendation
        optimized_dax = cls._generate_optimized_dax(name, expression, bottlenecks)

        return {
            "name": name,
            "table": table_name,
            "expression": expression,
            "estimated_ms": estimated_ms,
            "formula_engine_pct": fe_weight,
            "storage_engine_pct": se_weight,
            "performance_tier": tier,
            "status": status,
            "bottlenecks": bottlenecks,
            "optimized_dax": optimized_dax
        }

    @classmethod
    def profile_all_measures(cls, dax_measures, dax_columns=None):
        """Profiles the full suite of DAX measures in the model."""
        profiles = []
        dax_columns = dax_columns or {}

        for name, expr in dax_measures.items():
            profile = cls.profile_measure(name, expr, table_name="Measures")
            profiles.append(profile)

        for name, expr in dax_columns.items():
            profile = cls.profile_measure(name, expr, table_name="Calculated Column")
            profiles.append(profile)

        # Model-wide summary statistics
        total_count = len(profiles)
        if total_count == 0:
            return {
                "summary": {
                    "total_measures": 0,
                    "avg_execution_ms": 0,
                    "avg_storage_engine_pct": 100,
                    "avg_formula_engine_pct": 0,
                    "fast_count": 0,
                    "moderate_count": 0,
                    "bottleneck_count": 0,
                    "overall_score": 100
                },
                "profiles": []
            }

        avg_ms = int(sum(p["estimated_ms"] for p in profiles) / total_count)
        avg_se = int(sum(p["storage_engine_pct"] for p in profiles) / total_count)
        avg_fe = 100 - avg_se
        fast_c = sum(1 for p in profiles if p["status"] == "pass")
        mod_c = sum(1 for p in profiles if p["status"] == "warning")
        bot_c = sum(1 for p in profiles if p["status"] == "fail")

        score = max(0, int((fast_c * 100 + mod_c * 65 + bot_c * 20) / total_count))

        return {
            "summary": {
                "total_measures": total_count,
                "avg_execution_ms": avg_ms,
                "avg_storage_engine_pct": avg_se,
                "avg_formula_engine_pct": avg_fe,
                "fast_count": fast_c,
                "moderate_count": mod_c,
                "bottleneck_count": bot_c,
                "overall_score": score
            },
            "profiles": profiles
        }

    @staticmethod
    def _generate_optimized_dax(name, expression, bottlenecks):
        if not bottlenecks or not expression.strip():
            return expression

        expr = expression.strip()
        # Transform FILTER(ALL(X), X = Y) into direct predicate
        optimized = re.sub(
            r"FILTER\s*\(\s*ALL\s*\(\s*([^,]+)\s*\)\s*,\s*([^)]+)\s*\)",
            r"KEEPFILTERS()",
            expr,
            flags=re.IGNORECASE
        )

        # Wrap in VAR / RETURN pattern if missing
        if not re.search(r"\bVAR\b", optimized, re.IGNORECASE):
            optimized = f"VAR _CalculatedValue =\n    {optimized}\nRETURN\n    _CalculatedValue"

        return optimized
