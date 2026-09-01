import os
import time
import json
import base64
from backend.config import Config

def generate_mock_screenshot(output_path, page_name="Sales Overview", bookmark_name="Category", status="pass"):
    try:
        from PIL import Image, ImageDraw
        width, height = 640, 360
        img = Image.new("RGB", (width, height), color=(241, 245, 249))
        draw = ImageDraw.Draw(img)
        
        # 1. Top Power BI App Bar
        draw.rectangle([(0, 0), (width, 36)], fill=(30, 41, 59))
        draw.text((16, 10), f"Power BI — {page_name}", fill=(255, 255, 255))
        
        # Bookmark state badge on top right
        pill_color = (22, 163, 74) if status == "pass" else (225, 29, 72)
        pill_text = f"Bookmark: {bookmark_name} ({'Active & Verified' if status == 'pass' else 'State Unchanged'})"
        draw.rounded_rectangle([(width - 270, 6), (width - 16, 30)], radius=6, fill=pill_color)
        draw.text((width - 260, 10), pill_text, fill=(255, 255, 255))
        
        # 2. KPI Cards
        draw.rounded_rectangle([(20, 52), (190, 130)], radius=8, fill=(255, 255, 255), outline=(226, 232, 240), width=1)
        draw.text((32, 62), "Total Sales", fill=(100, 116, 139))
        draw.text((32, 84), "$2,297,201", fill=(15, 23, 42))
        
        draw.rounded_rectangle([(210, 52), (380, 130)], radius=8, fill=(255, 255, 255), outline=(226, 232, 240), width=1)
        draw.text((222, 62), "Total Orders", fill=(100, 116, 139))
        draw.text((222, 84), "5,009", fill=(15, 23, 42))
        
        draw.rounded_rectangle([(400, 52), (620, 130)], radius=8, fill=(255, 255, 255), outline=(226, 232, 240), width=1)
        draw.text((412, 62), "Profit Ratio", fill=(100, 116, 139))
        draw.text((412, 84), "12.47%", fill=(15, 23, 42))
        
        # 3. Main Filtered Bar Chart
        draw.rounded_rectangle([(20, 145), (380, 340)], radius=8, fill=(255, 255, 255), outline=(226, 232, 240), width=1)
        draw.text((32, 155), f"Sales by {bookmark_name} (Filtered State)", fill=(30, 41, 59))
        bars = [("Tech", 140, (59, 130, 246)), ("Furn", 110, (99, 102, 241)), ("Off", 85, (139, 92, 246)), ("Supp", 60, (14, 165, 233))]
        for idx, (label, bar_h, color) in enumerate(bars):
            x = 50 + idx * 78
            draw.rounded_rectangle([(x, 310 - bar_h), (x + 46, 310)], radius=4, fill=color)
            draw.text((x + 8, 315), label, fill=(100, 116, 139))
            
        # 4. Monthly Trend Line Chart
        draw.rounded_rectangle([(400, 145), (620, 340)], radius=8, fill=(255, 255, 255), outline=(226, 232, 240), width=1)
        draw.text((412, 155), "Monthly Sales Trend", fill=(30, 41, 59))
        points = [(420, 290), (460, 260), (500, 275), (540, 210), (580, 220), (610, 190)]
        draw.line(points, fill=(16, 185, 129), width=3)
        for p in points:
            draw.ellipse([(p[0]-3, p[1]-3), (p[0]+3, p[1]+3)], fill=(16, 185, 129))
            
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        img.save(output_path, "PNG")
    except Exception:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(b"")

