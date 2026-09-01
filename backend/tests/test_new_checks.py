import pytest
import json
from backend.core.pbix_parser import check_font_consistency, check_unused_measures, check_visual_alignment

def test_font_consistency():
    # Scenario 1: All text elements use Arial (dominant) but one uses Times New Roman
    mock_theme = {
        "textClasses": {
            "default": {"fontFace": "Arial"}
        }
    }
    
    mock_layout = {
        "sections": [
            {
                "name": "Page 1",
                "displayName": "Sales Overview",
                "visualContainers": [
                    {
                        "config": json.dumps({
                            "singleVisual": {
                                "visualType": "barChart",
                                "vcObjects": {
                                    "title": [{
                                        "properties": {
                                            "text": {"Literal": {"Value": "'Sales Title'"}}
                                        }
                                    }]
                                }
                            }
                        })
                    },
                    {
                        "config": json.dumps({
                            "singleVisual": {
                                "visualType": "textbox",
                                "objects": {
                                    "general": [{
                                        "properties": {
                                            "paragraphs": [{
                                                "textRuns": [{
                                                    "textStyle": {"fontFamily": "Times New Roman"}
                                                }]
                                            }]
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
    
    violations = check_font_consistency(mock_layout, mock_theme)
    # Times New Roman should be flagged as warning with both font and size
    warnings = [v for v in violations if v["status"] == "warning"]
    assert len(warnings) == 1
    assert "Times New Roman" in warnings[0]["message"]
    assert "Arial" in warnings[0]["message"]
    assert "standard" not in warnings[0]["message"].lower()

    # Scenario 2: Perfect consistency (only Arial)
    mock_layout_clean = {
        "sections": [
            {
                "name": "Page 1",
                "displayName": "Sales Overview",
                "visualContainers": [
                    {
                        "config": json.dumps({
                            "singleVisual": {
                                "visualType": "barChart",
                                "vcObjects": {
                                    "title": [{
                                        "properties": {
                                            "text": {"Literal": {"Value": "'Sales Title'"}}
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
    violations_clean = check_font_consistency(mock_layout_clean, mock_theme)
    passes = [v for v in violations_clean if v["status"] == "pass"]
    assert len(passes) == 1
    assert "All headers use a consistent font and size, and all values use a consistent font and size, across the report." in passes[0]["message"]
    assert "standard" not in passes[0]["message"].lower()


def test_unused_measures():
    dax_measures = {
        "Total Sales": "SUM(Sales[Amount])",
        "Tax Amount": "SUM(Sales[Tax])",
        "YTD Sales": "[Total Sales] * 1.05", # depends on Total Sales
        "Orphan Measure": "100" # not used anywhere
    }
    
    dax_columns = {
        "Custom Margin": "Sales[Profit] / [Total Sales]"
    }
    
    # Layout only references [YTD Sales] in the config
    mock_layout = {
        "sections": [
            {
                "name": "Page 1",
                "visualContainers": [
                    {
                        "config": json.dumps({
                            "singleVisual": {
                                "visualType": "card",
                                "projections": {"Values": [{"queryRef": "YTD Sales"}]}
                            }
                        })
                    }
                ]
            }
        ]
    }
    
    violations, total, unused = check_unused_measures(dax_measures, dax_columns, mock_layout)
    # Total Sales is used (via YTD Sales dependency)
    # YTD Sales is used directly in layout
    # Tax Amount and Orphan Measure are unused
    unused_names = [v["target"].split(": ")[-1] for v in violations if v["status"] == "warning"]
    assert "Tax Amount" in unused_names
    assert "Orphan Measure" in unused_names
    assert "Total Sales" not in unused_names
    assert "YTD Sales" not in unused_names
    assert total == 4
    assert unused == 2


def test_visual_alignment():
    # Misaligned visuals (y differs by 3px) and overlap
    mock_layout = {
        "sections": [
            {
                "name": "Page 1",
                "displayName": "Sales Overview",
                "visualContainers": [
                    {
                        "x": 10,
                        "y": 10,
                        "width": 100,
                        "height": 100,
                        "config": json.dumps({"singleVisual": {"visualType": "barChart"}})
                    },
                    {
                        "x": 120,
                        "y": 13, # y diff of 3px from y=10
                        "width": 100,
                        "height": 100,
                        "config": json.dumps({"singleVisual": {"visualType": "lineChart"}})
                    },
                    # Overlapping visual
                    {
                        "x": 15,
                        "y": 15,
                        "width": 50,
                        "height": 50,
                        "config": json.dumps({"singleVisual": {"visualType": "card"}})
                    }
                ]
            }
        ]
    }
    
    violations = check_visual_alignment(mock_layout)
    warnings = [v for v in violations if v["status"] == "warning"]
    messages = [w["message"] for w in warnings]
    
    # y difference warning
    assert any("differ by 3px in y" in msg for msg in messages)
    # overlap warning
    assert any("overlap" in msg for msg in messages)
