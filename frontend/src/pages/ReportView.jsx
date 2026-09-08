import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { downloadProtectedFile } from '../lib/downloads';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  Download, ArrowLeft, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp, 
  AlertCircle, Loader2, Info, Layers, FileCode, CheckSquare, X, ExternalLink,
  BarChart3, Zap, Database, LayoutGrid, CheckCheck, Box, RefreshCw,
  Home, BookOpen, GitBranch, FileText, Archive, ClipboardList, ChevronLeft, ChevronRight,
  Bookmark, Sliders, Compass, Gauge, PieChart, TrendingUp, Table, CreditCard
} from 'lucide-react';

export default function ReportView() {
  const { jobId } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Sidebar active item: 'overview' | 'power_query' | 'data_model' | page_name | 'not_used' | 'report_level'
  const [sidebarActive, setSidebarActive] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Collapsed sections mapping
  const [collapsed, setCollapsed] = useState({});
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedPage, setSelectedPage] = useState('all');

  const [activeTab, setActiveTab] = useState('page');
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

        const initialPageCollapsed = {};
        const pages = data.page_grouped_view?.pages || (Array.isArray(data.page_grouped_view) ? data.page_grouped_view : []);
        pages.forEach((p) => {
          initialPageCollapsed[p.page_name] = false;
        });
        setPageCollapsed(initialPageCollapsed);

        if (pages.length > 0) {
          setSelectedPage(pages[0].page_name);
          setSidebarActive(pages[0].page_name);
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

  const handleSidebarNav = (key) => {
    setSidebarActive(key);
    if (key === 'overview') {
      // stay on overview section, no page filter needed
      setSelectedPage('all');
    } else if (key === 'power_query' || key === 'data_model' || key === 'all_categories') {
      // standalone sections / category view — just set active
    } else if (key === 'not_used') {
      setSelectedPage('not_used');
    } else if (key === 'report_level') {
      setSelectedPage('report_level');
    } else {
      // it's a page name
      setSelectedPage(key);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 space-y-4 w-full">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
        <p className="text-sm text-slate-700 font-semibold">Loading QA Analysis Report...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="w-full flex items-center justify-center py-12">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center text-rose-800 shadow-sm max-w-md w-full">
          <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">Error Loading Report</h2>
          <p className="text-xs mb-6 text-rose-700">{error || "An unexpected error occurred."}</p>
          <Link to="/landing" className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold">
            Return to Test Suite
          </Link>
        </div>
      </div>
    );
  }

  const { summary, source, method, started_at, completed_at } = report;
  const standaloneSections = report.standalone_sections || [];
  const categorySections = report.sections || [];
  const allSectionsForChart = [...standaloneSections, ...categorySections];

  const allCategoriesList = [
    { key: 'power_query_naming', name: 'Query Step Naming' },
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

  const chartData = allCategoriesList.map(item => {
    const sec = allSectionsForChart.find(s => s.category === item.key);
    const results = sec?.results || [];
    return {
      name: item.name,
      Passed: results.filter(r => r.status === 'pass').length,
      Warnings: results.filter(r => r.status === 'warning').length,
      Failed: results.filter(r => r.status === 'fail' || r.status === 'error').length
    };
  });

  const pageGroupedView = report.page_grouped_view || {};
  const pagesList = pageGroupedView.pages || [];
  const notUsedList = pageGroupedView.unassigned?.not_used_on_any_page || [];
  const reportLevelList = pageGroupedView.unassigned?.report_level_checks || [];

  const matchesStatus = (status) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'fail') return status === 'fail' || status === 'error';
    return status === statusFilter;
  };

  const matchesCategory = (category) => {
    if (categoryFilter === 'all') return true;
    return category === categoryFilter;
  };

  const totalChecksCount = summary.total_checks ?? summary.total ?? 0;
  const passedCount = summary.passed ?? 0;
  const warningsCount = summary.warnings ?? 0;
  const failedCount = summary.failed ?? 0;

  // ── Sidebar nav items ──────────────────────────────────────────────────────
  const powerQuerySec = standaloneSections.find(s => s.category === 'power_query_naming');
  const dataModelSec  = standaloneSections.find(s => s.category === 'data_model');

  const sidebarItems = [
    {
      key: 'overview',
      label: 'Overview',
      icon: <BarChart3 className="h-4 w-4 flex-shrink-0" />,
      count: null,
    },
    ...(powerQuerySec ? [{
      key: 'power_query',
      label: 'Power Query (M)',
      icon: <Zap className="h-4 w-4 flex-shrink-0" />,
      count: powerQuerySec.results?.length ?? 0,
    }] : []),
    ...(dataModelSec ? [{
      key: 'data_model',
      label: 'Data Model & Schema',
      icon: <Database className="h-4 w-4 flex-shrink-0" />,
      count: dataModelSec.results?.length ?? 0,
    }] : []),
    ...(pagesList.length > 0 ? [{
      type: 'header',
      key: 'header_sheets',
      label: 'Pages',
      icon: <BookOpen className="h-3.5 w-3.5 text-indigo-500" />,
      count: pagesList.length,
      isSeparator: true,
    }] : []),
    ...pagesList.map(page => {
      const allFindings = [
        ...(page.dax_results || []),
        ...(page.visual_results || []),
        ...(page.page_level_results || [])
      ];
      const hasFail = allFindings.some(r => r.status === 'fail' || r.status === 'error');
      const hasWarn = allFindings.some(r => r.status === 'warning');
      return {
        key: page.page_name,
        label: page.page_name,
        icon: <FileText className="h-4 w-4 flex-shrink-0" />,
        count: allFindings.length,
        hasFail,
        hasWarn,
        isPageItem: true,
      };
    }),
    {
      type: 'header',
      key: 'header_global',
      label: 'Global Audits',
      icon: <Layers className="h-3.5 w-3.5 text-slate-400" />,
      isSeparator: true,
    },
    {
      key: 'all_categories',
      label: 'All Categories',
      icon: <Layers className="h-4 w-4 flex-shrink-0" />,
      count: categorySections.reduce((sum, s) => sum + (s.results?.length || 0), 0),
    },
    ...(notUsedList.length > 0 ? [{
      key: 'not_used',
      label: 'Not Used On Any Page',
      icon: <Archive className="h-4 w-4 flex-shrink-0" />,
      count: notUsedList.length,
    }] : []),
    ...(reportLevelList.length > 0 ? [{
      key: 'report_level',
      label: 'Report-Level Checks',
      icon: <ClipboardList className="h-4 w-4 flex-shrink-0" />,
      count: reportLevelList.length,
    }] : []),
  ];

  // ── Helpers for result rows ─────────────────────────────────────────────────
  const StatusBadge = ({ status }) => (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
      status === 'pass' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
      status === 'warning' ? 'bg-amber-50 text-amber-800 border-amber-200' :
      'bg-rose-50 text-rose-800 border-rose-200'
    }`}>{status}</span>
  );

  const ResultRow = ({ res, rIdx }) => (
    <div key={rIdx} className="p-4 text-xs space-y-1.5 hover:bg-slate-50/70 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800 font-mono">{res.target}</span>
          {res.category && (
            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase font-semibold">
              {res.category.replace(/_/g, ' ')}
            </span>
          )}
        </div>
        <StatusBadge status={res.status} />
      </div>
      <p className="text-slate-600">{res.message}</p>
      {res.suggested_fix && (
        <div className="p-2 bg-indigo-50/50 rounded text-indigo-950 text-[11px] border border-indigo-100">
          💡 <strong>Suggested Fix:</strong> {res.suggested_fix}
        </div>
      )}
    </div>
  );

  // ── Content sections ────────────────────────────────────────────────────────
  const renderOverview = () => (
    <div className="space-y-6">
      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 text-slate-700">
            <CheckSquare className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 block">TOTAL CHECKS</span>
            <span className="text-3xl font-extrabold text-slate-900 leading-tight block">{totalChecksCount}</span>
          </div>
        </div>
        <div className="bg-white border border-emerald-200 rounded-2xl p-6 shadow-sm flex items-center gap-4 bg-gradient-to-b from-white to-emerald-50/20">
          <div className="h-12 w-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 block">PASSED</span>
            <span className="text-3xl font-extrabold text-emerald-600 leading-tight block">{passedCount}</span>
          </div>
        </div>
        <div className="bg-white border border-amber-200 rounded-2xl p-6 shadow-sm flex items-center gap-4 bg-gradient-to-b from-white to-amber-50/20">
          <div className="h-12 w-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-700 block">WARNINGS</span>
            <span className="text-3xl font-extrabold text-amber-600 leading-tight block">{warningsCount}</span>
          </div>
        </div>
        <div className="bg-white border border-rose-200 rounded-2xl p-6 shadow-sm flex items-center gap-4 bg-gradient-to-b from-white to-rose-50/20">
          <div className="h-12 w-12 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center flex-shrink-0 text-rose-600">
            <XCircle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-rose-700 block">FAILED</span>
            <span className="text-3xl font-extrabold text-rose-600 leading-tight block">{failedCount}</span>
          </div>
        </div>
      </div>

      {/* Findings Breakdown Chart */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm w-full space-y-4">
        <h3 className="text-base font-bold text-slate-900">Findings Breakdown by Category</h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 45 }}>
              <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={65} tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="Passed" fill="#10b981" stackId="a" />
              <Bar dataKey="Warnings" fill="#f59e0b" stackId="a" />
              <Bar dataKey="Failed" fill="#ef4444" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const renderStandaloneSection = (sec) => {
    if (!sec) return null;
    const isCollapsed = collapsed[sec.category];
    const results = sec.results || [];
    const tables = sec.tables || {};
    const isPowerQuery = sec.category === 'power_query_naming';

    return (
      <div id={`sec-${sec.category}`} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden w-full">
        <div
          onClick={() => toggleCollapse(sec.category)}
          className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors select-none"
        >
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-slate-900 text-sm">{sec.category_name || sec.title}</h3>
            <span className="bg-slate-200 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
              {results.length} {results.length === 1 ? 'item' : 'items'}
            </span>
            <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
              Standalone Model Check
            </span>
          </div>
          {isCollapsed ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronUp className="h-4 w-4 text-slate-500" />}
        </div>

        {!isCollapsed && (
          <div className="p-6 bg-white space-y-4">
            {sec.excluded_note && (
              <div className="p-3 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-xs flex items-center gap-2">
                <Info className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <span>{sec.excluded_note}</span>
              </div>
            )}

            {isPowerQuery && Object.keys(tables).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(tables).map(([tableName, tData]) => {
                  const isTableCol = tableCollapsed[tableName] || false;
                  const tSummary = tData.summary || { total: 0, passed: 0, warnings: 0, failed: 0 };
                  return (
                    <div key={tableName} className="border border-slate-200 rounded-xl overflow-hidden">
                      <div
                        onClick={() => setTableCollapsed(prev => ({ ...prev, [tableName]: !prev[tableName] }))}
                        className="bg-slate-50 p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-100"
                      >
                        <div className="flex items-center gap-2">
                          <FileCode className="h-4 w-4 text-indigo-600" />
                          <span className="font-bold text-xs text-slate-900">{tableName}</span>
                          <span className="text-xs text-slate-500">({tData.results?.length || 0} steps)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {tSummary.failed > 0 && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">{tSummary.failed} Failed</span>}
                          {tSummary.warnings > 0 && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">{tSummary.warnings} Warnings</span>}
                          {tSummary.passed > 0 && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">{tSummary.passed} Passed</span>}
                          {isTableCol ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
                        </div>
                      </div>
                      {!isTableCol && (
                        <div className="divide-y divide-slate-100 bg-white">
                          {tData.results.map((r, rIdx) => (
                            <div key={rIdx} className="p-3.5 text-xs space-y-1 hover:bg-slate-50/70">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-800">{r.target}</span>
                                <StatusBadge status={r.status} />
                              </div>
                              <p className="text-slate-600">{r.message}</p>
                              {r.suggested_fix && (
                                <div className="p-2 bg-indigo-50/50 rounded text-indigo-950 text-[11px] border border-indigo-100">
                                  💡 <strong>Suggested Fix:</strong> {r.suggested_fix}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {results.map((res, rIdx) => (
                  <div key={rIdx} className="py-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{res.target}</span>
                      <StatusBadge status={res.status} />
                    </div>
                    <p className="text-slate-600">{res.message}</p>
                    {res.suggested_fix && (
                      <div className="p-2 bg-indigo-50/50 rounded text-indigo-950 text-[11px] border border-indigo-100">
                        💡 <strong>Suggested Fix:</strong> {res.suggested_fix}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderPageContent = (pageName) => {
    const page = pagesList.find(p => p.page_name === pageName);
    if (!page) return <p className="text-slate-400 text-sm">Page not found.</p>;

    const daxResults = (page.dax_results || []).filter(r => matchesStatus(r.status) && matchesCategory(r.category));
    const visualResults = (page.visual_results || []).filter(r => matchesStatus(r.status) && matchesCategory(r.category));
    const pageResults = (page.page_level_results || []).filter(r => matchesStatus(r.status) && matchesCategory(r.category));
    const allPageFindings = [...daxResults, ...visualResults, ...pageResults];

    const pFailed = allPageFindings.filter(r => r.status === 'fail' || r.status === 'error').length;
    const pWarnings = allPageFindings.filter(r => r.status === 'warning').length;
    const pPassed = allPageFindings.filter(r => r.status === 'pass').length;

    return (
      <div className="space-y-6">
        {/* Page header summary row */}
        <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Layers className="h-5 w-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-base">Report Page: {page.page_name}</h3>
            <span className="bg-slate-200 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
              {allPageFindings.length} findings
            </span>
          </div>
          <div className="flex items-center gap-2">
            {pFailed > 0 && <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">{pFailed} Failed</span>}
            {pWarnings > 0 && <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">{pWarnings} Warnings</span>}
            {pPassed > 0 && <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">{pPassed} Passed</span>}
          </div>
        </div>

        {/* Category shortcuts for this page */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm w-full space-y-3">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">
            🎯 QUICK CATEGORY FILTER
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                categoryFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >All Categories</button>
            {allCategoriesList.filter(c => !['power_query_naming', 'data_model'].includes(c.key)).map(cat => {
              let catCount = 0;
              let hasFail = false, hasWarn = false;
              const checkItems = (items) => {
                items.forEach(r => {
                  if (r.category === cat.key) { catCount++; if (r.status === 'fail' || r.status === 'error') hasFail = true; if (r.status === 'warning') hasWarn = true; }
                });
              };
              checkItems(page.dax_results || []);
              checkItems(page.visual_results || []);
              checkItems(page.page_level_results || []);
              const isSelected = categoryFilter === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => setCategoryFilter(isSelected ? 'all' : cat.key)}
                  disabled={catCount === 0}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    catCount === 0 ? 'opacity-40 bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-100' :
                    isSelected ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{cat.name}</span>
                  {catCount > 0 && (
                    <span className="flex items-center gap-1">
                      {hasFail && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                      {hasWarn && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                      {!hasFail && !hasWarn && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                    </span>
                  )}
                  <span className="text-[11px] font-mono">({catCount})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Visual Container Sections Split By Visual Type */}
        {(() => {
          // 1. Navigation Actions
          const navFindings = allPageFindings.filter(r => 
            r.target.toLowerCase().includes('navigation') || 
            r.target.toLowerCase().includes('web url') || 
            r.target.toLowerCase().includes('drillthrough') || 
            (r.category === 'functional' && r.target.toLowerCase().includes('action'))
          );

          // 2. Bookmarks
          const bookmarkFindings = allPageFindings.filter(r => 
            r.target.toLowerCase().includes('bookmark') && 
            !navFindings.includes(r)
          );

          // 3. Slicers & Filters
          const slicerFindings = allPageFindings.filter(r => 
            r.category === 'slicer_interactions' || 
            r.target.toLowerCase().includes('slicer') || 
            r.target.toLowerCase().includes('filter interaction')
          );

          // 4. Bar & Column Charts
          const barChartFindings = allPageFindings.filter(r => {
            const t = (r.target + ' ' + (r.message || '')).toLowerCase();
            return !navFindings.includes(r) && !bookmarkFindings.includes(r) && !slicerFindings.includes(r) &&
              (t.includes('barchart') || t.includes('bar chart') || t.includes('columnchart') || t.includes('column chart') ||
               t.includes('category') || t.includes('customer by segment') || t.includes('top customer') || t.includes('profit by category') ||
               t.includes('clusteredbar') || t.includes('stackedbar') || t.includes('stackedcolumn') || t.includes('clusteredcolumn'));
          });

          // 5. KPI & Metric Cards
          const cardFindings = allPageFindings.filter(r => {
            const t = (r.target + ' ' + (r.message || '')).toLowerCase();
            return !navFindings.includes(r) && !bookmarkFindings.includes(r) && !slicerFindings.includes(r) && !barChartFindings.includes(r) &&
              (t.includes('card') || t.includes('kpi') || t.includes('total orders') || t.includes('total country') || 
               t.includes('total product') || t.includes('total customers') || t.includes('repeat customer') || t.includes('avg order value') ||
               t.includes('multi-row card') || t.includes('header metric'));
          });

          // 6. Line & Area Charts
          const lineChartFindings = allPageFindings.filter(r => {
            const t = (r.target + ' ' + (r.message || '')).toLowerCase();
            return !navFindings.includes(r) && !bookmarkFindings.includes(r) && !slicerFindings.includes(r) && !barChartFindings.includes(r) && !cardFindings.includes(r) &&
              (t.includes('linechart') || t.includes('line chart') || t.includes('areachart') || t.includes('area chart') ||
               t.includes('gross sales by year') || t.includes('sales trends') || t.includes('trend') || t.includes('sparkline'));
          });

          // 7. Donut & Pie Charts
          const pieChartFindings = allPageFindings.filter(r => {
            const t = (r.target + ' ' + (r.message || '')).toLowerCase();
            return !navFindings.includes(r) && !bookmarkFindings.includes(r) && !slicerFindings.includes(r) && !barChartFindings.includes(r) && !cardFindings.includes(r) && !lineChartFindings.includes(r) &&
              (t.includes('piechart') || t.includes('pie chart') || t.includes('donutchart') || t.includes('donut chart') ||
               t.includes('donut') || t.includes('pie') || t.includes('sales by segment') || t.includes('treemap'));
          });

          // 8. Tables & Matrices
          const tableFindings = allPageFindings.filter(r => {
            const t = (r.target + ' ' + (r.message || '')).toLowerCase();
            return !navFindings.includes(r) && !bookmarkFindings.includes(r) && !slicerFindings.includes(r) && !barChartFindings.includes(r) && !cardFindings.includes(r) && !lineChartFindings.includes(r) && !pieChartFindings.includes(r) &&
              (t.includes('table') || t.includes('matrix') || t.includes('tableex'));
          });

          // 9. DAX Measures & Columns
          const daxFindings = (page.dax_results || []).filter(r => 
            matchesStatus(r.status) && matchesCategory(r.category)
          );

          // 10. Performance
          const perfFindings = allPageFindings.filter(r => 
            r.category === 'performance' || 
            r.target.toLowerCase().includes('performance') || 
            r.target.toLowerCase().includes('render')
          );

          // 11. General visual formatting & alignment not captured in specific charts
          const generalVisualFindings = allPageFindings.filter(r => {
            return (r.category === 'font_consistency' || r.category === 'visual_alignment' || (r.category === 'functional' && r.target.toLowerCase().includes('visual'))) && 
              !navFindings.includes(r) && !bookmarkFindings.includes(r) && !slicerFindings.includes(r) &&
              !barChartFindings.includes(r) && !cardFindings.includes(r) && !lineChartFindings.includes(r) && !pieChartFindings.includes(r) && !tableFindings.includes(r);
          });

          // 12. Other uncategorized findings
          const capturedSet = new Set([
            ...navFindings, ...slicerFindings, ...bookmarkFindings, 
            ...barChartFindings, ...cardFindings, ...lineChartFindings, ...pieChartFindings, ...tableFindings,
            ...generalVisualFindings, ...daxFindings, ...perfFindings
          ]);
          const otherFindings = allPageFindings.filter(r => !capturedSet.has(r));

          const renderContainerCard = (title, icon, items) => {
            if (!items || items.length === 0) return null;
            const fails = items.filter(r => r.status === 'fail' || r.status === 'error').length;
            const warns = items.filter(r => r.status === 'warning').length;
            const passes = items.filter(r => r.status === 'pass').length;

            return (
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                <div className="bg-slate-50/90 px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    {icon}
                    {title} ({items.length} {items.length === 1 ? 'item' : 'items'})
                  </span>
                  <div className="flex items-center gap-1.5">
                    {fails > 0 && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">{fails} Failed</span>}
                    {warns > 0 && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">{warns} Warn</span>}
                    {passes > 0 && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">{passes} Passed</span>}
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {items.map((res, rIdx) => <ResultRow key={rIdx} res={res} rIdx={rIdx} />)}
                </div>
              </div>
            );
          };

          return (
            <div className="space-y-6">
              {/* 1. Bar & Column Charts */}
              {renderContainerCard(
                "BAR & COLUMN CHARTS (VISUAL AUDITS)",
                <BarChart3 className="h-4 w-4 text-indigo-600" />,
                barChartFindings
              )}

              {/* 2. KPI & Metric Cards */}
              {renderContainerCard(
                "KPI & METRIC CARDS (VISUAL AUDITS)",
                <CreditCard className="h-4 w-4 text-emerald-600" />,
                cardFindings
              )}

              {/* 3. Line & Area Charts */}
              {renderContainerCard(
                "LINE & AREA CHARTS (VISUAL AUDITS)",
                <TrendingUp className="h-4 w-4 text-blue-600" />,
                lineChartFindings
              )}

              {/* 4. Donut & Pie Charts */}
              {renderContainerCard(
                "DONUT & PIE CHARTS (VISUAL AUDITS)",
                <PieChart className="h-4 w-4 text-amber-600" />,
                pieChartFindings
              )}

              {/* 5. Tables & Matrices */}
              {renderContainerCard(
                "TABLES & MATRICES (VISUAL AUDITS)",
                <Table className="h-4 w-4 text-slate-600" />,
                tableFindings
              )}

              {/* 6. Slicers & Filter Controls */}
              {renderContainerCard(
                "SLICERS & FILTER CONTROLS",
                <Sliders className="h-4 w-4 text-purple-600" />,
                slicerFindings
              )}

              {/* 7. Page Navigation & Action Buttons */}
              {renderContainerCard(
                "PAGE NAVIGATION & ACTION BUTTONS",
                <Compass className="h-4 w-4 text-rose-600" />,
                navFindings
              )}

              {/* 8. Bookmarks & View State Controls */}
              {renderContainerCard(
                "BOOKMARKS & VIEW STATE CONTROLS",
                <Bookmark className="h-4 w-4 text-indigo-600" />,
                bookmarkFindings
              )}

              {/* 9. General Visual Formatting (Fonts, Alignment) */}
              {renderContainerCard(
                "CANVAS ALIGNMENT & GENERAL VISUAL FORMATTING",
                <Box className="h-4 w-4 text-slate-600" />,
                generalVisualFindings
              )}

              {/* 10. DAX Measures & Columns */}
              {renderContainerCard(
                "DAX MEASURES & CALCULATED COLUMNS USED ON THIS PAGE",
                <FileCode className="h-4 w-4 text-cyan-600" />,
                daxFindings
              )}

              {/* 11. Page Performance & Health */}
              {renderContainerCard(
                "PAGE LOAD & RENDER PERFORMANCE",
                <Gauge className="h-4 w-4 text-teal-600" />,
                perfFindings
              )}

              {/* 12. Additional / Uncategorized Page Findings */}
              {renderContainerCard(
                "ADDITIONAL PAGE CHECKS",
                <LayoutGrid className="h-4 w-4 text-indigo-600" />,
                otherFindings
              )}
            </div>
          );
        })()}

        {allPageFindings.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
            No findings match current filters for this page.
          </div>
        )}
      </div>
    );
  };

  const renderNotUsed = () => {
    const filteredNotUsed = notUsedList.filter(r => matchesStatus(r.status) && matchesCategory(r.category));
    return (
      <div id="card-not-used-on-any-page" className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden w-full">
        <div
          onClick={() => setNotUsedCollapsed(prev => !prev)}
          className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 select-none"
        >
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-slate-900 text-sm">Not Used On Any Page</h3>
            <span className="bg-slate-200 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
              {filteredNotUsed.length} items
            </span>
            <span className="text-xs text-slate-500 font-medium">(Unused Measures & Unused Columns)</span>
          </div>
          {notUsedCollapsed ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
        </div>
        {!notUsedCollapsed && (
          <div className="divide-y divide-slate-100 px-6 py-2 bg-white">
            {filteredNotUsed.map((res, rIdx) => <ResultRow key={rIdx} res={res} rIdx={rIdx} />)}
          </div>
        )}
      </div>
    );
  };

  const renderReportLevel = () => {
    const filteredReportLevel = reportLevelList.filter(r => matchesStatus(r.status) && matchesCategory(r.category));
    return (
      <div id="card-report-level-checks" className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden w-full">
        <div
          onClick={() => setReportLevelCollapsed(prev => !prev)}
          className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 select-none"
        >
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-slate-900 text-sm">Report-Level Checks</h3>
            <span className="bg-slate-200 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
              {filteredReportLevel.length} items
            </span>
            <span className="text-xs text-slate-500 font-medium">(PDF Export, Excel Export, Global Verification)</span>
          </div>
          {reportLevelCollapsed ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
        </div>
        {!reportLevelCollapsed && (
          <div className="divide-y divide-slate-100 px-6 py-2 bg-white">
            {filteredReportLevel.map((res, rIdx) => <ResultRow key={rIdx} res={res} rIdx={rIdx} />)}
          </div>
        )}
      </div>
    );
  };

  const renderAllCategories = () => {
    return (
      <div className="space-y-4 w-full">
        {categorySections.map(sec => {
          const filteredResults = (sec.results || []).filter(res => matchesStatus(res.status));
          if (filteredResults.length === 0 && statusFilter !== 'all') return null;

          const isCollapsedSec = collapsed[sec.category];
          const secFailed = filteredResults.filter(r => r.status === 'fail' || r.status === 'error').length;
          const secWarnings = filteredResults.filter(r => r.status === 'warning').length;
          const secPassed = filteredResults.filter(r => r.status === 'pass').length;

          return (
            <div
              key={sec.category}
              id={`category-sec-${sec.category}`}
              className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden w-full"
            >
              <div
                onClick={() => toggleCollapse(sec.category)}
                className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 select-none"
              >
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-slate-800 text-sm">{sec.category_name || sec.title}</h3>
                  <span className="bg-slate-200 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
                    {filteredResults.length} {filteredResults.length === 1 ? 'item' : 'items'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {secFailed > 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">{secFailed} Failed</span>}
                    {secWarnings > 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">{secWarnings} Warn</span>}
                    {secPassed > 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">{secPassed} Pass</span>}
                  </div>
                </div>
                {isCollapsedSec ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
              </div>

              {!isCollapsedSec && (
                <div className="divide-y divide-slate-100 px-6 py-2 bg-white">
                  {sec.excluded_note && (
                    <div className="my-3 p-3 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-xs flex items-center gap-2">
                      <Info className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span>{sec.excluded_note}</span>
                    </div>
                  )}
                  {filteredResults.map((res, rIdx) => <ResultRow key={rIdx} res={res} rIdx={rIdx} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderMainContent = () => {
    if (sidebarActive === 'overview') return renderOverview();
    if (sidebarActive === 'power_query') return renderStandaloneSection(powerQuerySec);
    if (sidebarActive === 'data_model') return renderStandaloneSection(dataModelSec);
    if (sidebarActive === 'all_categories') return renderAllCategories();
    if (sidebarActive === 'not_used') return renderNotUsed();
    if (sidebarActive === 'report_level') return renderReportLevel();
    // page
    return renderPageContent(sidebarActive);
  };

  return (
    <div className="flex w-full min-h-screen bg-slate-50">

      {/* ── LEFT SIDEBAR ──────────────────────────────────────────────────────── */}
      <aside
        className={`${sidebarCollapsed ? 'w-14' : 'w-60'} bg-white border-r border-slate-200 flex-shrink-0 sticky top-0 h-screen overflow-y-auto transition-all duration-200 flex flex-col z-10`}
      >
        {/* Sidebar Header */}
        <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          {!sidebarCollapsed && (
            <div>
              <p className="text-[10px] uppercase font-extrabold tracking-widest text-indigo-600">QA Report</p>
              <p className="text-xs font-bold text-slate-800 truncate max-w-[140px]">
                {method === 'service' ? 'PBI Service' : (source || 'PBIX File')}
              </p>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(prev => !prev)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors flex-shrink-0"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {sidebarItems.map(item => {
            if (item.type === 'header') {
              return (
                <React.Fragment key={item.key}>
                  {item.isSeparator && <div className="border-t border-slate-200/90 my-2 mx-1" />}
                  {!sidebarCollapsed && (
                    <div className="pt-2.5 pb-1 px-2.5 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      <span className="flex items-center gap-1.5">
                        {item.icon}
                        {item.label}
                      </span>
                      {item.count !== undefined && item.count !== null && (
                        <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full text-[9px] font-bold border border-indigo-100">
                          {item.count}
                        </span>
                      )}
                    </div>
                  )}
                </React.Fragment>
              );
            }

            const isActive = sidebarActive === item.key;
            return (
              <React.Fragment key={item.key}>
                {item.isSeparator && <div className="border-t border-slate-200 my-2 mx-1" />}
                <button
                  onClick={() => handleSidebarNav(item.key)}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  } ${item.isPageItem && !sidebarCollapsed ? 'pl-3.5' : ''}`}
                >
                  <span className={isActive ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                  {!sidebarCollapsed && (
                    <span className="flex-1 truncate">{item.label}</span>
                  )}
                  {!sidebarCollapsed && item.count !== null && item.count !== undefined && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      isActive ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {item.count}
                    </span>
                  )}
                  {!sidebarCollapsed && item.hasFail && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
                  )}
                  {!sidebarCollapsed && !item.hasFail && item.hasWarn && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        {!sidebarCollapsed && (
          <div className="px-4 py-3 border-t border-slate-100 flex-shrink-0">
            <p className="text-[10px] text-slate-400 font-mono truncate">Job: {jobId}</p>
          </div>
        )}
      </aside>

      {/* ── RIGHT MAIN AREA ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Banner */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
          <div className="space-y-1">
            <Link to="/history" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to History
            </Link>
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                {method === 'service' ? 'POWER BI SERVICE' : 'LOCAL PBIX'}
              </span>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {method === 'service' ? 'Power BI Service Live Report' : (source || 'PBIX Report Validation')}
              </h1>
            </div>
          </div>

          <div className="flex flex-col md:items-end gap-2 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadProtectedFile(`/api/reports/${jobId}/pdf`, `PBI_QA_Report_${jobId}.pdf`)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Download PDF Report
              </button>
              <button
                onClick={() => downloadProtectedFile(`/api/reports/${jobId}/excel`, `PBI_QA_Report_${jobId}.xlsx`)}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Export Excel
              </button>
            </div>
          </div>
        </div>

        {/* Status Filter Bar (for page sections) */}
        {(sidebarActive !== 'overview') && (
          <div className="bg-white border-b border-slate-100 px-6 py-3 flex items-center gap-3 flex-shrink-0">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter:</span>
            <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              {[
                { key: 'all', label: 'All', activeClass: 'bg-slate-900 text-white' },
                { key: 'fail', label: 'Failed', activeClass: 'bg-rose-600 text-white' },
                { key: 'warning', label: 'Warnings', activeClass: 'bg-amber-600 text-white' },
                { key: 'pass', label: 'Passed', activeClass: 'bg-emerald-600 text-white' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-1 rounded-lg transition-all ${statusFilter === f.key ? f.activeClass : 'text-slate-600 hover:text-slate-900'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderMainContent()}
        </div>
      </div>
    </div>
  );
}
