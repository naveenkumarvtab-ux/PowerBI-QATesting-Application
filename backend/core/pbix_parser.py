import os
import re
import zipfile
import json
import io

def is_page_hidden(sec):
    if sec.get("visibility") == 1:
        return True
    config_str = sec.get("config")
    if config_str:
        try:
            config = json.loads(config_str)
            if config.get("visibility") == 1:
                return True
        except Exception:
            pass
    return False

class PBIXParser:
    def __init__(self, file_path):
        self.file_path = file_path
        self.m_queries = {}
        self.dax_measures = {}
        self.dax_columns = {}
        self.pages = []
        self.bookmarks = []
        self.layout_str = ""
        self.layout_violations = []
        self.page_bookmarks = {}
        self.page_slicers = {}
        self.theme_json = {}
        self.total_measures = 0
        self.unused_measures_count = 0
        self.total_columns = 0
        self.unused_columns_count = 0

    def parse(self):
        """
        Attempts to parse the PBIX using pbixray.
        If that fails or pbixray is unavailable, falls back to direct ZIP parsing.
        """
        parsed_via_library = False
        try:
            from pbixray import PBIXRay
            model = PBIXRay(self.file_path)
            
            # Extract Power Query
            if hasattr(model, 'power_query') and model.power_query is not None:
                import pandas as pd
                if isinstance(model.power_query, pd.DataFrame) and not model.power_query.empty:
                    for _, row in model.power_query.iterrows():
                        qname = row.get("TableName")
                        qcode = row.get("Expression")
                        if qname and qcode:
                            self.m_queries[str(qname)] = str(qcode)
                elif isinstance(model.power_query, dict):
                    self.m_queries = model.power_query
                
            # Extract DAX Measures
            if hasattr(model, 'dax_measures') and model.dax_measures is not None:
                import pandas as pd
                if isinstance(model.dax_measures, pd.DataFrame) and not model.dax_measures.empty:
                    for _, row in model.dax_measures.iterrows():
                        name = row.get("Name") or row.get("Measure") or row.get("measure_name")
                        expr = row.get("Expression") or row.get("Formula") or row.get("measure_expression")
                        if name and expr:
                            self.dax_measures[str(name)] = str(expr)
                elif isinstance(model.dax_measures, dict):
                    self.dax_measures = model.dax_measures

            # Extract DAX Columns
            if hasattr(model, 'dax_columns') and model.dax_columns is not None:
                import pandas as pd
                if isinstance(model.dax_columns, pd.DataFrame) and not model.dax_columns.empty:
                    for _, row in model.dax_columns.iterrows():
                        name = row.get("ColumnName") or row.get("Column") or row.get("Name") or row.get("column_name")
                        expr = row.get("Expression") or row.get("Formula") or row.get("column_expression")
                        if name and expr:
                            self.dax_columns[str(name)] = str(expr)
                elif isinstance(model.dax_columns, dict):
                    self.dax_columns = model.dax_columns
                            
            parsed_via_library = True
        except Exception as e:
            print(f"pbixray parsing failed or was not installed. Error: {e}. Falling back to manual zip extraction...")

        # Collect model tables, columns, relationships, hierarchies
        columns_df = None
        levels_df = None
        relationships_df = None
        tables_list = []
        
        if parsed_via_library:
            columns_df = getattr(model, "tmschema_columns", None)
            levels_df = getattr(model, "tmschema_levels", None)
            relationships_df = getattr(model, "relationships", None)
            if hasattr(model, "tables") and model.tables is not None:
                tables_list = [str(t) for t in list(model.tables) if not str(t).startswith(("DateTableTemplate_", "LocalDateTable_", "__"))]
        else:
            tables_list = getattr(self, "tables_list", [])
            rels = getattr(self, "relationships_list", [])
            if rels:
                import pandas as pd
                relationships_df = pd.DataFrame(rels)

        # Fallback manual extraction
        self._manual_extraction()
        
        # Run new layout-level checks if layout string is present
        if self.layout_str:
            try:
                layout = json.loads(self.layout_str)
                # 1. Font Consistency Check
                try:
                    font_violations = check_font_consistency(layout, self.theme_json)
                    self.layout_violations.extend(font_violations)
                except Exception as fe:
                    print(f"Font consistency check failed: {fe}")
                    self.layout_violations.append({
                        "target": "Font Consistency (Report-wide)",
                        "category": "font_consistency",
                        "status": "fail",
                        "message": f"Check could not complete: {str(fe)}",
                        "suggested_fix": "Internal error — see application logs for stack trace."
                    })
                
                # 2. Visual Alignment Check
                try:
                    align_violations = check_visual_alignment(layout)
                    self.layout_violations.extend(align_violations)
                except Exception as ae:
                    print(f"Visual alignment check failed: {ae}")
                    self.layout_violations.append({
                        "target": "Visual Alignment (Report-wide)",
                        "category": "visual_alignment",
                        "status": "fail",
                        "message": f"Check could not complete: {str(ae)}",
                        "suggested_fix": "Internal error — see application logs for stack trace."
                    })
                    
                # 3. Run Unused Measures Check
                try:
                    unused_violations, total_m, unused_m = check_unused_measures(
                        self.dax_measures, self.dax_columns, layout
                    )
                    self.layout_violations.extend(unused_violations)
                    self.total_measures = total_m
                    self.unused_measures_count = unused_m
                except Exception as ue:
                    print(f"Unused measures check failed: {ue}")
                    self.layout_violations.append({
                        "target": "Unused Measures (Report-wide)",
                        "category": "unused_measures",
                        "status": "fail",
                        "message": f"Check could not complete: {str(ue)}",
                        "suggested_fix": "Internal error — see application logs for stack trace."
                    })
                    
                # 4. Run Unused Columns Check
                try:
                    unused_col_violations, total_c, unused_c = check_unused_columns(
                        columns_df, levels_df, relationships_df, layout, self.dax_measures, self.dax_columns
                    )
                    self.layout_violations.extend(unused_col_violations)
                    self.total_columns = total_c
                    self.unused_columns_count = unused_c
                except Exception as ce:
                    print(f"Unused columns check failed: {ce}")
                    self.layout_violations.append({
                        "target": "Unused Columns (Report-wide)",
                        "category": "unused_columns",
                        "status": "fail",
                        "message": f"Check could not complete: {str(ce)}",
                        "suggested_fix": "Internal error — see application logs for stack trace."
                    })
                    
                # 5. Run Disconnected Tables Check
                try:
                    data_model_violations = check_disconnected_tables(tables_list, relationships_df)
                    self.layout_violations.extend(data_model_violations)
                except Exception as de:
                    print(f"Disconnected tables check failed: {de}")
                    self.layout_violations.append({
                        "target": "Data Model Alignment (Report-wide)",
                        "category": "data_model",
                        "status": "fail",
                        "message": f"Check could not complete: {str(de)}",
                        "suggested_fix": "Internal error — see application logs for stack trace."
                    })
            except Exception as le:
                print(f"Failed to parse layout JSON for layout-level checks: {le}")
        
        # Deduplicate and return
        return {
            "m_queries": self.m_queries,
            "dax_measures": self.dax_measures,
            "dax_columns": self.dax_columns,
            "pages": self.pages,
            "bookmarks": self.bookmarks,
            "layout_str": self.layout_str,
            "layout_violations": self.layout_violations,
            "page_bookmarks": self.page_bookmarks,
            "page_slicers": self.page_slicers,
            "total_measures": self.total_measures,
            "unused_measures_count": self.unused_measures_count,
            "total_columns": self.total_columns,
            "unused_columns_count": self.unused_columns_count
        }

    def _manual_extraction(self):
        """
        Manually extract details from the zip structure.
        M-Query is located in DataMashup -> Formulas/Section1.m
        Layout, pages, and visual-level measures are located in Report/Layout
        """
        if not os.path.exists(self.file_path):
            return

        try:
            with zipfile.ZipFile(self.file_path, 'r') as z:
                names = z.namelist()
                
                # 1. Parse DataMashup for M Queries
                if 'DataMashup' in names:
                    try:
                        dm_bytes = z.read('DataMashup')
                        # Search for ZIP signature PK\x03\x04
                        zip_idx = dm_bytes.find(b'PK\x03\x04')
                        if zip_idx != -1:
                            zip_data = dm_bytes[zip_idx:]
                            with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as dm_zip:
                                if 'Formulas/Section1.m' in dm_zip.namelist():
                                    section_m = dm_zip.read('Formulas/Section1.m').decode('utf-8', errors='ignore')
                                    # Split by "shared" blocks
                                    parts = re.split(r'\bshared\s+', section_m)
                                    for part in parts:
                                        if '=' in part:
                                            name_part, code_part = part.split('=', 1)
                                            qname = name_part.strip()
                                            if qname.startswith('#"') and qname.endswith('"'):
                                                qname = qname[2:-1]
                                            
                                            qcode = code_part.strip()
                                            # Strip trailing semicolons or spaces
                                            if qcode.endswith(';'):
                                                qcode = qcode[:-1].strip()
                                            
                                            if qname and qname != "Section1" and qname not in self.m_queries:
                                                self.m_queries[qname] = qcode
                    except Exception as e:
                        print(f"Fallback M-Query extraction failed: {e}")

                # 2. Parse Theme File
                self.theme_json = {}
                for name in names:
                    if name.endswith('.json') and 'theme' in name.lower():
                        try:
                            theme_bytes = z.read(name)
                            theme_str = theme_bytes.decode('utf-8', errors='ignore')
                            self.theme_json = json.loads(theme_str)
                            break
                        except Exception as te:
                            print(f"Failed to read theme file {name}: {te}")

                # 3. Parse Layout for reports, pages, and some measures
                layout_str = None
                if 'Report/Layout' in names:
                    try:
                        layout_bytes = z.read('Report/Layout')
                        try:
                            layout_str = layout_bytes.decode('utf-16-le')
                        except UnicodeDecodeError:
                            layout_str = layout_bytes.decode('utf-8', errors='ignore')
                    except Exception as e:
                        print(f"Failed to read monolithic Report/Layout: {e}")
                else:
                    try:
                        layout_str = self._compile_fabric_layout(names, z)
                    except Exception as fe:
                        print(f"Failed to compile Fabric layout tree: {fe}")
                        
                if layout_str:
                    self.layout_str = layout_str
                    try:
                        layout = json.loads(layout_str)
                        
                        # Extract Pages
                        if 'sections' in layout:
                            for sec in layout['sections']:
                                # Skip hidden pages/sheets (visibility == 1 represents hidden in Power BI Layout)
                                if is_page_hidden(sec):
                                    continue
                                    
                                page_name = sec.get('displayName') or sec.get('name')
                                if page_name and page_name not in self.pages:
                                    self.pages.append(page_name)
                                    
                                # Scan visual containers on this page for actions, exports, and slicers
                                page_slicers_list = []
                                all_page_vcs = self._collect_visual_containers_recursive(sec.get('visualContainers', []))
                                for vc in all_page_vcs:
                                    vc_config_str = vc.get('config')
                                    if vc_config_str:
                                        try:
                                            vc_config = json.loads(vc_config_str)
                                            self._check_visual_container_export_setting(page_name, vc_config)
                                            
                                            # Check visualType
                                            single_visual = vc_config.get("singleVisual", {})
                                            if single_visual.get("visualType") == "slicer":
                                                display_name = "Slicer"
                                                data_trans = single_visual.get("dataTransforms", {})
                                                selects = data_trans.get("selects", [])
                                                if selects and isinstance(selects, list):
                                                    display_name = selects[0].get("displayName", "Slicer")
                                                page_slicers_list.append(display_name)
                                        except Exception:
                                            pass
                                if page_slicers_list:
                                    self.page_slicers[page_name] = page_slicers_list
                                    
                                # Look for visual-level bookmarks if defined inside config
                                config_str = sec.get('config')
                                if config_str:
                                    try:
                                        config = json.loads(config_str)
                                        # Parse bookmarks
                                        page_bmarks = []
                                        for bookmark in config.get('bookmarks', []):
                                            b_name = bookmark.get('displayName')
                                            if b_name:
                                                page_bmarks.append(b_name)
                                                if b_name not in self.bookmarks:
                                                    self.bookmarks.append(b_name)
                                        if page_bmarks:
                                            self.page_bookmarks[page_name] = page_bmarks
                                    except Exception:
                                        pass
                                         
                        # Parse root-level bookmarks in Layout config string
                        section_names_to_display = {}
                        for sec in layout.get('sections', []):
                            if is_page_hidden(sec):
                                continue
                            section_names_to_display[sec.get('name')] = sec.get('displayName') or sec.get('name')
                            
                        root_config_str = layout.get("config")
                        root_bookmarks = []
                        if root_config_str:
                            try:
                                root_config = json.loads(root_config_str)
                                root_bookmarks = root_config.get("bookmarks", [])
                            except Exception:
                                pass
                                
                        if isinstance(root_bookmarks, list):
                            for b in root_bookmarks:
                                b_name = b.get("displayName") or b.get("name")
                                if b_name:
                                    if b_name not in self.bookmarks:
                                        self.bookmarks.append(b_name)
                                    sec_key = b.get("mainSectionKey")
                                    if not sec_key and "explorationState" in b and isinstance(b["explorationState"], dict):
                                        sec_key = b["explorationState"].get("activeSection")
                                    if sec_key:
                                        page_disp = section_names_to_display.get(sec_key)
                                        if page_disp:
                                            if page_disp not in self.page_bookmarks:
                                                self.page_bookmarks[page_disp] = []
                                            if b_name not in self.page_bookmarks[page_disp]:
                                                self.page_bookmarks[page_disp].append(b_name)
                                                 
                        # Perform static validation of visual actions
                        try:
                            action_violations = validate_visual_actions(layout)
                            self.layout_violations.extend(action_violations)
                        except Exception as ae:
                            print(f"Static visual actions validation failed: {ae}")
                            self.layout_violations.append({
                                "target": "Visual Page Navigation (Page: Sales Overview)",
                                "category": "functional",
                                "status": "fail",
                                "message": f"Check could not complete: {str(ae)}",
                                "suggested_fix": "Internal error — see application logs for stack trace."
                            })
                                                 
                        # Recursive search in layout configuration for measures / calculations
                        self._extract_measures_from_layout_json(layout)
                    except Exception as e:
                        print(f"Fallback Layout extraction failed: {e}")
                        
        except Exception as e:
            print(f"Failed to open zip file {self.file_path}: {e}")

    def _compile_fabric_layout(self, names, z):
        """
        Compiles the individual Fabric developer mode JSON files into a monolithic layout JSON string.
        """
        pages_metadata_path = None
        for name in names:
            if name.endswith("pages.json") and "Report/definition/pages/" in name:
                pages_metadata_path = name
                break
        if not pages_metadata_path:
            return None
            
        try:
            pages_meta = json.loads(z.read(pages_metadata_path).decode("utf-8-sig"))
            page_order = pages_meta.get("pageOrder", [])
        except Exception as e:
            print(f"Failed to parse pages.json: {e}")
            return None
            
        sections = []
        for page_id in page_order:
            page_json_path = f"Report/definition/pages/{page_id}/page.json"
            if page_json_path not in names:
                continue
                
            try:
                page_data = json.loads(z.read(page_json_path).decode("utf-8-sig"))
            except Exception as e:
                print(f"Failed to parse page.json for page {page_id}: {e}")
                continue
                
            page_name = page_data.get("displayName") or page_data.get("name")
            visibility = 1 if page_data.get("visibility") in ("Hidden", 1) else 0
            
            visual_containers = []
            prefix = f"Report/definition/pages/{page_id}/visuals/"
            for name in names:
                if name.startswith(prefix) and name.endswith("visual.json"):
                    try:
                        vis_data = json.loads(z.read(name).decode("utf-8-sig"))
                        v_name = vis_data.get("name")
                        position = vis_data.get("position", {})
                        visual = vis_data.get("visual", {})
                        
                        vc_objects = {}
                        if "visualContainerObjects" in visual:
                            vc_objects = visual.get("visualContainerObjects") or {}
                        elif "objects" in visual:
                            vc_objects = visual.get("objects") or {}
                            
                        config_dict = {
                            "singleVisual": {
                                "visualType": visual.get("visualType"),
                                "projections": visual.get("query", {}).get("queryState", {}),
                                "objects": visual.get("objects", {}),
                                "vcObjects": vc_objects
                            }
                        }
                        
                        vc = {
                            "name": v_name,
                            "x": position.get("x"),
                            "y": position.get("y"),
                            "width": position.get("width"),
                            "height": position.get("height"),
                            "z": position.get("z"),
                            "config": json.dumps(config_dict)
                        }
                        visual_containers.append(vc)
                    except Exception as ve:
                        print(f"Failed to parse visual {name}: {ve}")
                        
            sections.append({
                "name": page_id,
                "displayName": page_name,
                "visibility": visibility,
                "visualContainers": visual_containers,
                "filters": json.dumps(page_data.get("filters", [])) if "filters" in page_data else None,
                "config": json.dumps(page_data.get("objects", {}))
            })
            
        layout_dict = {
            "sections": sections
        }
        return json.dumps(layout_dict)

    def _extract_measures_from_layout_json(self, node):
        """
        Recursively searches the Layout JSON for measure references or expressions.
        Visuals often define custom measures or store expressions in configuration properties.
        """
        if isinstance(node, dict):
            # Check for expression objects, e.g. "Expression": { "SourceRef": ... } or similar
            # And look for keys containing DAX or formulas
            for k, v in node.items():
                if k == "config" and isinstance(v, str):
                    try:
                        config_data = json.loads(v)
                        self._extract_measures_from_layout_json(config_data)
                    except Exception:
                        pass
                elif k == "expression" and isinstance(v, dict):
                    # Check for calculated expressions in Visuals
                    formula = v.get("formula") or v.get("expression")
                    name = v.get("name")
                    if name and formula:
                        self.dax_measures[str(name)] = str(formula)
                else:
                    self._extract_measures_from_layout_json(v)
        elif isinstance(node, list):
            for item in node:
                self._extract_measures_from_layout_json(item)



    def _check_visual_container_export_setting(self, page_name, node):
        """
        Recursively search the visual container config for exportData settings and verify they are enabled.
        """
        if isinstance(node, dict):
            # Check for showExportData property in visualHeader
            if "showExportData" in node:
                val = node["showExportData"]
                show_val = True
                if isinstance(val, dict):
                    prop_val = val.get("properties", {}).get("value", {}).get("expr", {})
                    if isinstance(prop_val, dict):
                        literal_val = prop_val.get("Literal", {}).get("Value", "")
                        if str(literal_val).lower() == "false":
                            show_val = False
                elif str(val).lower() == "false":
                    show_val = False
                
                if not show_val:
                    self.layout_violations.append({
                        "target": f"Visual Header Export Option (Page: {page_name})",
                        "category": "export_excel",
                        "status": "warning",
                        "message": f"A visual on page '{page_name}' has the 'Export data' header option disabled, preventing readers from exporting data to Excel.",
                        "suggested_fix": "Enable visual-header 'Export data' options in Power BI Desktop formatting pane under Visual Header options."
                    })
            
            # Recurse dictionary values
            for v in node.values():
                self._check_visual_container_export_setting(page_name, v)
        elif isinstance(node, list):
            for item in node:
                self._check_visual_container_export_setting(page_name, item)

    def _collect_visual_containers_recursive(self, vc_list):
        """
        Recursively extract child visuals inside grouped visual containers.
        Supports standard child containers ("children") and groups ("visualContainers").
        """
        all_vcs = []
        if not isinstance(vc_list, list):
            return all_vcs
        for vc in vc_list:
            if isinstance(vc, dict):
                all_vcs.append(vc)
                if "children" in vc:
                    all_vcs.extend(self._collect_visual_containers_recursive(vc["children"]))
                if "visualContainers" in vc:
                    all_vcs.extend(self._collect_visual_containers_recursive(vc["visualContainers"]))
        return all_vcs