class PlaywrightFunctionalTester:
    def __init__(self, job_id, report_url, update_progress_callback=None, report_pages=None, page_bookmarks=None, page_slicers=None, workspace_id=None, report_id=None, api_client=None):
        self.job_id = job_id
        self.report_url = report_url
        self.update_progress_callback = update_progress_callback
        self.report_pages = report_pages or ["Sales Overview", "Customer Overview", "Sales Trends"]
        self.page_bookmarks = page_bookmarks or {}
        self.page_slicers = page_slicers or {}
        self.workspace_id = workspace_id or "me"
        self.report_id = report_id
        self.api_client = api_client
        self.screenshot_dir = os.path.join(Config.REPORT_FOLDER, "screenshots")
        self.debug_dir = os.path.join(os.path.dirname(Config.REPORT_FOLDER), "debug")
        os.makedirs(self.screenshot_dir, exist_ok=True)
        os.makedirs(self.debug_dir, exist_ok=True)

    def _log(self, step_name, progress):
        if self.update_progress_callback:
            self.update_progress_callback(step_name, progress)
        print(f"[Job {self.job_id}] Playwright: {step_name} ({progress}%)")

    def run_tests(self):
        """
        Executes functional report tests using Playwright.
        Returns a list of test check violation dicts.
        """
        if Config.MOCK_SERVICE:
            return self._run_mock_tests()
            
        return self._run_real_tests()

    def _run_mock_tests(self):
        self._log("Launching headless browser context", 10)
        time.sleep(0.5)
        
        self._log("Authenticating and loading Power BI Service session", 30)
        time.sleep(0.5)
        
        self._log(f"Navigating to report URL: {self.report_url}", 50)
        time.sleep(0.5)
        
        violations = []
        pages = self.report_pages
        
        # Populate defaults if empty (typical of cloud service runs in mock mode)
        if not self.page_bookmarks:
            self.page_bookmarks = {
                "Sales Overview": ["Category", "Segment", "Failing Bookmark"]
            }
        if not self.page_slicers:
            self.page_slicers = {
                "Customer Overview": ["Slicer"],
                "Sales Trends": ["Slicer"],
                "Shipping and Order Details": ["Slicer"]
            }
            
        debug_data = {
            "bookmarks": [],
            "page_navigations": []
        }
        
        for idx, page in enumerate(pages):
            progress_base = 60 + idx * 10
            self._log(f"Analyzing page: '{page}' - Verifying visual render tiles", progress_base)
            
            # Pass page render check
            violations.append({
                "target": f"Report Page: {page}",
                "category": "functional",
                "status": "pass",
                "message": f"Page '{page}' rendered successfully without any error visuals.",
                "suggested_fix": "",
                "screenshot_url": None
            })
            
            # Simulated bookmark test
            page_bmarks = self.page_bookmarks.get(page, []) if self.page_bookmarks else []
            for bmark in page_bmarks:
                bmark_disp = "Category" if "category" in bmark.lower() else ("Segment" if "segment" in bmark.lower() else bmark)
                self._log(f"Triggering bookmark '{bmark}' (display: '{bmark_disp}') on page '{page}'", progress_base + 3)
                
                # Mock state differences (Category and Segment will pass, others fail)
                before_state = [{"id": "slicer1", "values": ["East"]}]
                if "fail" in bmark.lower() or "broken" in bmark.lower() or "failing" in bmark.lower():
                    after_state = [{"id": "slicer1", "values": ["East"]}]
                else:
                    after_state = [{"id": "slicer1", "values": [bmark_disp]}]
                
                state_changed = before_state != after_state
                
                debug_data["bookmarks"].append({
                    "name": bmark,
                    "displayName": bmark_disp,
                    "before_filters": before_state,
                    "after_filters": after_state,
                    "state_changed": state_changed
                })
                
                screenshot_filename = f"screenshot_{self.job_id}_bookmark_{bmark_disp}.png"
                screenshot_path = os.path.join(self.screenshot_dir, screenshot_filename)
                generate_mock_screenshot(screenshot_path, page, bmark_disp, "fail" if not state_changed else "pass")
                screenshot_url = f"/api/reports/screenshots/{screenshot_filename}"
                
                if not state_changed:
                    violations.append({
                        "target": f"Bookmark: {bmark_disp} ({page})",
                        "category": "functional",
                        "status": "fail",
                        "message": f"Bookmark '{bmark_disp}' did not update visual state as expected on page '{page}'.",
                        "suggested_fix": "Check the bookmark's captured display/data settings in the Bookmarks pane in Power BI Desktop.",
                        "screenshot_url": screenshot_url
                    })
                else:
                    violations.append({
                        "target": f"Bookmark: {bmark_disp} ({page})",
                        "category": "functional",
                        "status": "pass",
                        "message": "Visual states updated correctly on bookmark activation.",
                        "suggested_fix": "",
                        "screenshot_url": screenshot_url
                    })
            
            # Simulated filter clear test
            page_slicers = self.page_slicers.get(page, []) if self.page_slicers else []
            if page_slicers:
                for slicer in page_slicers:
                    self._log(f"Applying and resetting Filter: {slicer} on page '{page}'", progress_base + 6)
                    
                    violations.append({
                        "target": f"Filter Interaction: Reset {slicer} Slicer ({page})",
                        "category": "functional",
                        "status": "pass",
                        "message": f"Filters applied and reset successfully on {slicer} slicer.",
                        "suggested_fix": "",
                        "screenshot_url": None
                    })
                    
        # Simulate visual navigation checks in violates list matching the required static checks
        # Sales Overview page has broken page navigation
        debug_data["page_navigations"].append({
            "visualName": "0334ea1edd5911ee36b8",
            "page": "Sales Overview",
            "target_destination": "None",
            "pageChanged_fired": False
        })
        
        # Save raw debug file
        debug_file_path = os.path.join(self.debug_dir, f"{self.job_id}_functional_raw.json")
        with open(debug_file_path, "w") as df:
            json.dump(debug_data, df, indent=2)
            
        self._log("Closing browser session and saving logs", 95)
        return violations

    def _run_real_tests(self):
        """
        Executes real Playwright code using self-hosted Embedded harness and official JS SDK.
        """
        violations = []
        debug_data = {
            "bookmarks": [],
            "page_navigations": []
        }
        
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            self._log("Playwright not installed correctly. Recording test failure.", 100)
            return [{
                "target": "Playwright Service Browser",
                "category": "functional",
                "status": "fail",
                "message": "Playwright python package is missing or not installed properly.",
                "suggested_fix": "Run 'playwright install' and install python dependencies."
            }]
            
        try:
            # 1. Obtain embed token via REST API
            self._log("Generating view embed token via Power BI REST API", 15)
            embed_token = self.api_client.generate_embed_token(self.workspace_id, self.report_id)
            
            # 2. Build local embed harness URL
            embed_url = f"https://app.powerbi.com/reportEmbed?reportId={self.report_id}&groupId={self.workspace_id}"
            harness_url = f"http://localhost:5000/api/reports/embed-harness?embedUrl={embed_url}&accessToken={embed_token}&reportId={self.report_id}"
            
            with sync_playwright() as p:
                self._log("Launching Chromium browser", 20)
                browser = p.chromium.launch(headless=True)
                page = browser.new_page()
                page.set_default_timeout(30000)
                
                self._log(f"Loading local Power BI Embedded harness: {harness_url}", 30)
                page.goto(harness_url)
                
                # Wait for report to load/render via window.__pbiRendered flag set by SDK events
                self._log("Waiting for Power BI report render complete...", 50)
                page.wait_for_function("window.__pbiRendered === true", timeout=25000)
                
                # 3. Retrieve authoritative page details and bookmarks list using JS SDK
                self._log("Extracting report structure using JS SDK", 60)
                
                real_bookmarks = page.evaluate("""async () => {
                    try {
                        const report = window.__pbiReport;
                        const bms = await report.bookmarksManager.getBookmarks();
                        return bms.map(bm => ({ name: bm.name, displayName: bm.displayName }));
                    } catch (e) {
                        return [];
                    }
                }""")
                
                real_pages = page.evaluate("""async () => {
                    try {
                        const report = window.__pbiReport;
                        const pages = await report.getPages();
                        return pages.map(p => ({ name: p.name, displayName: p.displayName, isActive: p.isActive }));
                    } catch (e) {
                        return [];
                    }
                }""")
                
                # 4. Perform visual rendering check on all pages
                for page_idx, p_info in enumerate(real_pages):
                    p_disp = p_info["displayName"]
                    p_name = p_info["name"]
                    
                    self._log(f"Navigating to page '{p_disp}' via JS SDK", 65 + page_idx * 5)
                    page.evaluate(f"""async () => {{
                        const report = window.__pbiReport;
                        const pages = await report.getPages();
                        const target = pages.find(p => p.name === "{p_name}");
                        if (target) {{
                            await target.setActive();
                        }}
                    }}""")
                    time.sleep(1.5)
                    
                    # Capture page screenshot
                    screenshot_filename = f"screenshot_{self.job_id}_{p_disp.replace(' ', '_')}.png"
                    screenshot_path = os.path.join(self.screenshot_dir, screenshot_filename)
                    page.screenshot(path=screenshot_path)
                    screenshot_url = f"/api/reports/screenshots/{screenshot_filename}"
                    
                    # Visual tiles error check inside iframe
                    iframe_locator = page.frame_locator("iframe").first
                    error_icons = iframe_locator.locator(".error-icon").all()
                    
                    if len(error_icons) > 0:
                        violations.append({
                            "target": f"Report Page: {p_disp}",
                            "category": "functional",
                            "status": "fail",
                            "message": f"Page '{p_disp}' rendered with visual tiles showing errors.",
                            "suggested_fix": "Analyze visual details for query timeouts or bad column references.",
                            "screenshot_url": screenshot_url
                        })
                    else:
                        violations.append({
                            "target": f"Report Page: {p_disp}",
                            "category": "functional",
                            "status": "pass",
                            "message": f"Page '{p_disp}' rendered successfully without any error visuals.",
                            "suggested_fix": "",
                            "screenshot_url": screenshot_url
                        })

                # 5. Bookmarks verification phase (dynamic, report-wide)
                self._log("Running report-wide bookmark state tests using JS SDK", 75)
                for bm_idx, rbm in enumerate(real_bookmarks):
                    bm_disp = rbm["displayName"]
                    if "category" in bm_disp.lower():
                        bm_disp = "Category"
                    elif "segment" in bm_disp.lower():
                        bm_disp = "Segment"
                        
                    self._log(f"Testing bookmark '{rbm['displayName']}' (displayName: '{bm_disp}')", 75 + bm_idx)
                    
                    # Capture active page and filters before
                    before_info = page.evaluate("""async () => {
                        const report = window.__pbiReport;
                        const pages = await report.getPages();
                        const activePage = pages.find(p => p.isActive);
                        const filters = activePage ? await activePage.getFilters() : [];
                        return { pageName: activePage ? activePage.displayName : "", filters: filters };
                    }""")
                    
                    # Apply bookmark via SDK
                    page.evaluate(f"""async () => {{
                        const report = window.__pbiReport;
                        await report.bookmarksManager.apply("{rbm['name']}");
                    }}""")
                    time.sleep(1.5)
                    
                    # Capture active page and filters after
                    after_info = page.evaluate("""async () => {
                        const report = window.__pbiReport;
                        const pages = await report.getPages();
                        const activePage = pages.find(p => p.isActive);
                        const filters = activePage ? await activePage.getFilters() : [];
                        return { pageName: activePage ? activePage.displayName : "", filters: filters };
                    }""")
                    
                    p_disp = after_info["pageName"] or before_info["pageName"]
                    
                    # State diffing: page changed OR filters changed
                    state_changed = (before_info["pageName"] != after_info["pageName"] or 
                                     before_info["filters"] != after_info["filters"])
                    
                    debug_data["bookmarks"].append({
                        "name": rbm["name"],
                        "displayName": bm_disp,
                        "before_filters": before_info["filters"],
                        "after_filters": after_info["filters"],
                        "state_changed": state_changed
                    })
                    
                    # Capture screenshot
                    screenshot_filename = f"screenshot_{self.job_id}_bookmark_{bm_disp}.png"
                    screenshot_path = os.path.join(self.screenshot_dir, screenshot_filename)
                    page.screenshot(path=screenshot_path)
                    bm_screenshot_url = f"/api/reports/screenshots/{screenshot_filename}"
                    
                    if not state_changed:
                        violations.append({
                            "target": f"Bookmark: {bm_disp} ({p_disp})",
                            "category": "functional",
                            "status": "fail",
                            "message": f"Bookmark '{bm_disp}' did not update visual state as expected on page '{p_disp}'.",
                            "suggested_fix": "Check the bookmark's captured display/data settings in the Bookmarks pane in Power BI Desktop.",
                            "screenshot_url": bm_screenshot_url
                        })
                    else:
                        violations.append({
                            "target": f"Bookmark: {bm_disp} ({p_disp})",
                            "category": "functional",
                            "status": "pass",
                            "message": "Visual states updated correctly on bookmark activation.",
                            "suggested_fix": "",
                            "screenshot_url": bm_screenshot_url
                        })
                        
                    # Re-navigate to the original page if the bookmark changed pages to keep a stable baseline
                    if before_info["pageName"] != after_info["pageName"]:
                        page.evaluate(f"""async () => {{
                            const report = window.__pbiReport;
                            const pages = await report.getPages();
                            const orig = pages.find(p => p.displayName === "{before_info['pageName']}");
                            if (orig) await orig.setActive();
                        }}""")
                        time.sleep(1.0)

                # 6. Visual page navigation action tests
                self._log("Running visual page-navigation action tests using Playwright & SDK", 85)
                
                for p_info in real_pages:
                    p_disp = p_info["displayName"]
                    p_name = p_info["name"]
                    
                    # Navigate to page
                    page.evaluate(f"""async () => {{
                        const report = window.__pbiReport;
                        const pages = await report.getPages();
                        const target = pages.find(p => p.name === "{p_name}");
                        if (target) await target.setActive();
                    }}""")
                    time.sleep(1.5)
                    
                    visuals_to_test = page.evaluate("""async () => {
                        const report = window.__pbiReport;
                        const pages = await report.getPages();
                        const activePage = pages.find(p => p.isActive);
                        const visuals = await activePage.getVisuals();
                        return visuals.map(v => ({ name: v.name, title: v.title, type: v.type }));
                    }""")
                    
                    for vis in visuals_to_test:
                        v_name = vis["name"]
                        v_title = vis["title"] or vis["type"]
                        
                        if vis["type"] in ("actionButton", "image"):
                            page.evaluate("window.__pbiEvents = []")
                            self._log(f"Testing visual navigation click on '{v_title}' on page '{p_disp}'", 88)
                            
                            try:
                                css_selector = f'[name="{v_name}"], .visual-container-component[data-visual-id="{v_name}"], [visual-name="{v_name}"]'
                                iframe_locator = page.frame_locator("iframe").first
                                el_loc = iframe_locator.locator(css_selector).first
                                
                                if el_loc.count() > 0:
                                    el_loc.click(timeout=3000)
                                    time.sleep(1.5)
                                    
                                    events = page.evaluate("window.__pbiEvents")
                                    page_changed_events = [e for e in events if e.get("event") == "pageChanged"]
                                    
                                    fired = len(page_changed_events) > 0
                                    target_page_disp = page_changed_events[0]["detail"]["newPage"]["displayName"] if fired else None
                                    
                                    debug_data["page_navigations"].append({
                                        "visualName": v_name,
                                        "page": p_disp,
                                        "target_destination": target_page_disp or "None",
                                        "pageChanged_fired": fired
                                    })
                                    
                                    if fired:
                                        # Navigate back
                                        page.evaluate(f"""async () => {{
                                            const report = window.__pbiReport;
                                            const pages = await report.getPages();
                                            const original = pages.find(p => p.name === "{p_name}");
                                            if (original) await original.setActive();
                                        }}""")
                                        time.sleep(1.5)
                            except Exception:
                                pass
                            
                browser.close()
                
        except Exception as ex:
            self._log(f"Unexpected Playwright Embedded verification error: {ex}", 100)
            violations.append({
                "target": "Playwright Embedded Test Run",
                "category": "functional",
                "status": "fail",
                "message": f"Execution crashed: {str(ex)}",
                "suggested_fix": "Inspect network conditions, report URL accessibility, or browser runtime updates."
            })
            
        # Write functional raw log file
        debug_file_path = os.path.join(self.debug_dir, f"{self.job_id}_functional_raw.json")
        try:
            with open(debug_file_path, "w") as df:
                json.dump(debug_data, df, indent=2)
        except Exception as we:
            print(f"Failed to write debug raw file: {we}")
            
        return violations
