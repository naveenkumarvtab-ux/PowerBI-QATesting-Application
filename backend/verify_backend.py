import sys
import os

# Add parent directory to path to resolve imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def verify():
    print("=== STARTING PBI QA SUITE BACKEND VERIFICATION ===")
    
    try:
        from backend.config import Config
        print(f"1. Configuration loaded. Mock mode: {Config.MOCK_SERVICE}")
    except Exception as e:
        print(f"ERROR loading config: {e}")
        sys.exit(1)
        
    try:
        from backend.core.naming_rules import NamingRulesEngine
        engine = NamingRulesEngine()
        res = engine.check_dax_measure_name("invalid measure name")
        print(f"2. NamingRulesEngine loaded. Space validation: {res['status']} - {res['message']}")
    except Exception as e:
        print(f"ERROR loading NamingRulesEngine: {e}")
        sys.exit(1)
        
    try:
        from backend.core.dax_analyzer import DaxAnalyzer
        analyzer = DaxAnalyzer()
        violations = analyzer.analyze_dax("TotalSales", "CALCULATE(CALCULATE(SUM(Sales[Amount]), FILTER(Customers, Customers[Age] > 30)), FILTER(Region, Region[Name] = \"East\"))", is_measure=True)
        print(f"3. DaxAnalyzer loaded. Found {len(violations)} violations for nested complex DAX.")
        for v in violations:
            print(f"   - {v['category']}: {v['status']} - {v['message']}")
    except Exception as e:
        print(f"ERROR loading DaxAnalyzer: {e}")
        sys.exit(1)
        
    try:
        from backend.core.mquery_analyzer import MQueryAnalyzer
        m_anal = MQueryAnalyzer()
        steps = m_anal.extract_steps('let Source = Sql.Database("localhost", "DB"), #"Changed Type" = Table.TransformColumnTypes(Source) in #"Changed Type"')
        print(f"4. MQueryAnalyzer loaded. Extracted steps: {steps}")
    except Exception as e:
        print(f"ERROR loading MQueryAnalyzer: {e}")
        sys.exit(1)
        
    try:
        from backend.core.pbix_parser import PBIXParser
        parser = PBIXParser("dummy.pbix")
        print("5. PBIXParser loaded successfully.")
    except Exception as e:
        print(f"ERROR loading PBIXParser: {e}")
        sys.exit(1)

    try:
        from backend.core.report_builder import ReportBuilder
        print("6. ReportBuilder loaded successfully.")
    except Exception as e:
        print(f"ERROR loading ReportBuilder: {e}")
        sys.exit(1)

    try:
        from backend.app import create_app
        app = create_app()
        print("7. Flask application factory instantiated successfully.")
    except Exception as e:
        print(f"ERROR loading Flask application: {e}")
        sys.exit(1)

    print("=== BACKEND VERIFICATION SUCCESSFUL ===")

if __name__ == "__main__":
    verify()