def validate_visual_actions(layout_json):
    """
    Statically validates visual action configurations (PageNavigation, WebURL, Bookmark, Drillthrough).
    Returns a list of violation dictionaries.
    """
    violations = []
    if not isinstance(layout_json, dict):
        return violations
        
    sections = layout_json.get("sections", [])
    if not isinstance(sections, list):
        return violations
        
    # Helper to recursively collect all visuals inside a page (including nested children)
    def collect_visuals(vc_list):
        all_vcs = []
        if not isinstance(vc_list, list):
            return all_vcs
        for vc in vc_list:
            if isinstance(vc, dict):
                all_vcs.append(vc)
                if "children" in vc:
                    all_vcs.extend(collect_visuals(vc["children"]))
                if "visualContainers" in vc:
                    all_vcs.extend(collect_visuals(vc["visualContainers"]))
        return all_vcs

    # Helper to recursively extract literal values
    def extract_literal_val(node):
        if isinstance(node, dict):
            if "Literal" in node and isinstance(node["Literal"], dict):
                val = node["Literal"].get("Value", "")
                if isinstance(val, (str, int, float, bool)):
                    return str(val).strip("'\"")
            for v in node.values():
                val = extract_literal_val(v)
                if val is not None:
                    return val
        elif isinstance(node, list):
            for item in node:
                val = extract_literal_val(item)
                if val is not None:
                    return val
        return None

    # Helper to find any case-insensitive key matching action/visuallink recursively
    def scan_for_actions(node, page_name, visual_title="", visual_id=None):
        if isinstance(node, dict):
            action_data = None
            for k, v in node.items():
                if k.lower() in ("action", "visuallink"):
                    action_data = v
                    break
            
            if action_data:
                action_list = []
                if isinstance(action_data, list):
                    action_list = action_data
                elif isinstance(action_data, dict):
                    action_list = [action_data]
                    
                for act in action_list:
                    if not isinstance(act, dict):
                        continue
                    action_props = act.get("properties", {})
                    if not isinstance(action_props, dict):
                        continue
                        
                    # Check show state (default is True if action block is defined, but check for show key)
                    show_val = True
                    for pk, pv in action_props.items():
                        if pk.lower() == "show":
                            val_str = extract_literal_val(pv)
                            if val_str and val_str.lower() == "false":
                                show_val = False
                            break
                            
                    if not show_val:
                        continue
                        
                    # Find type
                    action_type = None
                    for pk, pv in action_props.items():
                        if pk.lower() == "type":
                            action_type = extract_literal_val(pv)
                            break
                            
                    suffix = f", Visual: {visual_title}" if visual_title else ""
                    
                    # If type is missing/None/empty, it defaults to PageNavigation with None destination -> FAIL
                    if not action_type or action_type.lower() in ("none", ""):
                        violations.append({
                            "target": f"Visual Page Navigation (Page: {page_name})",
                            "category": "functional",
                            "status": "fail",
                            "message": f"Visual on page '{page_name}' has action set to 'Page navigation' but destination is set to 'None'.",
                            "suggested_fix": "Set a valid page destination in the Action formatting pane or turn off Actions for this visual to avoid broken links.",
                            "page_name": page_name,
                            "visual_id": visual_id,
                            "visual_title": visual_title
                        })
                        continue
                        
                    action_type_lower = action_type.lower()
                    
                    if action_type_lower == "pagenavigation":
                        page_dest = None
                        for pk, pv in action_props.items():
                            if pk.lower() in ("page", "navigationsection"):
                                page_dest = extract_literal_val(pv)
                                break
                        if not page_dest or page_dest.lower() in ("none", ""):
                            violations.append({
                                "target": f"Visual Page Navigation (Page: {page_name})",
                                "category": "functional",
                                "status": "fail",
                                "message": f"Visual on page '{page_name}' has action set to 'Page navigation' but destination is set to 'None'.",
                                "suggested_fix": "Set a valid page destination in the Action formatting pane or turn off Actions for this visual to avoid broken links.",
                                "page_name": page_name,
                                "visual_id": visual_id,
                                "visual_title": visual_title
                            })
                        else:
                            violations.append({
                                "target": f"Visual Page Navigation (Page: {page_name})",
                                "category": "functional",
                                "status": "pass",
                                "message": "Navigation action is correctly configured with a valid destination.",
                                "suggested_fix": "",
                                "page_name": page_name,
                                "visual_id": visual_id,
                                "visual_title": visual_title
                            })
                    elif action_type_lower == "weburl":
                        web_url = None
                        for pk, pv in action_props.items():
                            if pk.lower() in ("url", "weburl"):
                                web_url = extract_literal_val(pv)
                                break
                        if not web_url or web_url.lower() in ("none", ""):
                            violations.append({
                                "target": f"Visual Web URL Navigation (Page: {page_name}{suffix})",
                                "category": "functional",
                                "status": "fail",
                                "message": f"Visual on page '{page_name}' has action set to 'Web URL' but URL is set to 'None' or is empty.",
                                "suggested_fix": "Provide a valid URL in the Web URL formatting pane or turn off Actions for this visual.",
                                "page_name": page_name,
                                "visual_id": visual_id,
                                "visual_title": visual_title
                            })
                    elif action_type_lower == "bookmark":
                        bookmark_dest = None
                        for pk, pv in action_props.items():
                            if pk.lower() in ("bookmark", "bookmarkname"):
                                bookmark_dest = extract_literal_val(pv)
                                break
                        if not bookmark_dest or bookmark_dest.lower() in ("none", ""):
                            violations.append({
                                "target": f"Visual Bookmark Action (Page: {page_name}{suffix})",
                                "category": "functional",
                                "status": "fail",
                                "message": f"Visual on page '{page_name}' has action set to 'Bookmark' but no bookmark is selected.",
                                "suggested_fix": "Select a valid bookmark in the Action formatting pane or turn off Actions for this visual.",
                                "page_name": page_name,
                                "visual_id": visual_id,
                                "visual_title": visual_title
                            })
                    elif action_type_lower == "drillthrough":
                        target_page = None
                        for pk, pv in action_props.items():
                            if pk.lower() in ("page", "targetpage", "drillthroughpage"):
                                target_page = extract_literal_val(pv)
                                break
                        if not target_page or target_page.lower() in ("none", ""):
                            violations.append({
                                "target": f"Visual Drillthrough (Page: {page_name}{suffix})",
                                "category": "functional",
                                "status": "fail",
                                "message": f"Visual on page '{page_name}' has action set to 'Drillthrough' but target page is set to 'None'.",
                                "suggested_fix": "Set a valid drillthrough target page in the Action formatting pane or turn off Actions for this visual.",
                                "page_name": page_name,
                                "visual_id": visual_id,
                                "visual_title": visual_title
                            })

            # Recurse dictionary values
            for v in node.values():
                scan_for_actions(v, page_name, visual_title, visual_id)
        elif isinstance(node, list):
            for item in node:
                scan_for_actions(item, page_name, visual_title, visual_id)

    for sec in sections:
        if is_page_hidden(sec):
            continue
        page_name = sec.get("displayName") or sec.get("name")
        visual_containers = collect_visuals(sec.get("visualContainers", []))
        
        for vc in visual_containers:
            visual_title = ""
            vc_config_str = vc.get("config")
            if vc_config_str:
                try:
                    vc_config = json.loads(vc_config_str)
                    single_visual = vc_config.get("singleVisual", {})
                    title_props = single_visual.get("objects", {}).get("title", [])
                    if title_props and isinstance(title_props, list):
                        for prop in title_props:
                            title_text = prop.get("properties", {}).get("text", {})
                            visual_title = title_text.get("expr", {}).get("Literal", {}).get("Value", "") or ""
                            visual_title = str(visual_title).strip("'\"")
                            if visual_title:
                                break
                    if not visual_title:
                        visual_title = single_visual.get("visualType") or ""
                        
                    # Perform static validation scan inside vc_config
                    scan_for_actions(vc_config, page_name, visual_title, vc.get("name"))
                except Exception:
                    pass
                    
    return violations


