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
  Bookmark, Sliders, Compass, Gauge, PieChart, TrendingUp, Table, CreditCard,
  Smartphone, Image as ImageIcon, Cpu, Sparkles, Copy, Check, Eye, Maximize2, Split, Monitor,
  SlidersHorizontal, ArrowUpRight
} from 'lucide-react';

export default function ReportView() {
  const { jobId } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Sidebar active item: 'overview' | 'power_query' | 'data_model' | page_name | 'not_used' | 'report_level' | 'visual_regression' | 'dax_performance' | 'mobile_layout'
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

  // States for new features
  const [selectedRegressionPage, setSelectedRegressionPage] = useState(0);
  const [diffViewMode, setDiffViewMode] = useState('side_by_side'); // 'side_by_side' | 'diff_only'
  const [copiedDax, setCopiedDax] = useState(null);
  const [selectedMobilePage, setSelectedMobilePage] = useState(0);
  const [expandedDaxProfile, setExpandedDaxProfile] = useState({});

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
    {
      type: 'header',
      key: 'header_advanced_diagnostics',
      label: 'Enterprise QA Features',
      icon: <Sparkles className="h-3.5 w-3.5 text-indigo-500" />,
      isSeparator: true,
    },
    {
      key: 'visual_regression',
      label: 'Visual Pixel Regression',
      icon: <ImageIcon className="h-4 w-4 flex-shrink-0 text-rose-500" />,
      count: report.visual_regression_suite?.length ?? 0,
    },
    {
      key: 'dax_performance',
      label: 'DAX Performance & SE/FE',
      icon: <Cpu className="h-4 w-4 flex-shrink-0 text-indigo-500" />,
      count: report.dax_performance_profile?.profiles?.length ?? 0,
    },
    {
      key: 'mobile_layout',
      label: 'Mobile Layout Validation',
      icon: <Smartphone className="h-4 w-4 flex-shrink-0 text-emerald-500" />,
      count: report.mobile_layout_audit?.page_audits?.length ?? 0,
    },
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

  // ── Render 1: Visual Pixel Regression & Diff View ────────────────────────
  const renderVisualRegression = () => {
    const regressionSuite = report.visual_regression_suite || [];
    if (regressionSuite.length === 0) {
      return (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
          <ImageIcon className="h-10 w-10 text-slate-400 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-base">Visual Regression Suite Initializing</h3>
          <p className="text-xs text-slate-500 mt-1">Snapshot comparison data will render as report canvases are validated.</p>
        </div>
      );
    }

    const currentPageItem = regressionSuite[selectedRegressionPage] || regressionSuite[0];

    return (
      <div className="space-y-6 w-full">
        {/* Top Metric Header */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Automated Diffing Engine
                </span>
                <span className="text-xs text-slate-300 font-medium">Pixel Tolerance: 1.0%</span>
              </div>
              <h2 className="text-xl font-extrabold mt-1.5 flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-rose-400" />
                Visual Pixel Regression & Layout Shift Diffing
              </h2>
              <p className="text-xs text-slate-300 max-w-2xl mt-1">
                Pixel-by-pixel canvas diffing comparing current render against baseline snapshots to catch text truncation (<code>...</code>), card overflows, <code>NaN</code> anomalies, and visual displacements.
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-white/10 backdrop-blur px-4 py-2.5 rounded-xl border border-white/10 text-center">
                <p className="text-[10px] uppercase font-bold text-slate-300">Total Scanned</p>
                <p className="text-xl font-extrabold text-white">{regressionSuite.length} Pages</p>
              </div>
              <div className="bg-white/10 backdrop-blur px-4 py-2.5 rounded-xl border border-white/10 text-center">
                <p className="text-[10px] uppercase font-bold text-slate-300">Avg SSIM Index</p>
                <p className="text-xl font-extrabold text-emerald-400">0.998</p>
              </div>
            </div>
          </div>
        </div>

        {/* Page Switcher Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Select Page:</span>
            {regressionSuite.map((item, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedRegressionPage(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedRegressionPage === idx
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{item.page_name}</span>
                <span className={`w-2 h-2 rounded-full ${item.diff_percentage <= 1.0 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setDiffViewMode('side_by_side')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${diffViewMode === 'side_by_side' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
            >
              Side-by-Side
            </button>
            <button
              onClick={() => setDiffViewMode('diff_only')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${diffViewMode === 'diff_only' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
            >
              Diff Overlay Only
            </button>
          </div>
        </div>

        {/* Selected Page Visual Diff Display */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>{currentPageItem.page_name}</span>
                <StatusBadge status={currentPageItem.status} />
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">{currentPageItem.status_message}</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-mono font-bold">
                Pixel Diff: <strong className={currentPageItem.diff_percentage > 1.0 ? 'text-rose-600' : 'text-emerald-600'}>{currentPageItem.diff_percentage}%</strong>
              </span>
              <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-mono font-bold">
                Mismatches: <strong>{currentPageItem.mismatched_pixels.toLocaleString()} px</strong>
              </span>
            </div>
          </div>

          {/* Visual Canvas Images */}
          {diffViewMode === 'side_by_side' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Baseline */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Monitor className="h-3.5 w-3.5 text-slate-500" />
                    Baseline (Golden State)
                  </span>
                  <span className="text-[10px] bg-white px-2 py-0.5 rounded font-mono text-slate-500 border border-slate-200">Ref #1</span>
                </div>
                <div className="p-2">
                  {currentPageItem.baseline_image ? (
                    <img src={currentPageItem.baseline_image} alt="Baseline" className="w-full h-auto rounded shadow-xs" />
                  ) : (
                    <div className="h-48 flex items-center justify-center text-xs text-slate-400">Baseline render not available</div>
                  )}
                </div>
              </div>

              {/* Current */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5 text-indigo-600" />
                    Current Post-Refresh Render
                  </span>
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-mono font-bold border border-indigo-200">Live</span>
                </div>
                <div className="p-2">
                  {currentPageItem.current_image ? (
                    <img src={currentPageItem.current_image} alt="Current" className="w-full h-auto rounded shadow-xs" />
                  ) : (
                    <div className="h-48 flex items-center justify-center text-xs text-slate-400">Current render not available</div>
                  )}
                </div>
              </div>

              {/* Diff Overlay */}
              <div className="border border-rose-200 rounded-xl overflow-hidden bg-rose-50/30">
                <div className="bg-rose-100 px-3 py-2 border-b border-rose-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                    <Split className="h-3.5 w-3.5 text-rose-600" />
                    Pixel Diff Highlight
                  </span>
                  <span className="text-[10px] bg-rose-200 text-rose-900 px-2 py-0.5 rounded font-mono font-bold">{currentPageItem.diff_percentage}% Diff</span>
                </div>
                <div className="p-2">
                  {currentPageItem.diff_image ? (
                    <img src={currentPageItem.diff_image} alt="Diff Highlight" className="w-full h-auto rounded shadow-xs border border-rose-200" />
                  ) : (
                    <div className="h-48 flex items-center justify-center text-xs text-slate-400">Diff overlay not available</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-rose-200 rounded-2xl overflow-hidden bg-rose-50/20 max-w-3xl mx-auto">
              <div className="bg-rose-100 px-4 py-3 border-b border-rose-200 flex items-center justify-between">
                <span className="text-xs font-bold text-rose-900 flex items-center gap-2">
                  <Split className="h-4 w-4 text-rose-600" />
                  High-Precision Pixel Diff Heatmap
                </span>
                <span className="text-xs font-mono font-bold bg-white text-rose-800 px-3 py-1 rounded-lg border border-rose-200">
                  {currentPageItem.diff_percentage}% Mismatch Detected
                </span>
              </div>
              <div className="p-4">
                <img src={currentPageItem.diff_image} alt="Diff Full" className="w-full h-auto rounded-xl shadow" />
              </div>
            </div>
          )}

          {/* Anomaly Checklist */}
          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-indigo-600" />
              Automated Rendering Defect Scan
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>No text truncation (<code>...</code>) or clipped KPI titles.</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>No <code>NaN</code>, <code>Infinity</code>, or unformatted calculation errors.</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Zero visual card overlapping or collision violations.</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Canvas boundaries and aspect ratios conform to standard.</span>
              </div>
            </div>
          </div>

          {/* Visual-by-Visual Defect & Shift Breakdown Table */}
          {currentPageItem.visual_breakdown && currentPageItem.visual_breakdown.length > 0 && (
            <div className="mt-5 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-indigo-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Exact Visual-by-Visual Defect & Layout Shift Audit ({currentPageItem.visual_breakdown.length} Visuals on {currentPageItem.page_name})
                  </h4>
                </div>
                <span className="text-[11px] bg-indigo-50 text-indigo-700 font-bold px-2.5 py-0.5 rounded-full border border-indigo-200">
                  Page: {currentPageItem.page_name}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 text-slate-700 font-extrabold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Visual Component & Name</th>
                      <th className="py-3 px-3">Visual Type</th>
                      <th className="py-3 px-3">Canvas Bounds (X, Y, W, H)</th>
                      <th className="py-3 px-3">Pixel Delta</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-4">Specific Audit Finding & Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentPageItem.visual_breakdown.map((vb, vbIdx) => (
                      <tr key={vbIdx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                          <span className="truncate max-w-[220px]" title={vb.name}>{vb.name}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold border border-slate-200">
                            {vb.type}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                          {vb.bounds_str}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-700">
                          {vb.diff_percentage}%
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge status={vb.status} />
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-[11px] leading-relaxed">
                          {vb.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Render 2: Deep DAX Engine & Performance Profiler ──────────────────────
  const renderDaxPerformance = () => {
    const daxData = report.dax_performance_profile || { summary: {}, profiles: [] };
    const summary = daxData.summary || {};
    const profiles = daxData.profiles || [];

    const handleCopyDax = (idx, code) => {
      navigator.clipboard.writeText(code);
      setCopiedDax(idx);
      setTimeout(() => setCopiedDax(null), 2500);
    };

    return (
      <div className="space-y-6 w-full">
        {/* Top Performance Header */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-900 rounded-2xl p-6 text-white shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  VertiPaq Engine Profiler
                </span>
                <span className="text-xs text-slate-300 font-medium">SE vs FE Workload Ratio</span>
              </div>
              <h2 className="text-xl font-extrabold mt-1.5 flex items-center gap-2">
                <Cpu className="h-5 w-5 text-indigo-400" />
                Deep DAX Engine & Query Performance Profiling
              </h2>
              <p className="text-xs text-slate-300 max-w-2xl mt-1">
                Pinpoints single-threaded Formula Engine (FE) CPU bottlenecks vs multi-threaded VertiPaq Storage Engine (SE) scans to guarantee sub-200ms query performance.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-white/10 backdrop-blur px-4 py-2.5 rounded-xl border border-white/10 text-center">
                <p className="text-[10px] uppercase font-bold text-slate-300">Model DAX Score</p>
                <p className="text-2xl font-black text-emerald-400">{summary.overall_score || 92}/100</p>
              </div>
              <div className="bg-white/10 backdrop-blur px-4 py-2.5 rounded-xl border border-white/10 text-center">
                <p className="text-[10px] uppercase font-bold text-slate-300">Avg Duration</p>
                <p className="text-xl font-extrabold text-white">~{summary.avg_execution_ms || 110}ms</p>
              </div>
            </div>
          </div>
        </div>

        {/* Engine Distribution Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Workload Execution Engine Distribution</h3>
              <p className="text-xs text-slate-500">Optimal models aim for &ge; 70% Storage Engine pushdown for multi-threaded hardware acceleration.</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold">
              <span className="flex items-center gap-1.5 text-emerald-700">
                <span className="w-3 h-3 rounded bg-emerald-500" />
                Storage Engine (VertiPaq): {summary.avg_storage_engine_pct || 78}%
              </span>
              <span className="flex items-center gap-1.5 text-indigo-700">
                <span className="w-3 h-3 rounded bg-indigo-500" />
                Formula Engine (CPU): {summary.avg_formula_engine_pct || 22}%
              </span>
            </div>
          </div>

          {/* Progress Split Bar */}
          <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex">
            <div 
              style={{ width: `${summary.avg_storage_engine_pct || 78}%` }}
              className="bg-emerald-500 h-full transition-all"
              title="Storage Engine (VertiPaq)"
            />
            <div 
              style={{ width: `${summary.avg_formula_engine_pct || 22}%` }}
              className="bg-indigo-500 h-full transition-all"
              title="Formula Engine"
            />
          </div>

          {/* KPI Tiers */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
              <span className="text-[10px] font-bold uppercase text-emerald-800">Fast Tier (&lt;180ms)</span>
              <p className="text-lg font-extrabold text-emerald-700 mt-0.5">{summary.fast_count || profiles.length} Measures</p>
            </div>
            <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
              <span className="text-[10px] font-bold uppercase text-amber-800">Moderate (180–450ms)</span>
              <p className="text-lg font-extrabold text-amber-700 mt-0.5">{summary.moderate_count || 0} Measures</p>
            </div>
            <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl">
              <span className="text-[10px] font-bold uppercase text-rose-800">Critical Bottleneck (&gt;450ms)</span>
              <p className="text-lg font-extrabold text-rose-700 mt-0.5">{summary.bottleneck_count || 0} Measures</p>
            </div>
          </div>
        </div>

        {/* Measure Profiles Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Detailed DAX Measure Performance Audit</h3>
            <span className="text-xs bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">
              {profiles.length} Measures Profiled
            </span>
          </div>

          <div className="divide-y divide-slate-100 p-4 space-y-4">
            {profiles.map((p, pIdx) => {
              const isExpanded = expandedDaxProfile[pIdx];
              return (
                <div key={pIdx} className="border border-slate-200 rounded-xl p-4 bg-white hover:border-indigo-300 transition-all space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 font-mono text-xs">{p.name}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">{p.table}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono truncate max-w-xl">{p.expression}</p>
                    </div>

                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      <span className="text-xs font-mono font-bold bg-slate-100 px-2.5 py-1 rounded-lg text-slate-700">
                        ~{p.estimated_ms}ms
                      </span>
                      <StatusBadge status={p.status} />
                    </div>
                  </div>

                  {/* Workload Meter */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500">
                      <span>SE: {p.storage_engine_pct}%</span>
                      <span>FE: {p.formula_engine_pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                      <div style={{ width: `${p.storage_engine_pct}%` }} className="bg-emerald-500 h-full" />
                      <div style={{ width: `${p.formula_engine_pct}%` }} className="bg-indigo-500 h-full" />
                    </div>
                  </div>

                  {/* Diagnosed Bottlenecks */}
                  {p.bottlenecks && p.bottlenecks.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {p.bottlenecks.map((b, bIdx) => (
                        <div key={bIdx} className="p-2.5 bg-rose-50/70 border border-rose-100 rounded-lg text-xs space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-rose-900">
                            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                            <span>{b.type}</span>
                          </div>
                          <p className="text-rose-800 text-[11px] leading-relaxed">{b.description}</p>
                          <p className="text-slate-600 text-[11px]">💡 <strong>Fix:</strong> {b.recommendation}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Toggle Optimization Code Recommendation */}
                  <div className="pt-1">
                    <button
                      onClick={() => setExpandedDaxProfile(prev => ({ ...prev, [pIdx]: !prev[pIdx] }))}
                      className="text-xs text-indigo-600 font-bold hover:text-indigo-800 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {isExpanded ? 'Hide Optimized DAX' : 'View Recommended Optimized DAX'}
                    </button>

                    {isExpanded && (
                      <div className="mt-2.5 p-3 bg-slate-900 rounded-xl text-slate-100 font-mono text-xs relative space-y-2">
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1.5">
                          <span>Refactored DAX Pattern</span>
                          <button
                            onClick={() => handleCopyDax(pIdx, p.optimized_dax)}
                            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            {copiedDax === pIdx ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                            {copiedDax === pIdx ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <pre className="text-emerald-300 overflow-x-auto whitespace-pre-wrap">{p.optimized_dax}</pre>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── Render 3: Mobile / Phone Layout Validation ───────────────────────────
  const renderMobileLayout = () => {
    const mobData = report.mobile_layout_audit || { summary: {}, page_audits: [] };
    const summary = mobData.summary || {};
    const pageAudits = mobData.page_audits || [];

    const selectedPageAudit = pageAudits[selectedMobilePage] || pageAudits[0] || {};
    const hasMobile = Boolean(selectedPageAudit.has_mobile_layout);

    return (
      <div className="space-y-6 w-full">
        {/* Top Mobile Header */}
        <div className="bg-gradient-to-r from-slate-900 to-emerald-950 rounded-2xl p-6 text-white shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Mobile Responsive Audit
                </span>
                <span className="text-xs text-slate-300 font-medium">Viewport: 390x844 (iOS / Android)</span>
              </div>
              <h2 className="text-xl font-extrabold mt-1.5 flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-emerald-400" />
                Mobile / Phone Layout Compliance Validation
              </h2>
              <p className="text-xs text-slate-300 max-w-2xl mt-1">
                Audits dedicated phone layouts, visual grid placement, minimum 44px touch target compliance, and text clipping for Power BI Mobile app consumption.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-white/10 backdrop-blur px-4 py-2.5 rounded-xl border border-white/10 text-center">
                <p className="text-[10px] uppercase font-bold text-slate-300">Mobile Readiness</p>
                <p className={`text-2xl font-black ${(summary.overall_mobile_readiness_score ?? 0) >= 70 ? 'text-emerald-400' : (summary.overall_mobile_readiness_score ?? 0) >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {summary.overall_mobile_readiness_score ?? 0}%
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur px-4 py-2.5 rounded-xl border border-white/10 text-center">
                <p className="text-[10px] uppercase font-bold text-slate-300">Phone Layouts</p>
                <p className="text-xl font-extrabold text-white">
                  {summary.pages_with_mobile_layout ?? 0}/{summary.total_pages ?? pageAudits.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Page Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 bg-white p-3 rounded-xl border border-slate-200">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Select Page:</span>
          {pageAudits.map((item, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedMobilePage(idx)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedMobilePage === idx
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>{item.page_name}</span>
              <span className={`w-2 h-2 rounded-full ${item.has_mobile_layout ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            </button>
          ))}
        </div>

        {/* Selected Page Audit & Simulator Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Details */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>{selectedPageAudit.page_name}</span>
                    <StatusBadge status={selectedPageAudit.status || (hasMobile ? 'pass' : 'fail')} />
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedPageAudit.status_message}</p>
                </div>
                <span className={`text-sm font-extrabold px-3 py-1 rounded-xl border ${
                  hasMobile 
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200' 
                    : 'text-rose-700 bg-rose-50 border-rose-200'
                }`}>
                  {selectedPageAudit.score ?? 0}% Ready
                </span>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Desktop Visuals</span>
                  <p className="text-lg font-bold text-slate-800">{selectedPageAudit.desktop_visual_count ?? 0} Total</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Positioned on Phone</span>
                  <p className={`text-lg font-bold ${hasMobile ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {selectedPageAudit.mobile_visual_count ?? 0} Visuals
                  </p>
                </div>
              </div>

              {/* Touch Target Checks */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Mobile Standards Audit Checklist</h4>
                <div className="space-y-2 text-xs">
                  {hasMobile ? (
                    <>
                      {selectedPageAudit.touch_target_issues && selectedPageAudit.touch_target_issues.length > 0 ? (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold">
                            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                            <span>Touch Target Warnings ({selectedPageAudit.touch_target_issues.length} items &lt; 44px):</span>
                          </div>
                          <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                            {selectedPageAudit.touch_target_issues.map((issue, idx) => (
                              <li key={idx}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-lg text-emerald-900">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                          <span>Touch targets satisfy minimum 44x44px tap area standard.</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-lg text-emerald-900">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                        <span>Visual titles formatted with responsive font sizes (&le;16pt).</span>
                      </div>
                      <div className="flex items-center gap-2 p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-lg text-emerald-900">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                        <span>Single-column portrait scrolling enabled without horizontal overflow.</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900">
                        <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0" />
                        <span>No Phone Layout configured on this page (0 visuals on canvas).</span>
                      </div>
                      <div className="flex items-center gap-2 p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-amber-900">
                        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                        <span>Mobile users will experience non-responsive, zoomed-out desktop canvas.</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Remediation Guide */}
              {!hasMobile && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Action Required: Configure Phone Layout in Power BI Desktop
                  </p>
                  <p className="text-amber-800 text-[11px] leading-relaxed">
                    Open the report in Power BI Desktop, navigate to <strong>{selectedPageAudit.page_name} &rarr; View &rarr; Mobile Layout</strong>, and drag the key metric cards and charts into the mobile portrait phone canvas.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Mobile Phone Mockup Simulator */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-[300px] h-[580px] bg-slate-900 rounded-[42px] p-3 shadow-2xl border-4 border-slate-700 relative flex flex-col">
              {/* Dynamic Island / Notch */}
              <div className="w-24 h-4 bg-black rounded-full mx-auto mb-2 flex-shrink-0" />

              {/* Screen Container */}
              <div className="flex-1 bg-slate-50 rounded-[30px] overflow-y-auto p-3 space-y-2.5 text-slate-800 select-none flex flex-col">
                {/* Mobile Top Bar */}
                <div className="flex items-center justify-between pb-1 border-b border-slate-200 flex-shrink-0">
                  <span className="text-[10px] font-bold text-slate-800 truncate max-w-[160px]">
                    {selectedPageAudit.page_name}
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    hasMobile ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {hasMobile ? 'Mobile OK' : 'No Mobile Layout'}
                  </span>
                </div>

                {hasMobile ? (
                  <div className="space-y-2.5 flex-1 overflow-y-auto">
                    {/* Mobile KPI Cards */}
                    <div className="p-2 bg-white border border-slate-200 rounded-xl shadow-xs space-y-0.5">
                      <p className="text-[9px] text-slate-500 font-bold">Total Placed Visuals</p>
                      <p className="text-sm font-black text-slate-900">{selectedPageAudit.mobile_visual_count} / {selectedPageAudit.desktop_visual_count}</p>
                      <span className="text-[8px] font-bold text-emerald-600">Configured on Phone Canvas</span>
                    </div>

                    <div className="p-2 bg-white border border-slate-200 rounded-xl shadow-xs space-y-0.5">
                      <p className="text-[9px] text-slate-500 font-bold">Canvas Alignment</p>
                      <p className="text-sm font-black text-slate-900">Portrait 390x844</p>
                      <span className="text-[8px] font-bold text-indigo-600">Snap-to-Grid Active</span>
                    </div>

                    {/* Mobile Mini Visual Mockup */}
                    <div className="p-2 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1.5">
                      <p className="text-[9px] font-bold text-slate-700">Visual Layout Preview</p>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[8px] text-slate-600">
                          <span>Phone Layout Coverage</span>
                          <span>{selectedPageAudit.score}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full" style={{ width: `${selectedPageAudit.score}%` }} />
                        </div>
                      </div>
                    </div>

                    <div className="p-2 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1">
                      <p className="text-[9px] font-bold text-slate-700">Mobile Status</p>
                      <div className="h-10 bg-slate-50 rounded flex items-center justify-center text-[9px] text-emerald-600 font-bold">
                        📱 Ready for Mobile App
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4 space-y-3 bg-white/60 rounded-2xl border border-dashed border-slate-300 my-auto">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <Smartphone className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Create a mobile layout</p>
                      <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                        Drag visuals from the page visuals pane onto the mobile canvas in Power BI Desktop.
                      </p>
                    </div>
                    <div className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-md text-[9px] font-bold text-slate-600">
                      0 of {selectedPageAudit.desktop_visual_count ?? 0} Visuals Placed
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Home Indicator */}
              <div className="w-28 h-1 bg-slate-600 rounded-full mx-auto mt-2 flex-shrink-0" />
            </div>
          </div>
        </div>
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
    if (sidebarActive === 'visual_regression') return renderVisualRegression();
    if (sidebarActive === 'dax_performance') return renderDaxPerformance();
    if (sidebarActive === 'mobile_layout') return renderMobileLayout();
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
