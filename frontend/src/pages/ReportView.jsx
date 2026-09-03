import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { downloadProtectedFile } from '../lib/downloads';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  Download, ArrowLeft, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp, AlertCircle, Loader2, Info, Layers, FileCode, CheckSquare, X, ExternalLink
} from 'lucide-react';

export default function ReportView() {
  const { jobId } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Collapsed sections mapping {category_or_page: boolean}
  const [collapsed, setCollapsed] = useState({});
  // Filters
  const [statusFilter, setStatusFilter] = useState('all'); // all, pass, warning, fail
  const [categoryFilter, setCategoryFilter] = useState('all'); // all, or specific category key
  const [selectedPage, setSelectedPage] = useState('all'); // 'all', page_name, 'not_used', 'report_level'

  const [activeTab, setActiveTab] = useState('page'); // 'page' (default) or 'category'
  const [tableCollapsed, setTableCollapsed] = useState({});
  const [pageCollapsed, setPageCollapsed] = useState({});
  const [notUsedCollapsed, setNotUsedCollapsed] = useState(false);
  const [reportLevelCollapsed, setReportLevelCollapsed] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const response = await axios.get(`/api/jobs/${jobId}/result`);
        const data = response.data;
        setReport(data);
        
        // Initialize all category sections as expanded (collapsed = false)
        const initialCollapsed = {};
        if (data.sections) {
          data.sections.forEach(sec => {
            initialCollapsed[sec.category] = false;
          });
        }
        if (data.standalone_sections) {
          data.standalone_sections.forEach(sec => {
            initialCollapsed[sec.category] = false;
          });
        }
        setCollapsed(initialCollapsed);

        // Initialize page sections
        const initialPageCollapsed = {};
        const pages = data.page_grouped_view?.pages || (Array.isArray(data.page_grouped_view) ? data.page_grouped_view : []);
        pages.forEach((p) => {
          initialPageCollapsed[p.page_name] = false;
        });
        setPageCollapsed(initialPageCollapsed);

        // Default selected page to the first page if available
        if (pages.length > 0) {
          setSelectedPage(pages[0].page_name);
        }

      } catch (err) {
        console.error(err);
        setError("Failed to fetch report results. Check if the job finished successfully.");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [jobId]);

  const toggleCollapse = (key) => {
    setCollapsed(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const togglePageCollapse = (pageName) => {
    setPageCollapsed(prev => ({
      ...prev,
      [pageName]: !prev[pageName]
    }));
  };

  // Scroll helper: Scrolls down to a category or page card smoothly
  const scrollToCard = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      element.classList.add('ring-2', 'ring-indigo-500', 'transition-all');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-indigo-500');
      }, 1500);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="text-sm text-slate-600 font-medium">Loading analysis report...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-md mx-auto py-12">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-800">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">Error Loading Report</h2>
          <p className="text-sm mb-6">{error || "An unexpected error occurred."}</p>
          <Link to="/" className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const { summary, source, method, started_at, completed_at } = report;

  // Compile standalone sections and category sections
  const standaloneSections = report.standalone_sections || [];
  const categorySections = report.sections || [];
  const allSectionsForChart = [...standaloneSections, ...categorySections];

  // Standard ordered category list matching local test breakdown
  const allCategoriesList = [
    { key: 'power_query_naming', name: 'Power Query Step Naming' },
    { key: 'data_model', name: 'Data Model Alignment' },
    { key: 'dax_naming', name: 'DAX Measure Naming' },
    { key: 'dax_calculated_columns', name: 'DAX Calculated Column Naming' },
    { key: 'unused_measures', name: 'Unused Measures Check' },
    { key: 'unused_columns', name: 'Unused Columns Check' },
    { key: 'font_consistency', name: 'Font Consistency Check' },
    { key: 'visual_alignment', name: 'Visual Alignment Check' },
    { key: 'functional', name: 'Functional UI Testing' },
    { key: 'performance', name: 'Page Load & Render Performance' },
    { key: 'slicer_interactions', name: 'Slicer & Visual Interaction Matrix' },
    { key: 'dataset_refresh', name: 'Dataset Refresh Validation' },
    { key: 'dax_complexity', name: 'DAX Complexity & VAR Check' },
    { key: 'pdf_export', name: 'PDF Export Verification' },
    { key: 'excel_export', name: 'Excel Export Verification' }
  ];

  const pageGroupedView = report.page_grouped_view || {};
  const pagesList = pageGroupedView.pages || (Array.isArray(pageGroupedView) ? pageGroupedView : []);
  const unassigned = pageGroupedView.unassigned || {};
  const notUsedOnAnyPage = unassigned.not_used_on_any_page || [];
  const reportLevelChecks = unassigned.report_level_checks || [];

  // Filter helper functions
  const matchesCategory = (resCategory, specificCat = null) => {
    const targetCat = specificCat || categoryFilter;
    if (targetCat === 'all') return true;
    if (targetCat === 'dax_calculated_columns' || targetCat === 'dax_calculated_column_naming') {
      return resCategory === 'dax_calculated_columns' || resCategory === 'dax_calculated_column_naming';
    }
    if (targetCat === 'export_pdf' || targetCat === 'pdf_export') {
      return resCategory === 'export_pdf' || resCategory === 'pdf_export';
    }
    if (targetCat === 'export_excel' || targetCat === 'excel_export') {
      return resCategory === 'export_excel' || resCategory === 'export_excel';
    }
    return resCategory === targetCat;
  };

  const matchesStatus = (resStatus) => {
    if (statusFilter === 'all') return true;
    return resStatus === statusFilter;
  };

  // Dynamic category stats based on the currently selected page (or all pages)
  const getPageCategoryStats = (catKey) => {
    let matchedResults = [];
    if (selectedPage === 'all' || activeTab === 'category') {
      allSectionsForChart.forEach(sec => {
        if (
          sec.category === catKey || 
          (catKey === 'dax_calculated_columns' && sec.category === 'dax_calculated_column_naming') ||
          (catKey === 'export_pdf' && sec.category === 'pdf_export') ||
          (catKey === 'pdf_export' && sec.category === 'export_pdf') ||
          (catKey === 'export_excel' && sec.category === 'excel_export') ||
          (catKey === 'excel_export' && sec.category === 'export_excel')
        ) {
          matchedResults = [...matchedResults, ...(sec.results || [])];
        }
      });
    } else if (selectedPage === 'not_used') {
      matchedResults = notUsedOnAnyPage.filter(r => matchesCategory(r.category, catKey));
    } else if (selectedPage === 'report_level') {
      matchedResults = reportLevelChecks.filter(r => matchesCategory(r.category, catKey));
    } else {
      const curPage = pagesList.find(p => p.page_name === selectedPage);
      if (curPage) {
        const items = [
          ...(curPage.dax_results || []),
          ...(curPage.page_level_results || []),
          ...(curPage.visual_results || [])
        ];
        matchedResults = items.filter(r => matchesCategory(r.category, catKey));
      }
    }
    const failed = matchedResults.filter(r => r.status === 'fail').length;
    const warnings = matchedResults.filter(r => r.status === 'warning').length;
    const passed = matchedResults.filter(r => r.status === 'pass').length;
    return { count: matchedResults.length, failed, warnings, passed };
  };

  // Prepare chart data ensuring all categories appear consistently on the axis
  const chartData = allCategoriesList.map(cat => {
    const sec = allSectionsForChart.find(s => 
      s.category === cat.key || 
      (cat.key === 'dax_calculated_columns' && s.category === 'dax_calculated_column_naming') ||
      (cat.key === 'export_pdf' && s.category === 'pdf_export') ||
      (cat.key === 'pdf_export' && s.category === 'export_pdf') ||
      (cat.key === 'export_excel' && s.category === 'excel_export') ||
      (cat.key === 'excel_export' && s.category === 'export_excel')
    );
    const results = sec ? (sec.results || []) : [];
    const passed = results.filter(r => r.status === 'pass').length;
    const warnings = results.filter(r => r.status === 'warning').length;
    const failed = results.filter(r => r.status === 'fail').length;
    return {
      name: cat.name,
      categoryKey: cat.key,
      Passed: passed,
      Warnings: warnings,
      Failed: failed
    };
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back button & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link 
          to="/history"
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 font-semibold"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to History
        </Link>
        
        <button
          onClick={() => downloadProtectedFile(`/api/jobs/${jobId}/report.pdf`, `pbi_qa_report_${jobId}.pdf`)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <Download className="h-4 w-4" />
          Download PDF Report
        </button>
      </div>

      {/* Title block */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                {method === 'pbix_upload' ? 'PBIX Static & Functional' : 'Power BI Service'}
              </span>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                {report.report_name && !report.report_name.startsWith('http') 
                  ? report.report_name 
                  : (method === 'pbix_upload' 
                      ? (source || 'PBIX Analysis Report') 
                      : 'Power BI Service Live Report')}
              </h1>
            </div>

            {source && source.startsWith('http') && (
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[11px] text-slate-400 font-medium shrink-0">Service URL:</span>
                <a
                  href={source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-mono truncate max-w-xl inline-flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded border border-slate-200"
                  title={source}
                >
                  <span className="truncate">{source}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
            )}
            <p className="text-xs text-slate-400 mt-1 font-mono">Job ID: {jobId}</p>
          </div>
          
          <div className="text-right text-xs text-slate-500 space-y-0.5">
            {started_at && <div>Started: {new Date(started_at).toLocaleString()}</div>}
            {completed_at && <div>Completed: {new Date(completed_at).toLocaleString()}</div>}
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-slate-100 text-slate-700 rounded-lg">
            <CheckSquare className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold uppercase">Total Checks</div>
            <div className="text-xl font-bold text-slate-900">{summary.total_checks}</div>
          </div>
        </div>

        <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold uppercase">Passed</div>
            <div className="text-xl font-bold text-emerald-600">{summary.passed}</div>
          </div>
        </div>

        <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold uppercase">Warnings</div>
            <div className="text-xl font-bold text-amber-600">{summary.warnings}</div>
          </div>
        </div>

        <div className="bg-white border border-rose-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
            <XCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold uppercase">Failed</div>
            <div className="text-xl font-bold text-rose-600">{summary.failed}</div>
          </div>
        </div>
      </div>

      {/* Chart Block */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="font-bold text-slate-800 text-sm mb-4">Findings Breakdown by Category</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 40 }}
            >
              <XAxis 
                dataKey="name" 
                stroke="#64748b" 
                fontSize={9} 
                tickLine={false} 
                interval={0} 
                angle={-25} 
                textAnchor="end" 
                height={60} 
              />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
              <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
              <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="Passed" stackId="a" fill="#10b981" />
              <Bar dataKey="Warnings" stackId="a" fill="#f59e0b" />
              <Bar dataKey="Failed" stackId="a" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. STANDALONE SECTIONS (Always Pinned at the Top in Both Views)             */}
      {/* ========================================================================= */}
      {standaloneSections.some(sec => matchesCategory(sec.category)) && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              📌 Model & Dataset Level Audits (Global Standards)
            </span>
          </div>

          {standaloneSections.map(sec => {
            if (!matchesCategory(sec.category)) return null;

            const filteredResults = (sec.results || []).filter(res => {
              return matchesStatus(res.status);
            });
            
            if (filteredResults.length === 0 && statusFilter !== 'all') return null;

            const isCollapsed = collapsed[sec.category];

            return (
              <div 
                key={sec.category}
                id={`sec-${sec.category}`}
                className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden scroll-mt-6"
              >
                {/* Header */}
                <div 
                  onClick={() => toggleCollapse(sec.category)}
                  className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100/70 transition-colors select-none"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 text-sm">{sec.category_name || sec.title}</h3>
                    <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                      {filteredResults.length} {filteredResults.length === 1 ? 'item' : 'items'}
                    </span>
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded border border-indigo-200">
                      Standalone Model Check
                    </span>
                  </div>
                  {isCollapsed ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronUp className="h-4 w-4 text-slate-500" />}
                </div>

                {/* Content */}
                {!isCollapsed && (
                  <div className="divide-y divide-slate-100 px-5">
                    {sec.excluded_note && (
                      <div className="my-3 p-2.5 bg-slate-50 border border-slate-200/80 text-slate-600 rounded-lg text-xs leading-relaxed flex items-center gap-2">
                        <Info className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        <span>{sec.excluded_note}</span>
                      </div>
                    )}

                    {/* Power Query Step Naming Table-Wise Rendering */}
                    {sec.category === 'power_query_naming' && sec.tables ? (
                      <div className="space-y-4 py-4">
                        {sec.tables.map(table => {
                          const filteredTableResults = table.results.filter(res => {
                            return matchesStatus(res.status);
                          });
                          if (filteredTableResults.length === 0 && statusFilter !== 'all') return null;

                          const isTCollapsed = tableCollapsed[table.table_name] !== undefined 
                            ? tableCollapsed[table.table_name] 
                            : !table.results.some(r => r.status === 'fail' || r.status === 'warning');

                          return (
                            <div key={table.table_name} className="border border-slate-200 rounded-lg overflow-hidden">
                              <div 
                                onClick={() => setTableCollapsed(prev => ({...prev, [table.table_name]: !isTCollapsed}))}
                                className="bg-slate-50/50 px-4 py-2.5 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors select-none"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800 text-xs font-mono">{table.table_name}</span>
                                  <span className="text-[10px] text-slate-500 font-medium">({filteredTableResults.length} steps)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {table.summary.failed > 0 && <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-1.5 py-0.5 rounded">{table.summary.failed} Failed</span>}
                                  {table.summary.warnings > 0 && <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-1.5 py-0.5 rounded">{table.summary.warnings} Warnings</span>}
                                  {table.summary.passed > 0 && <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-1.5 py-0.5 rounded">{table.summary.passed} Passed</span>}
                                  {isTCollapsed ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronUp className="h-3.5 w-3.5 text-slate-400" />}
                                </div>
                              </div>
                              {!isTCollapsed && (
                                <div className="divide-y divide-slate-100 px-4 bg-white">
                                  {filteredTableResults.map((res, rIdx) => (
                                    <div key={rIdx} className="py-3 flex items-start justify-between gap-4">
                                      <div className="space-y-1">
                                        <h5 className="font-bold text-slate-800 text-xs font-mono">{res.target}</h5>
                                        <p className="text-xs text-slate-600 leading-relaxed">{res.message}</p>
                                        {res.suggested_fix && (
                                          <div className="mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded text-[11px] leading-relaxed">
                                            <strong className="font-bold text-slate-700">Suggested Fix: </strong>
                                            <span className="text-slate-600">{res.suggested_fix}</span>
                                          </div>
                                        )}
                                      </div>
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border flex-shrink-0 flex items-center gap-1 ${res.status === 'pass' && 'bg-emerald-50 text-emerald-800 border-emerald-200'} ${res.status === 'warning' && 'bg-amber-50 text-amber-800 border-amber-200'} ${res.status === 'fail' && 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                                        {res.status}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Default Flat List for Data Model */
                      <div className="divide-y divide-slate-100 py-1">
                        {filteredResults.map((res, rIdx) => (
                          <div key={rIdx} className="py-3.5 flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <h4 className="font-bold text-slate-800 text-xs font-mono">{res.target}</h4>
                              <p className="text-xs text-slate-600 leading-relaxed">{res.message}</p>
                              {res.suggested_fix && (
                                <div className="mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded text-[11px] leading-relaxed">
                                  <strong className="font-bold text-slate-700">Suggested Fix: </strong>
                                  <span className="text-slate-600">{res.suggested_fix}</span>
                                </div>
                              )}
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border flex-shrink-0 flex items-center gap-1 ${
                              res.status === 'pass' && 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            } ${
                              res.status === 'warning' && 'bg-amber-50 text-amber-800 border-amber-200'
                            } ${
                              res.status === 'fail' && 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}>
                              {res.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 1: SELECT REPORT PAGE                                                */}
      {/* ========================================================================= */}
      {activeTab === 'page' && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-indigo-600" />
              STEP 1: SELECT REPORT PAGE
            </span>
            {selectedPage !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedPage('all')}
                className="text-xs text-indigo-600 font-bold hover:underline"
              >
                View All Pages
              </button>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2">
            {pagesList.map(page => {
              const allPageItems = [
                ...(page.dax_results || []),
                ...(page.page_level_results || []),
                ...(page.visual_results || [])
              ];
              const failed = allPageItems.filter(r => r.status === 'fail').length;
              const warnings = allPageItems.filter(r => r.status === 'warning').length;
              const isSelected = selectedPage === page.page_name;

              return (
                <button
                  key={page.page_name}
                  type="button"
                  onClick={() => setSelectedPage(page.page_name)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-2 ${
                    isSelected
                      ? 'bg-indigo-600 text-white font-bold ring-2 ring-indigo-300'
                      : 'bg-white border border-slate-200 text-slate-700 hover:border-indigo-400 hover:text-indigo-600'
                  }`}
                >
                  <span>{page.page_name}</span>
                  <span className="flex items-center gap-1">
                    {failed > 0 && <span className={`h-2 w-2 rounded-full ${isSelected ? 'bg-rose-300' : 'bg-rose-500'}`}></span>}
                    {warnings > 0 && <span className={`h-2 w-2 rounded-full ${isSelected ? 'bg-amber-300' : 'bg-amber-500'}`}></span>}
                    {failed === 0 && warnings === 0 && <span className={`h-2 w-2 rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-emerald-500'}`}></span>}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    isSelected ? 'bg-indigo-700/60 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {allPageItems.length}
                  </span>
                </button>
              );
            })}

            {notUsedOnAnyPage.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedPage('not_used')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-2 ${
                  selectedPage === 'not_used'
                    ? 'bg-indigo-600 text-white font-bold ring-2 ring-indigo-300'
                    : 'bg-white border border-slate-200 text-slate-700 hover:border-indigo-400 hover:text-indigo-600'
                }`}
              >
                <span>Not Used On Any Page</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  selectedPage === 'not_used' ? 'bg-indigo-700/60 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {notUsedOnAnyPage.length}
                </span>
              </button>
            )}

            {reportLevelChecks.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedPage('report_level')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-2 ${
                  selectedPage === 'report_level'
                    ? 'bg-indigo-600 text-white font-bold ring-2 ring-indigo-300'
                    : 'bg-white border border-slate-200 text-slate-700 hover:border-indigo-400 hover:text-indigo-600'
                }`}
              >
                <span>Report-Level Checks</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  selectedPage === 'report_level' ? 'bg-indigo-700/60 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {reportLevelChecks.length}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSelectedPage('all')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 ${
                selectedPage === 'all'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-400'
              }`}
            >
              All Pages
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: CATEGORY FILTER BAR (Categories for Selected Page)                */}
      {/* ========================================================================= */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <span>🎯</span> QUICK NAVIGATION SHORTCUTS (CATEGORIES)
            {selectedPage !== 'all' && (
              <span className="text-indigo-600 font-bold ml-1">
                — {selectedPage === 'not_used' ? 'Not Used On Any Page' : selectedPage === 'report_level' ? 'Report-Level Checks' : selectedPage}
              </span>
            )}
          </span>
          {categoryFilter !== 'all' && (
            <button
              onClick={() => setCategoryFilter('all')}
              className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1"
            >
              <X className="h-3.5 w-3.5" />
              Reset Filter (Showing All Categories)
            </button>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2">
          {/* All Categories Option */}
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 ${
              categoryFilter === 'all'
                ? 'bg-slate-900 text-white font-bold'
                : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-400'
            }`}
          >
            All Categories
          </button>

          {/* 12 Individual Category Filter Buttons */}
          {allCategoriesList.map(cat => {
            const stats = getPageCategoryStats(cat.key);
            const isSelected = categoryFilter === cat.key || 
              (cat.key === 'dax_calculated_columns' && categoryFilter === 'dax_calculated_column_naming');
            const hasItems = stats.count > 0;

            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => {
                  setCategoryFilter(prev => (prev === cat.key ? 'all' : cat.key));
                  if (activeTab === 'category') {
                    scrollToCard(`category-sec-${cat.key}`);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-indigo-600 text-white font-bold ring-2 ring-indigo-300'
                    : hasItems
                      ? 'bg-white border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 text-slate-700'
                      : 'bg-slate-100/70 border border-slate-200/60 text-slate-400 opacity-60'
                }`}
              >
                <span>{cat.name}</span>
                {hasItems ? (
                  <span className="flex items-center gap-1">
                    {stats.failed > 0 && (
                      <span className={`h-2 w-2 rounded-full ${isSelected ? 'bg-rose-300' : 'bg-rose-500'}`}></span>
                    )}
                    {stats.warnings > 0 && (
                      <span className={`h-2 w-2 rounded-full ${isSelected ? 'bg-amber-300' : 'bg-amber-500'}`}></span>
                    )}
                    {stats.failed === 0 && stats.warnings === 0 && (
                      <span className={`h-2 w-2 rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-emerald-500'}`}></span>
                    )}
                    <span className={`text-[10px] ml-0.5 font-mono ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                      ({stats.count})
                    </span>
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 font-mono">(0)</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Detail Block */}
      <div className="space-y-4">
        {/* Detail Filter and Tab Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-3 gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-900">QA Audit Finding Details</h2>
            
            <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('page')}
                className={`px-3 py-1 rounded transition-all flex items-center gap-1 ${
                  activeTab === 'page' ? 'bg-white text-indigo-700 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-950'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                Page View (Default)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('category')}
                className={`px-3 py-1 rounded transition-all flex items-center gap-1 ${
                  activeTab === 'category' ? 'bg-white text-indigo-700 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-950'
                }`}
              >
                <FileCode className="h-3.5 w-3.5" />
                Category View
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 text-xs self-start md:self-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'all' ? 'bg-slate-900 text-white font-medium' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('fail')}
              className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                statusFilter === 'fail' ? 'bg-rose-600 text-white font-medium' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Failed
            </button>
            <button
              onClick={() => setStatusFilter('warning')}
              className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                statusFilter === 'warning' ? 'bg-amber-500 text-white font-medium' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Warnings
            </button>
            <button
              onClick={() => setStatusFilter('pass')}
              className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                statusFilter === 'pass' ? 'bg-emerald-600 text-white font-medium' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Passed
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: PAGE VIEW (Default View)                                           */}
        {/* ========================================================================= */}
        {activeTab === 'page' && (
          <div className="space-y-6">
            {/* Real Report Pages */}
            {pagesList.map(page => {
              // Only display this page if selectedPage is 'all' or matches this page
              if (selectedPage !== 'all' && selectedPage !== page.page_name) return null;

              const filteredDax = (page.dax_results || []).filter(r => matchesCategory(r.category) && matchesStatus(r.status));
              const filteredPageLevel = (page.page_level_results || []).filter(r => matchesCategory(r.category) && matchesStatus(r.status));
              const filteredVisuals = (page.visual_results || []).filter(r => matchesCategory(r.category) && matchesStatus(r.status));

              const totalFiltered = filteredDax.length + filteredPageLevel.length + filteredVisuals.length;
              if (totalFiltered === 0 && (statusFilter !== 'all' || categoryFilter !== 'all')) return null;

              const isPageCollapsed = pageCollapsed[page.page_name] || false;
              const allPageItems = [...(page.dax_results || []), ...(page.page_level_results || []), ...(page.visual_results || [])];
              const pFailed = allPageItems.filter(r => r.status === 'fail').length;
              const pWarnings = allPageItems.filter(r => r.status === 'warning').length;
              const pPassed = allPageItems.filter(r => r.status === 'pass').length;

              return (
                <div 
                  key={page.page_name}
                  id={`page-card-${page.page_name}`}
                  className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden scroll-mt-6"
                >
                  {/* Page Card Header */}
                  <div 
                    onClick={() => togglePageCollapse(page.page_name)}
                    className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100/70 transition-colors select-none"
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-indigo-600" />
                      <h3 className="font-bold text-slate-900 text-sm">Report Page: {page.page_name}</h3>
                      <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                        {totalFiltered} {totalFiltered === 1 ? 'finding' : 'findings'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {pFailed > 0 && (
                        <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded">
                          {pFailed} Failed
                        </span>
                      )}
                      {pWarnings > 0 && (
                        <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded">
                          {pWarnings} Warnings
                        </span>
                      )}
                      {pPassed > 0 && (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded">
                          {pPassed} Passed
                        </span>
                      )}
                      {isPageCollapsed ? <ChevronDown className="h-4 w-4 text-slate-500 ml-1" /> : <ChevronUp className="h-4 w-4 text-slate-500 ml-1" />}
                    </div>
                  </div>

                  {/* Page Card Content */}
                  {!isPageCollapsed && (
                    <div className="p-5 space-y-6">
                      {/* Section 1: DAX Measures & Columns Used on This Page */}
                      {filteredDax.length > 0 && (
                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                              <FileCode className="h-3.5 w-3.5 text-indigo-500" />
                              DAX Measures & Calculated Columns Used On This Page
                            </span>
                            <span className="text-[10px] bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded font-semibold">
                              {filteredDax.length} items
                            </span>
                          </div>
                          <div className="divide-y divide-slate-100 px-4 bg-white">
                            {filteredDax.map((res, rIdx) => (
                              <div key={rIdx} className="py-3.5 flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-slate-800 text-xs font-mono">{res.target}</h4>
                                    <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded uppercase font-semibold">
                                      {res.category?.replace(/_/g, ' ')}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-600 leading-relaxed">{res.message}</p>
                                  {res.suggested_fix && (
                                    <div className="mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded text-[11px] leading-relaxed">
                                      <strong className="font-bold text-slate-700">Suggested Fix: </strong>
                                      <span className="text-slate-600">{res.suggested_fix}</span>
                                    </div>
                                  )}
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border flex-shrink-0 flex items-center gap-1 ${
                                  res.status === 'pass' && 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                } ${
                                  res.status === 'warning' && 'bg-amber-50 text-amber-800 border-amber-200'
                                } ${
                                  res.status === 'fail' && 'bg-rose-50 text-rose-800 border-rose-200'
                                }`}>
                                  {res.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Section 2: Page-Level Standard Checks */}
                      {filteredPageLevel.length > 0 && (
                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                              <CheckSquare className="h-3.5 w-3.5 text-indigo-500" />
                              Page-Level Standard & Functional Checks
                            </span>
                            <span className="text-[10px] bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded font-semibold">
                              {filteredPageLevel.length} items
                            </span>
                          </div>
                          <div className="divide-y divide-slate-100 px-4 bg-white">
                            {filteredPageLevel.map((res, rIdx) => (
                              <div key={rIdx} className="py-3.5 flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                  <h4 className="font-bold text-slate-800 text-xs font-mono">{res.target}</h4>
                                  <p className="text-xs text-slate-600 leading-relaxed">{res.message}</p>
                                  {res.suggested_fix && (
                                    <div className="mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded text-[11px] leading-relaxed">
                                      <strong className="font-bold text-slate-700">Suggested Fix: </strong>
                                      <span className="text-slate-600">{res.suggested_fix}</span>
                                    </div>
                                  )}
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border flex-shrink-0 flex items-center gap-1 ${
                                  res.status === 'pass' && 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                } ${
                                  res.status === 'warning' && 'bg-amber-50 text-amber-800 border-amber-200'
                                } ${
                                  res.status === 'fail' && 'bg-rose-50 text-rose-800 border-rose-200'
                                }`}>
                                  {res.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Section 3: Visual Container Elements & Findings */}
                      {filteredVisuals.length > 0 && (
                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                              <Layers className="h-3.5 w-3.5 text-indigo-500" />
                              Visual Container Formatting, Alignment & Interactivity
                            </span>
                            <span className="text-[10px] bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded font-semibold">
                              {filteredVisuals.length} items
                            </span>
                          </div>
                          <div className="divide-y divide-slate-100 px-4 bg-white">
                            {filteredVisuals.map((res, rIdx) => (
                              <div key={rIdx} className="py-3.5 flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-slate-800 text-xs font-mono">{res.target}</h4>
                                    <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded uppercase font-semibold">
                                      {res.category?.replace(/_/g, ' ')}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-600 leading-relaxed">{res.message}</p>
                                  {res.suggested_fix && (
                                    <div className="mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded text-[11px] leading-relaxed">
                                      <strong className="font-bold text-slate-700">Suggested Fix: </strong>
                                      <span className="text-slate-600">{res.suggested_fix}</span>
                                    </div>
                                  )}
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border flex-shrink-0 flex items-center gap-1 ${
                                  res.status === 'pass' && 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                } ${
                                  res.status === 'warning' && 'bg-amber-50 text-amber-800 border-amber-200'
                                } ${
                                  res.status === 'fail' && 'bg-rose-50 text-rose-800 border-rose-200'
                                }`}>
                                  {res.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {filteredDax.length === 0 && filteredPageLevel.length === 0 && filteredVisuals.length === 0 && (
                        <div className="text-center py-6 text-slate-400 text-xs flex flex-col items-center gap-1">
                          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                          <span>No issues found on this page matching the current filter.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Special Bucket 1: Not Used On Any Page */}
            {(selectedPage === 'all' || selectedPage === 'not_used') && notUsedOnAnyPage.length > 0 && (() => {
              const filteredNotUsed = notUsedOnAnyPage.filter(r => matchesCategory(r.category) && matchesStatus(r.status));
              if (filteredNotUsed.length === 0 && (statusFilter !== 'all' || categoryFilter !== 'all')) return null;

              const nuFailed = notUsedOnAnyPage.filter(r => r.status === 'fail').length;
              const nuWarnings = notUsedOnAnyPage.filter(r => r.status === 'warning').length;
              const nuPassed = notUsedOnAnyPage.filter(r => r.status === 'pass').length;

              return (
                <div 
                  id="card-not-used-on-any-page"
                  className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden scroll-mt-6"
                >
                  <div 
                    onClick={() => setNotUsedCollapsed(prev => !prev)}
                    className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100/70 transition-colors select-none"
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-sm">Not Used On Any Page</h3>
                      <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                        {filteredNotUsed.length} {filteredNotUsed.length === 1 ? 'item' : 'items'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium ml-1">
                        (Unused measures, columns, and unreferenced definitions)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {nuFailed > 0 && (
                        <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded">
                          {nuFailed} Failed
                        </span>
                      )}
                      {nuWarnings > 0 && (
                        <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded">
                          {nuWarnings} Warnings
                        </span>
                      )}
                      {nuPassed > 0 && (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded">
                          {nuPassed} Passed
                        </span>
                      )}
                      {notUsedCollapsed ? <ChevronDown className="h-4 w-4 text-slate-500 ml-1" /> : <ChevronUp className="h-4 w-4 text-slate-500 ml-1" />}
                    </div>
                  </div>

                  {!notUsedCollapsed && (
                    <div className="p-5 space-y-4">
                      <div className="p-3 bg-amber-50/50 border border-amber-200 text-amber-900 rounded-lg text-xs leading-relaxed flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <span>Note: Measures and columns used only by external connections (Analyze in Excel, paginated reports, or downstream reports via live connection) cannot be detected in layout files and may appear here.</span>
                      </div>

                      <div className="divide-y divide-slate-100 bg-white">
                        {filteredNotUsed.map((res, rIdx) => (
                          <div key={rIdx} className="py-3 flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-slate-800 text-xs font-mono">{res.target}</h4>
                                <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded uppercase font-semibold">
                                  {res.category?.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 leading-relaxed">{res.message}</p>
                              {res.suggested_fix && (
                                <div className="mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded text-[11px] leading-relaxed">
                                  <strong className="font-bold text-slate-700">Suggested Fix: </strong>
                                  <span className="text-slate-600">{res.suggested_fix}</span>
                                </div>
                              )}
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border flex-shrink-0 flex items-center gap-1 ${
                              res.status === 'pass' && 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            } ${
                              res.status === 'warning' && 'bg-amber-50 text-amber-800 border-amber-200'
                            } ${
                              res.status === 'fail' && 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}>
                              {res.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Special Bucket 2: Report-Level Checks */}
            {(selectedPage === 'all' || selectedPage === 'report_level') && reportLevelChecks.length > 0 && (() => {
              const filteredReportLevel = reportLevelChecks.filter(r => matchesCategory(r.category) && matchesStatus(r.status));
              if (filteredReportLevel.length === 0 && (statusFilter !== 'all' || categoryFilter !== 'all')) return null;

              return (
                <div 
                  id="card-report-level-checks"
                  className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden scroll-mt-6"
                >
                  <div 
                    onClick={() => setReportLevelCollapsed(prev => !prev)}
                    className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100/70 transition-colors select-none"
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-sm">Report-Level Checks</h3>
                      <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                        {filteredReportLevel.length} {filteredReportLevel.length === 1 ? 'item' : 'items'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium ml-1">
                        (PDF Export, Excel Export, Global Verification)
                      </span>
                    </div>
                    {reportLevelCollapsed ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronUp className="h-4 w-4 text-slate-500" />}
                  </div>

                  {!reportLevelCollapsed && (
                    <div className="divide-y divide-slate-100 px-5 bg-white">
                      {filteredReportLevel.map((res, rIdx) => (
                        <div key={rIdx} className="py-3.5 flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-800 text-xs font-mono">{res.target}</h4>
                              <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded uppercase font-semibold">
                                {res.category?.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">{res.message}</p>
                            {res.suggested_fix && (
                              <div className="mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded text-[11px] leading-relaxed">
                                <strong className="font-bold text-slate-700">Suggested Fix: </strong>
                                <span className="text-slate-600">{res.suggested_fix}</span>
                              </div>
                            )}
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border flex-shrink-0 flex items-center gap-1 ${
                            res.status === 'pass' && 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          } ${
                            res.status === 'warning' && 'bg-amber-50 text-amber-800 border-amber-200'
                          } ${
                            res.status === 'fail' && 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}>
                            {res.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: CATEGORY VIEW (Secondary Toggle)                                   */}
        {/* ========================================================================= */}
        {activeTab === 'category' && categorySections.map(sec => {
          if (!matchesCategory(sec.category)) return null;

          const filteredResults = (sec.results || []).filter(res => {
            return matchesStatus(res.status);
          });
          
          if (filteredResults.length === 0 && (statusFilter !== 'all' || categoryFilter !== 'all')) return null;

          const isCollapsed = collapsed[sec.category];

          return (
            <div 
              key={sec.category}
              id={`category-sec-${sec.category}`}
              className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden scroll-mt-6"
            >
              {/* Section Header */}
              <div 
                onClick={() => toggleCollapse(sec.category)}
                className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100/70 transition-colors select-none"
              >
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-800 text-sm">{sec.category_name || sec.title}</h3>
                  <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                    {filteredResults.length} {filteredResults.length === 1 ? 'item' : 'items'}
                  </span>
                  {sec.summary_info && (
                    <span className="text-xs text-slate-500 font-medium ml-2">({sec.summary_info})</span>
                  )}
                </div>
                {isCollapsed ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronUp className="h-4 w-4 text-slate-500" />}
              </div>

              {/* Section Content */}
              {!isCollapsed && (
                <div className="divide-y divide-slate-100 px-5">
                  {sec.excluded_note && (
                    <div className="my-3 p-2.5 bg-slate-50 border border-slate-200/80 text-slate-600 rounded-lg text-xs leading-relaxed flex items-center gap-2">
                      <Info className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span>{sec.excluded_note}</span>
                    </div>
                  )}

                  {sec.caveat && (
                    <div className="my-3 p-3 bg-amber-50/50 border border-amber-200 text-amber-900 rounded-lg text-xs leading-relaxed flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <span>{sec.caveat}</span>
                    </div>
                  )}

                  <div className="divide-y divide-slate-100 py-1">
                    {filteredResults.map((res, rIdx) => (
                      <div key={rIdx} className="py-3.5 flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <h4 className="font-bold text-slate-800 text-xs font-mono">{res.target}</h4>
                          <p className="text-xs text-slate-600 leading-relaxed">{res.message}</p>
                          {res.suggested_fix && (
                            <div className="mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded text-[11px] leading-relaxed">
                              <strong className="font-bold text-slate-700">Suggested Fix: </strong>
                              <span className="text-slate-600">{res.suggested_fix}</span>
                            </div>
                          )}
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border flex-shrink-0 flex items-center gap-1 ${
                          res.status === 'pass' && 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        } ${
                          res.status === 'warning' && 'bg-amber-50 text-amber-800 border-amber-200'
                        } ${
                          res.status === 'fail' && 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}>
                          {res.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