def check_font_consistency(layout_json, theme_json=None):
    """
    Detects if text elements across pages deviate from the dominant theme/report font.
    """
    theme_fonts = []
    if theme_json:
        # Check textClasses
        tc = theme_json.get("textClasses", {})
        for item in tc.values():
            if isinstance(item, dict):
                f = item.get("fontFace") or item.get("fontFamily")
                if f:
                    theme_fonts.append(f)
        # Check visualStyles recursively
        def find_visual_styles_fonts(node):
            res = []
            if isinstance(node, dict):
                for k, v in node.items():
                    if k in ("fontFace", "fontFamily") and isinstance(v, str):
                        res.append(v)
                    else:
                        res.extend(find_visual_styles_fonts(v))
            elif isinstance(node, list):
                for x in node:
                    res.extend(find_visual_styles_fonts(x))
            return res
        theme_fonts.extend(find_visual_styles_fonts(theme_json.get("visualStyles", {})))
        
def check_font_consistency(layout_json, theme_fonts=None):
    """
    Identifies visual elements on report pages that do not match the report standard for their role.
    Roles:
      - "header": visual title, column headers, axis titles
      - "value": data labels, card values, tick labels, legend labels, text runs
    Checks both font family and normalized size.
    """
    from collections import Counter
    import re
    
    if not layout_json:
        return []

    # Handle dictionary theme_fonts (compatibility with mock_theme)
    if isinstance(theme_fonts, dict):
        extracted_fonts = []
        def find_fonts_in_dict(node):
            if isinstance(node, dict):
                for k, v in node.items():
                    if k in ("fontFamily", "fontFace") and isinstance(v, str):
                        extracted_fonts.append(v.strip("'\""))
                    else:
                        find_fonts_in_dict(v)
            elif isinstance(node, list):
                for item in node:
                    find_fonts_in_dict(item)
        find_fonts_in_dict(theme_fonts)
        theme_fonts = extracted_fonts

    # 1. Fallback dominant family
    general_dominant_family = "Segoe UI"
    if theme_fonts:
        general_dominant_family = Counter(theme_fonts).most_common(1)[0][0]

    def extract_val(node):
        if isinstance(node, dict):
            if "Literal" in node and isinstance(node["Literal"], dict):
                val = node["Literal"].get("Value", "")
                if isinstance(val, (str, int, float, bool)):
                    return str(val).strip("'\"")
            for v in node.values():
                val = extract_val(v)
                if val is not None:
                    return val
        return None

    def normalize_size(val):
        if val is None:
            return None
        val_str = str(val).strip("'\"").strip()
        match = re.search(r'(\d+(?:\.\d+)?)', val_str)
        if match:
            num_str = match.group(1)
            if "." in num_str:
                return f"{float(num_str):.1f}pt"
            else:
                return f"{int(num_str)}pt"
        return None

    # Collect formatting elements grouped by visual container
    visuals_elements = {}
    all_elements = []

    sections = layout_json.get("sections", [])
    for sec in sections:
        if is_page_hidden(sec):
            continue
        page_name = sec.get("displayName") or sec.get("name")
        vcs = sec.get("visualContainers", [])
        
        for idx, vc in enumerate(vcs):
            vc_id = vc.get("name")
            config_str = vc.get("config")
            if not config_str:
                continue
            try:
                config = json.loads(config_str)
            except Exception:
                continue

            single_visual = config.get("singleVisual", {})
            v_type = single_visual.get("visualType") or "Visual"

            # Parse title
            visual_title = None
            title_objs = single_visual.get("vcObjects", {}).get("title", [])
            for tobj in title_objs:
                if isinstance(tobj, dict):
                    visual_title = extract_val(tobj.get("properties", {}).get("text"))
                    if visual_title:
                        break
            if not visual_title:
                visual_title = f"{v_type} #{idx}"

            vis_key = (page_name, visual_title, vc_id)
            if vis_key not in visuals_elements:
                visuals_elements[vis_key] = []

            # Recursive scanner for properties
            def scan_properties(node, current_path=[]):
                if not isinstance(node, dict):
                    return
                
                font_family = None
                font_size = None

                for family_key in ("fontFamily", "fontFace"):
                    if family_key in node:
                        val = node[family_key]
                        if isinstance(val, str):
                            font_family = val.strip("'\"")
                        elif isinstance(val, dict):
                            font_family = extract_val(val)
                        break

                for size_key in ("fontSize", "size"):
                    if size_key in node:
                        val = node[size_key]
                        if isinstance(val, (int, float, str)):
                            font_size = normalize_size(val)
                        elif isinstance(val, dict):
                            font_size = normalize_size(extract_val(val))
                        break

                if font_family or font_size:
                    path_str = ".".join(current_path).lower()
                    role = "other"
                    if "title" in path_str or "header" in path_str:
                        role = "header"
                    elif any(x in path_str for x in ("label", "value", "legend", "tick", "grid", "card", "textrun", "paragraph", "style")):
                        role = "value"
                    elif "tooltip" in path_str:
                        role = "tooltip"

                    elem_info = {
                        "role": role,
                        "font_family": font_family,
                        "font_size": font_size,
                        "path": ".".join(current_path)
                    }
                    visuals_elements[vis_key].append(elem_info)
                    all_elements.append(elem_info)

                for k, v in node.items():
                    if isinstance(v, dict):
                        scan_properties(v, current_path + [k])
                    elif isinstance(v, list):
                        for item_idx, item in enumerate(v):
                            if isinstance(item, dict):
                                scan_properties(item, current_path + [f"{k}[{item_idx}]"])

            scan_properties(config)

            # Insert default values
            has_explicit_header = any(el["role"] == "header" for el in visuals_elements[vis_key])
            has_explicit_value = any(el["role"] == "value" for el in visuals_elements[vis_key])

            if not has_explicit_header:
                elem_info = {
                    "role": "header",
                    "font_family": general_dominant_family,
                    "font_size": None,
                    "path": "default_theme"
                }
                visuals_elements[vis_key].append(elem_info)
                all_elements.append(elem_info)

            if not has_explicit_value:
                elem_info = {
                    "role": "value",
                    "font_family": general_dominant_family,
                    "font_size": None,
                    "path": "default_theme"
                }
                visuals_elements[vis_key].append(elem_info)
                all_elements.append(elem_info)

    # 2. Determine dominant family and size per role
    dominant_specs = {}
    for role in ("header", "value", "tooltip", "other"):
        role_families = [el["font_family"] for el in all_elements if el["role"] == role and el["font_family"]]
        role_sizes = [el["font_size"] for el in all_elements if el["role"] == role and el["font_size"]]

        dom_family = None
        if role_families:
            dom_family = Counter(role_families).most_common(1)[0][0]
        else:
            dom_family = general_dominant_family

        dom_size = None
        if role_sizes:
            dom_size = Counter(role_sizes).most_common(1)[0][0]

        dominant_specs[role] = {
            "font_family": dom_family,
            "font_size": dom_size
        }

    violations = []
    has_mismatch = False

    # 3. Check for mismatches per visual
    for (page_name, visual_title, vc_id), vis_elems in visuals_elements.items():
        issues = []
        for role in ("header", "value", "tooltip", "other"):
            role_elems = [el for el in vis_elems if el["role"] == role]
            family_mismatch = None
            size_mismatch = None
            dom = dominant_specs[role]

            for el in role_elems:
                # Flag family mismatch only if explicitly specified and differs
                if el["font_family"] and dom["font_family"] and el["font_family"].lower() != dom["font_family"].lower() and el["path"] != "default_theme":
                    family_mismatch = (el["font_family"], dom["font_family"])
                # Flag size mismatch only if explicitly specified and differs
                if el["font_size"] and dom["font_size"] and el["font_size"] != dom["font_size"] and el["path"] != "default_theme":
                    size_mismatch = (el["font_size"], dom["font_size"])

            if family_mismatch or size_mismatch:
                found_parts = []
                expected_parts = []
                if family_mismatch:
                    found_parts.append(family_mismatch[0])
                    expected_parts.append(family_mismatch[1])
                if size_mismatch:
                    found_parts.append(size_mismatch[0])
                    expected_parts.append(size_mismatch[1])
                
                found_str = " ".join(found_parts)
                expected_str = " ".join(expected_parts)
                issues.append(f"{role} uses '{found_str}' (report {role} standard is '{expected_str}')")

        if issues:
            has_mismatch = True
            violations.append({
                "category": "font_consistency",
                "status": "warning",
                "target": f"Font Consistency ({page_name} - {visual_title})",
                "message": f"Visual '{visual_title}' on page '{page_name}' has font inconsistencies: {'; '.join(issues)}.",
                "suggested_fix": "Update the flagged element(s) in the Format pane (or apply the report theme) to match the report's standard font/size for their role.",
                "page_name": page_name,
                "visual_id": vc_id,
                "visual_title": visual_title
            })

    # 4. Report-wide summary PASS if zero mismatches found
    if not has_mismatch:
        pass_parts = []
        for role in ("header", "value"):
            dom = dominant_specs[role]
            spec_parts = []
            if dom["font_family"]:
                spec_parts.append(dom["font_family"])
            if dom["font_size"]:
                spec_parts.append(dom["font_size"])
            if spec_parts:
                pass_parts.append(f"{role}s consistently use '{' '.join(spec_parts)}'")

        pass_message = "All text elements use a consistent font family."
        if pass_parts:
            pass_message = "All text elements use a consistent font family: " + " and ".join(pass_parts) + " across all pages."

        violations.append({
            "category": "font_consistency",
            "status": "pass",
            "target": "Font Consistency (Report-wide)",
            "message": pass_message,
            "suggested_fix": ""
        })

    return violations


