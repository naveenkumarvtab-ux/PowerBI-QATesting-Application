import pytest
import json
import os
import sys

# Add backend directory to path so it can import core modules
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from core.pbix_parser import validate_visual_actions
from core.functional_tests import PlaywrightFunctionalTester

@pytest.fixture
def mock_layout_json():
    return {
        "sections": [
            {
                "name": "ReportSection1",
                "displayName": "Sales Overview",
                "visualContainers": [
                    {
                        "config": json.dumps({
                            "singleVisual": {
                                "visualType": "button",
                                "objects": {
                                    "title": [{
                                        "properties": {
                                            "text": {
                                                "expr": {
                                                    "Literal": {
                                                        "Value": "'Valid Page Nav Button'"
                                                    }
                                                }
                                            }
                                        }
                                    }]
                                },
                                "vcObjects": {
                                    "action": [{
                                        "properties": {
                                            "type": {
                                                "expr": {
                                                    "Literal": {
                                                        "Value": "'PageNavigation'"
                                                    }
                                                }
                                            },
                                            "page": {
                                                "expr": {
                                                    "Literal": {
                                                        "Value": "'Sales Trends'"
                                                    }
                                                }
                                            }
                                        }
                                    }]
                                }
                            }
                        })
                    },
                    {
                        "config": json.dumps({
                            "singleVisual": {
                                "visualType": "image",
                                "objects": {
                                    "title": [{
                                        "properties": {
                                            "text": {
                                                "expr": {
                                                    "Literal": {
                                                        "Value": "'Broken Page Nav Image'"
                                                    }
                                                }
                                            }
                                        }
                                    }]
                                },
                                "vcObjects": {
                                    "visualLink": [{
                                        "properties": {
                                            "type": {
                                                "expr": {
                                                    "Literal": {
                                                        "Value": "'PageNavigation'"
                                                    }
                                                }
                                            },
                                            "navigationSection": {
                                                "expr": {
                                                    "Literal": {
                                                        "Value": "'None'"
                                                    }
                                                }
                                            }
                                        }
                                    }]
                                }
                            }
                        })
                    },
                    {
                        "config": json.dumps({
                            "singleVisual": {
                                "visualType": "button",
                                "vcObjects": {
                                    "action": [{
                                        "properties": {
                                            "type": {
                                                "expr": {
                                                    "Literal": {
                                                        "Value": "'Bookmark'"
                                                    }
                                                }
                                            },
                                            "bookmark": {
                                                "expr": {
                                                    "Literal": {
                                                        "Value": "'Category'"
                                                    }
                                                }
                                            }
                                        }
                                    }]
                                }
                            }
                        })
                    },
                    {
                        "config": json.dumps({
                            "singleVisual": {
                                "visualType": "button",
                                "vcObjects": {
                                    "action": [{
                                        "properties": {
                                            "type": {
                                                "expr": {
                                                    "Literal": {
                                                        "Value": "'Bookmark'"
                                                    }
                                                }
                                            },
                                            "bookmark": {
                                                "expr": {
                                                    "Literal": {
                                                        "Value": "'None'"
                                                    }
                                                }
                                            }
                                        }
                                    }]
                                }
                            }
                        })
                    }
                ]
            }
        ]
    }

def test_static_visual_actions_validation(mock_layout_json):
    violations = validate_visual_actions(mock_layout_json)
    
    # We expect 2 failure violations:
    # 1. Broken Page Nav Image with destination None
    # 2. Visual Bookmark Action with bookmark destination None
    failures = [v for v in violations if v["status"] == "fail"]
    assert len(failures) == 2
    
    # Check broken navigation error structure matching Example 1
    nav_fail = [v for v in failures if "Page Navigation" in v["target"]][0]
    assert nav_fail["status"] == "fail"
    assert nav_fail["target"] == "Visual Page Navigation (Page: Sales Overview)"
    assert nav_fail["message"] == "Visual on page 'Sales Overview' has action set to 'Page navigation' but destination is set to 'None'."
    assert nav_fail["suggested_fix"] == "Set a valid page destination in the Action formatting pane or turn off Actions for this visual to avoid broken links."
    
    # Check broken bookmark action error structure
    bookmark_fail = [v for v in violations if "Bookmark Action" in v["target"]][0]
    assert bookmark_fail["status"] == "fail"
    assert "no bookmark is selected" in bookmark_fail["message"]

def test_playwright_tester_bookmark_comparison():
    tester = PlaywrightFunctionalTester(
        job_id="test_job", 
        report_url="http://mock-report", 
        report_pages=["Sales Overview"],
        page_bookmarks={
            "Sales Overview": ["Category", "Segment", "Failing Bookmark"]
        }
    )
    
    violations = tester.run_tests()
    
    # Check PASS bookmarks (Category, Segment) match Example 2
    category_pass = [v for v in violations if v["target"] == "Bookmark: Category (Sales Overview)"][0]
    assert category_pass["status"] == "pass"
    assert category_pass["message"] == "Visual states updated correctly on bookmark activation."
    assert category_pass["screenshot_url"] is not None
    
    segment_pass = [v for v in violations if v["target"] == "Bookmark: Segment (Sales Overview)"][0]
    assert segment_pass["status"] == "pass"
    assert segment_pass["message"] == "Visual states updated correctly on bookmark activation."
    assert segment_pass["screenshot_url"] is not None
    
    # Check FAIL bookmark (Failing Bookmark) does not change state
    failing_bookmark = [v for v in violations if v["target"] == "Bookmark: Failing Bookmark (Sales Overview)"][0]
    assert failing_bookmark["status"] == "fail"
    assert failing_bookmark["message"] == "Bookmark 'Failing Bookmark' did not update visual state as expected on page 'Sales Overview'."
    assert failing_bookmark["screenshot_url"] is not None