def check_unused_measures(dax_measures, dax_columns, layout_json):
    """
    Identifies DAX measures in the model that are not visually referenced,
    filter referenced, or referenced via dependencies in other measures/columns.
    """
    used = set()
    usage_locations = {}
    
    # Helper to recursively scan layout node dictionaries/lists for field references
    def extract_fields_from_visual(node, page_name, visual_title):
        if isinstance(node, dict):
            # 1. "Property": "MeasureName"
            if "Property" in node and isinstance(node["Property"], str):
                prop = node["Property"]
                for m_name in dax_measures:
                    if prop.lower() == m_name.lower():
                        used.add(m_name)
                        if m_name not in usage_locations:
                            usage_locations[m_name] = f"visual '{visual_title}' on page '{page_name}'"
            # 2. "queryRef": "TableName.MeasureName" or "MeasureName"
            if "queryRef" in node and isinstance(node["queryRef"], str):
                ref = node["queryRef"]
                val = ref.split(".", 1)[1] if "." in ref else ref
                for m_name in dax_measures:
                    if val.lower() == m_name.lower():
                        used.add(m_name)
                        if m_name not in usage_locations:
                            usage_locations[m_name] = f"visual '{visual_title}' on page '{page_name}'"
            # 3. "displayName": "MeasureName"
            if "displayName" in node and isinstance(node["displayName"], str):
                disp = node["displayName"]
                for m_name in dax_measures:
                    if disp.lower() == m_name.lower():
                        used.add(m_name)
                        if m_name not in usage_locations:
                            usage_locations[m_name] = f"visual '{visual_title}' on page '{page_name}'"
            # Recurse
            for v in node.values():
                extract_fields_from_visual(v, page_name, visual_title)
        elif isinstance(node, list):
            for item in node:
                extract_fields_from_visual(item, page_name, visual_title)

    # Helper to extract a literal text value from title configurations
    def extract_lit_val(n):
        if isinstance(n, dict):
            if "Literal" in n and isinstance(n["Literal"], dict):
                return n["Literal"].get("Value")
            for cv in n.values():
                ret = extract_lit_val(cv)
                if ret is not None:
                    return ret
        return None

    # Scan Report-level filters
    rep_filters = layout_json.get("filters")
    if rep_filters:
        try:
            filters_data = json.loads(rep_filters) if isinstance(rep_filters, str) else rep_filters
            extract_fields_from_visual(filters_data, "Report-level", "Report Filters")
        except Exception:
            for m_name in dax_measures:
                if re.search(r'\b' + re.escape(m_name) + r'\b', str(rep_filters), re.IGNORECASE):
                    used.add(m_name)
                    if m_name not in usage_locations:
                        usage_locations[m_name] = "Report-level filters"

    # Scan each page
    sections = layout_json.get("sections", [])
    for sec in sections:
        if is_page_hidden(sec):
            # Skip hidden sheets/pages
            continue
        page_name = sec.get("displayName") or sec.get("name")
        
        # Scan page-level filters
        page_filters = sec.get("filters")
        if page_filters:
            try:
                filters_data = json.loads(page_filters) if isinstance(page_filters, str) else page_filters
                extract_fields_from_visual(filters_data, page_name, "Page Filters")
            except Exception:
                for m_name in dax_measures:
                    if re.search(r'\b' + re.escape(m_name) + r'\b', str(page_filters), re.IGNORECASE):
                        used.add(m_name)
                        if m_name not in usage_locations:
                            usage_locations[m_name] = f"Page-level filters on page '{page_name}'"
                            
        # Scan visual containers on page
        for idx, vc in enumerate(sec.get("visualContainers", [])):
            config_str = vc.get("config")
            if not config_str:
                continue
            try:
                config = json.loads(config_str)
            except Exception:
                continue
                
            single_visual = config.get("singleVisual", {})
            v_type = single_visual.get("visualType") or "Visual"
            
            # Find visual title
            visual_title = None
            title_objs = single_visual.get("vcObjects", {}).get("title", [])
            for tobj in title_objs:
                if isinstance(tobj, dict):
                    visual_title = extract_lit_val(tobj.get("properties", {}).get("text"))
                    if visual_title:
                        visual_title = str(visual_title).strip("'\"")
                        break
            if not visual_title:
                visual_title = f"{v_type} #{idx}"
                
            # Scan visual configuration recursively
            extract_fields_from_visual(config, page_name, visual_title)
            
            # Scan visual-level filters
            vc_filters = vc.get("filters")
            if vc_filters:
                try:
                    filters_data = json.loads(vc_filters) if isinstance(vc_filters, str) else vc_filters
                    extract_fields_from_visual(filters_data, page_name, f"Filters on visual '{visual_title}'")
                except Exception:
                    for m_name in dax_measures:
                        if re.search(r'\b' + re.escape(m_name) + r'\b', str(vc_filters), re.IGNORECASE):
                            used.add(m_name)
                            if m_name not in usage_locations:
                                usage_locations[m_name] = f"Visual-level filters on visual '{visual_title}' ({page_name})"

    # Scan dependencies among measures
    dependencies = {}
    for m_name, expr in dax_measures.items():
        dependencies[m_name] = set()
        if not expr:
            continue
        for other_m in dax_measures:
            if other_m == m_name:
                continue
            pattern = re.compile(r'\b' + re.escape(other_m) + r'\b', re.IGNORECASE)
            if pattern.search(expr):
                dependencies[m_name].add(other_m)
                
    # Scan dependencies in calculated columns
    for c_name, expr in dax_columns.items():
        if not expr:
            continue
        for other_m in dax_measures:
            pattern = re.compile(r'\b' + re.escape(other_m) + r'\b', re.IGNORECASE)
            if pattern.search(expr):
                c_used = (c_name in used)
                if not c_used:
                    for sec in sections:
                        if is_page_hidden(sec):
                            continue
                        for idx, vc in enumerate(sec.get("visualContainers", [])):
                            config_str = vc.get("config")
                            if config_str and re.search(r'\b' + re.escape(c_name) + r'\b', config_str, re.IGNORECASE):
                                c_used = True
                                break
                        if c_used:
                            break
                if c_used:
                    used.add(other_m)
                    if other_m not in usage_locations:
                        usage_locations[other_m] = f"calculated column '{c_name}'"

    # Transitive closure queue to mark dependencies of used measures
    queue = list(used)
    while queue:
        current = queue.pop(0)
        loc = usage_locations.get(current, "visual element")
        for dep in dependencies.get(current, set()):
            if dep not in used:
                used.add(dep)
                usage_locations[dep] = f"dependency of measure '{current}' (used in {loc})"
                queue.append(dep)

    violations = []
    
    # Report PASS for all used measures
    for m_name in dax_measures:
        if m_name in used:
            loc = usage_locations.get(m_name, "visual element")
            page_name, visual_title, visual_id = None, None, None
            if loc.startswith("visual '"):
                try:
                    v_part, p_part = loc.split(" on page ")
                    visual_title = v_part.replace("visual '", "").rstrip("'")
                    page_name = p_part.replace("page '", "").rstrip("'")
                    
                    if layout_json:
                        for s in layout_json.get("sections", []):
                            if s.get("displayName") == page_name:
                                for vc in s.get("visualContainers", []):
                                    v_id = vc.get("name")
                                    config_str = vc.get("config")
                                    if config_str and visual_title in config_str:
                                        visual_id = v_id
                                        break
                except Exception:
                    pass
            violations.append({
                "category": "unused_measures",
                "status": "pass",
                "target": f"Unused Measure: {m_name}",
                "message": f"Measure '[{m_name}]' is used in {loc}.",
                "suggested_fix": "",
                "page_name": page_name,
                "visual_id": visual_id,
                "visual_title": visual_title
            })
            
    # Report WARNING for all unused measures
    unused_count = 0
    for m_name in dax_measures:
        if m_name not in used:
            unused_count += 1
            violations.append({
                "category": "unused_measures",
                "status": "warning",
                "target": f"Unused Measure: {m_name}",
                "message": f"Measure '[{m_name}]' is defined in the model but is not used in any visual, filter, or other measure.",
                "suggested_fix": "Remove this measure if it's no longer needed."
            })
            
    return violations, len(dax_measures), unused_count


def check_visual_alignment(layout_json):
    """
    Identifies visual elements on a page that are misaligned (minor offsets) or overlap.
    """
    violations = []
    
    sections = layout_json.get("sections", [])
    for sec in sections:
        if is_page_hidden(sec):
            continue
        page_name = sec.get("displayName") or sec.get("name")
        vcs = sec.get("visualContainers", [])
        
        visuals = []
        for idx, vc in enumerate(vcs):
            x = vc.get("x")
            y = vc.get("y")
            w = vc.get("width")
            h = vc.get("height")
            
            if x is None or y is None or w is None or h is None:
                continue
                
            config_str = vc.get("config")
            v_type = "Visual"
            visual_title = None
            if config_str:
                try:
                    config = json.loads(config_str)
                    single_visual = config.get("singleVisual", {})
                    v_type = single_visual.get("visualType") or "Visual"
                    title_objs = single_visual.get("vcObjects", {}).get("title", [])
                    for tobj in title_objs:
                        if isinstance(tobj, dict):
                            val_node = tobj.get("properties", {}).get("text")
                            if val_node:
                                if isinstance(val_node, dict) and "Literal" in val_node:
                                    visual_title = val_node["Literal"].get("Value", "").strip("'\"")
                                    if visual_title:
                                        break
                except Exception:
                    pass
            if not visual_title:
                visual_title = f"{v_type} #{idx}"
                
            visuals.append({
                "id": idx,
                "name": vc.get("name"),
                "title": visual_title,
                "x": float(x),
                "y": float(y),
                "w": float(w),
                "h": float(h)
            })
            
        if not visuals:
            continue
            
        page_violations = []
        
        # 1. Row alignment check (median Y within 5px)
        row_visited = set()
        row_clusters = []
        for i, vi in enumerate(visuals):
            if vi["id"] in row_visited:
                continue
            cluster = [vi]
            row_visited.add(vi["id"])
            for vj in visuals[i+1:]:
                if vj["id"] not in row_visited:
                    if any(abs(vj["y"] - member["y"]) <= 5 for member in cluster):
                        cluster.append(vj)
                        row_visited.add(vj["id"])
            if len(cluster) >= 2:
                row_clusters.append(cluster)
                
        for cluster in row_clusters:
            for i, vi in enumerate(cluster):
                for vj in cluster[i+1:]:
                    ydiff = abs(vi["y"] - vj["y"])
                    if 0 < ydiff <= 5:
                        page_violations.append({
                            "category": "visual_alignment",
                            "status": "warning",
                            "target": f"Visual Alignment ({page_name})",
                            "message": f"Visuals '{vi['title']}' and '{vj['title']}' on page '{page_name}' appear intended to align but differ by {int(ydiff)}px in y.",
                            "suggested_fix": "Use Power BI Desktop's alignment tools (Format > Align) or the Selection pane to snap these visuals to matching position/size."
                        })
            for i, vi in enumerate(cluster):
                for vj in cluster[i+1:]:
                    hdiff = abs(vi["h"] - vj["h"])
                    if hdiff > 5:
                        page_violations.append({
                            "category": "visual_alignment",
                            "status": "warning",
                            "target": f"Visual Alignment ({page_name})",
                            "message": f"Visuals '{vi['title']}' and '{vj['title']}' on page '{page_name}' appear intended to align but differ by {int(hdiff)}px in height.",
                            "suggested_fix": "Use Power BI Desktop's alignment tools (Format > Align) or the Selection pane to snap these visuals to matching position/size."
                        })

        # 2. Column alignment check (median X within 5px)
        col_visited = set()
        col_clusters = []
        for i, vi in enumerate(visuals):
            if vi["id"] in col_visited:
                continue
            cluster = [vi]
            col_visited.add(vi["id"])
            for vj in visuals[i+1:]:
                if vj["id"] not in col_visited:
                    if any(abs(vj["x"] - member["x"]) <= 5 for member in cluster):
                        cluster.append(vj)
                        col_visited.add(vj["id"])
            if len(cluster) >= 2:
                col_clusters.append(cluster)
                
        for cluster in col_clusters:
            for i, vi in enumerate(cluster):
                for vj in cluster[i+1:]:
                    xdiff = abs(vi["x"] - vj["x"])
                    if 0 < xdiff <= 5:
                        page_violations.append({
                            "category": "visual_alignment",
                            "status": "warning",
                            "target": f"Visual Alignment ({page_name})",
                            "message": f"Visuals '{vi['title']}' and '{vj['title']}' on page '{page_name}' appear intended to align but differ by {int(xdiff)}px in x.",
                            "suggested_fix": "Use Power BI Desktop's alignment tools (Format > Align) or the Selection pane to snap these visuals to matching position/size."
                        })
            for i, vi in enumerate(cluster):
                for vj in cluster[i+1:]:
                    wdiff = abs(vi["w"] - vj["w"])
                    if wdiff > 5:
                        page_violations.append({
                            "category": "visual_alignment",
                            "status": "warning",
                            "target": f"Visual Alignment ({page_name})",
                            "message": f"Visuals '{vi['title']}' and '{vj['title']}' on page '{page_name}' appear intended to align but differ by {int(wdiff)}px in width.",
                            "suggested_fix": "Use Power BI Desktop's alignment tools (Format > Align) or the Selection pane to snap these visuals to matching position/size."
                        })

        # 3. Overlap check
        for i, vi in enumerate(visuals):
            for vj in visuals[i+1:]:
                if (vi["x"] < vj["x"] + vj["w"] - 1 and vi["x"] + vi["w"] - 1 > vj["x"] and
                    vi["y"] < vj["y"] + vj["h"] - 1 and vi["y"] + vi["h"] - 1 > vj["y"]):
                    page_violations.append({
                        "category": "visual_alignment",
                        "status": "warning",
                        "target": f"Visual Alignment ({page_name})",
                        "message": f"Visuals '{vi['title']}' and '{vj['title']}' on page '{page_name}' overlap. This might be intentional (e.g. background shapes) or a layout issue.",
                        "suggested_fix": "Reposition or resize the overlapping elements, or adjust their layer order in the Selection pane."
                    })
                    
        if page_violations:
            for p_v in page_violations:
                p_v["page_name"] = page_name
                titles = re.findall(r"Visuals '([^']+)' and '([^']+)'", p_v["message"])
                if titles:
                    t1, t2 = titles[0]
                    v_ids = []
                    for v in visuals:
                        if v["title"] in (t1, t2) and v.get("name"):
                            v_ids.append(v["name"])
                    if v_ids:
                        p_v["visual_id"] = v_ids[0]
                        p_v["visual_title"] = t1
            violations.extend(page_violations)
        else:
            violations.append({
                "category": "visual_alignment",
                "status": "pass",
                "target": f"Visual Alignment ({page_name})",
                "message": f"No misaligned visuals detected on this page.",
                "suggested_fix": "",
                "page_name": page_name
            })
            
    return violations


def check_unused_columns(columns_df, levels_df, relationships_df, layout_json, dax_measures, dax_columns):
    violations = []
    if columns_df is None or columns_df.empty:
        return violations, 0, 0
        
    hierarchy_col_ids = set()
    if levels_df is not None and not levels_df.empty:
        if "ColumnID" in levels_df.columns:
            hierarchy_col_ids = set(levels_df["ColumnID"].dropna())
            
    sort_by_ids = set()
    if "sortByColumnID" in columns_df.columns:
        sort_by_ids = set(columns_df["sortByColumnID"].dropna())
        
    rel_cols = set()
    if relationships_df is not None and not relationships_df.empty:
        from_t_col = next((c for c in relationships_df.columns if c.lower() == "fromtable"), None)
        from_c_col = next((c for c in relationships_df.columns if c.lower() == "fromcolumn"), None)
        to_t_col = next((c for c in relationships_df.columns if c.lower() == "totable"), None)
        to_c_col = next((c for c in relationships_df.columns if c.lower() == "tocolumn"), None)
        
        for _, rel in relationships_df.iterrows():
            f_t = rel.get(from_t_col) if from_t_col else None
            f_c = rel.get(from_c_col) if from_c_col else None
            t_t = rel.get(to_t_col) if to_t_col else None
            t_c = rel.get(to_c_col) if to_c_col else None
            if f_t and f_c:
                rel_cols.add((str(f_t).lower(), str(f_c).lower()))
            if t_t and t_c:
                rel_cols.add((str(t_t).lower(), str(t_c).lower()))
                
    layout_used_cols = set()
    usage_locations = {}
    
    def scan_layout_node(node, page_name=None, visual_title=None):
        if isinstance(node, dict):
            if "queryRef" in node and isinstance(node["queryRef"], str):
                ref = node["queryRef"]
                if "." in ref:
                    t, c = ref.split(".", 1)
                    layout_used_cols.add((t.lower(), c.lower()))
                    if page_name and visual_title:
                        usage_locations[(t.lower(), c.lower())] = f"visual '{visual_title}' on page '{page_name}'"
            if "Column" in node and isinstance(node["Column"], str):
                c = node["Column"]
                t = node.get("Expression", {}).get("SourceRef", {}).get("Entity") or node.get("SourceRef", {}).get("Entity")
                if t and isinstance(t, str):
                    layout_used_cols.add((t.lower(), c.lower()))
                    if page_name and visual_title:
                        usage_locations[(t.lower(), c.lower())] = f"visual '{visual_title}' on page '{page_name}'"
            for v in node.values():
                scan_layout_node(v, page_name, visual_title)
        elif isinstance(node, list):
            for item in node:
                scan_layout_node(item, page_name, visual_title)

    if layout_json:
        rep_filters = layout_json.get("filters")
        if rep_filters:
            try:
                fd = json.loads(rep_filters) if isinstance(rep_filters, str) else rep_filters
                scan_layout_node(fd, "Report-level", "Report Filters")
            except Exception:
                pass
                
        sections = layout_json.get("sections", [])
        for sec in sections:
            if is_page_hidden(sec):
                continue
            p_name = sec.get("displayName") or sec.get("name")
            p_filters = sec.get("filters")
            if p_filters:
                try:
                    fd = json.loads(p_filters) if isinstance(p_filters, str) else p_filters
                    scan_layout_node(fd, p_name, "Page Filters")
                except Exception:
                    pass
            for vc in sec.get("visualContainers", []):
                v_title = ""
                config_str = vc.get("config")
                v_id = vc.get("name")
                if config_str:
                    try:
                        config = json.loads(config_str)
                        single_vis = config.get("singleVisual", {})
                        title_props = single_vis.get("objects", {}).get("title", [])
                        if title_props and isinstance(title_props, list):
                            for prop in title_props:
                                title_text = prop.get("properties", {}).get("text", {})
                                v_title = title_text.get("expr", {}).get("Literal", {}).get("Value", "") or ""
                                v_title = str(v_title).strip("'\"")
                                if v_title:
                                    break
                        if not v_title:
                            v_title = single_vis.get("visualType") or "Visual"
                        scan_layout_node(config, p_name, v_title)
                    except Exception:
                        pass
                v_filters = vc.get("filters")
                if v_filters:
                    try:
                        fd = json.loads(v_filters) if isinstance(v_filters, str) else v_filters
                        scan_layout_node(fd, p_name, v_title or "Visual Filters")
                    except Exception:
                        pass

    dax_exprs = []
    if dax_measures:
        dax_exprs.extend(dax_measures.values())
    if dax_columns:
        dax_exprs.extend(dax_columns.values())
        
    total_cols = 0
    unused_cols_count = 0
    
    for _, col_row in columns_df.iterrows():
        t_name = str(col_row.get("TableName"))
        c_name = str(col_row.get("Name"))
        c_id = col_row.get("ID")
        
        if t_name.startswith(("DateTableTemplate_", "LocalDateTable_", "__")):
            continue
            
        total_cols += 1
        is_used = False
        usage_msg = ""
        
        if c_id in hierarchy_col_ids:
            is_used = True
            usage_msg = "Used in a model hierarchy definition."
        elif c_id in sort_by_ids:
            is_used = True
            usage_msg = "Used in a 'Sort by column' configuration."
        elif (t_name.lower(), c_name.lower()) in rel_cols:
            is_used = True
            usage_msg = "Used in a model relationship key."
        elif (t_name.lower(), c_name.lower()) in layout_used_cols:
            is_used = True
            loc = usage_locations.get((t_name.lower(), c_name.lower()), "a report visual")
            usage_msg = f"Used in {loc}."
        else:
            for d_expr in dax_exprs:
                if not d_expr:
                    continue
                ref_pattern = re.escape(t_name) + r'\s*\[\s*' + re.escape(c_name) + r'\s*\]'
                if re.search(ref_pattern, d_expr, re.IGNORECASE):
                    is_used = True
                    usage_msg = "Referenced in a DAX formula expression."
                    break
                if t_name in dax_columns and d_expr == dax_columns[t_name]:
                    local_pattern = r'\[\s*' + re.escape(c_name) + r'\s*\]'
                    if re.search(local_pattern, d_expr, re.IGNORECASE):
                        is_used = True
                        usage_msg = "Referenced in a local DAX expression."
                        break
                    
        if is_used:
            loc_str = usage_locations.get((t_name.lower(), c_name.lower()))
            page_name, visual_title, visual_id = None, None, None
            if loc_str:
                try:
                    v_part, p_part = loc_str.split(" on page ")
                    visual_title = v_part.replace("visual '", "").rstrip("'")
                    page_name = p_part.replace("page '", "").rstrip("'")
                    
                    if layout_json:
                        for s in layout_json.get("sections", []):
                            if s.get("displayName") == page_name:
                                for vc in s.get("visualContainers", []):
                                    v_id = vc.get("name")
                                    config_str = vc.get("config")
                                    if config_str and visual_title in config_str:
                                        visual_id = v_id
                                        break
                except Exception:
                    pass
                    
            violations.append({
                "category": "unused_columns",
                "status": "pass",
                "target": f"Unused Column: {t_name}.{c_name}",
                "message": f"Column '{t_name}.{c_name}' is used in the model. ({usage_msg})",
                "suggested_fix": "",
                "page_name": page_name,
                "visual_title": visual_title,
                "visual_id": visual_id
            })
        else:
            unused_cols_count += 1
            violations.append({
                "category": "unused_columns",
                "status": "warning",
                "target": f"Unused Column: {t_name}.{c_name}",
                "message": f"Column '{t_name}.{c_name}' is defined in the model but is not used in any visual, filter, sort, relationship, or DAX expression.",
                "suggested_fix": "Remove this column if it's not needed, hide it from Report View if it's only used for calculations, or confirm it isn't required by an external tool (Analyze in Excel, paginated reports) before deleting."
            })
            
    return violations, total_cols, unused_cols_count


def check_disconnected_tables(tables_list, relationships_df):
    violations = []
    if not tables_list:
        return violations
        
    connected_tables = set()
    if relationships_df is not None and not relationships_df.empty:
        from_t_col = next((c for c in relationships_df.columns if c.lower() == "fromtable"), None)
        to_t_col = next((c for c in relationships_df.columns if c.lower() == "totable"), None)
        
        for _, rel in relationships_df.iterrows():
            f_t = rel.get(from_t_col) if from_t_col else None
            t_t = rel.get(to_t_col) if to_t_col else None
            if f_t:
                connected_tables.add(str(f_t).lower())
            if t_t:
                connected_tables.add(str(t_t).lower())
                
    disconnected = []
    for t_name in tables_list:
        if t_name.startswith(("DateTableTemplate_", "LocalDateTable_", "__")):
            continue
        if t_name.lower() not in connected_tables:
            disconnected.append(t_name)
            
    if disconnected:
        for t_name in disconnected:
            violations.append({
                "category": "data_model",
                "status": "fail",
                "target": f"Data Model: {t_name}",
                "message": f"Table '{t_name}' has no relationships to any other table in the model. Visuals using this table cannot cross-filter with the rest of the report.",
                "suggested_fix": f"Create a relationship from '{t_name}' to a related table in Model View, or confirm this table is intentionally standalone (e.g. a disconnected parameter table for what-if analysis or measure-only support table) — if intentional, no action needed."
            })
    else:
        violations.append({
            "category": "data_model",
            "status": "pass",
            "target": "Data Model (Report-wide)",
            "message": f"All {len(tables_list)} tables have at least one relationship to another table.",
            "suggested_fix": ""
        })
        
    return violations
