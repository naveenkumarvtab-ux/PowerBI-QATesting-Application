import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  Download, ArrowLeft, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp, AlertCircle, Loader2
} from 'lucide-react';

export default function ReportView() {
  const { jobId } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Collapsed sections mapping {category: boolean}
  const [collapsed, setCollapsed] = useState({});
  // Filters
  const [statusFilter, setStatusFilter] = useState('all'); // all, pass, warning, fail

  const [activeTab, setActiveTab] = useState('category'); // category, page
  const [activeSheet, setActiveSheet] = useState(null); // Active sheet in page view
  const [pageCollapsed, setPageCollapsed] = useState({});
  const [visualCollapsed, setVisualCollapsed] = useState({});
  const [tableCollapsed, setTableCollapsed] = useState({});

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const response = await axios.get(`/api/jobs/${jobId}/result`);
        setReport(response.data);
        
        // Initialize all sections as expanded (collapsed = false)
        const initialCollapsed = {};
        response.data.sections.forEach(sec => {
          initialCollapsed[sec.category] = false;
        });
        setCollapsed(initialCollapsed);

        // Set default active sheet
        if (response.data.page_grouped_view && response.data.page_grouped_view.length > 0) {
          setActiveSheet(response.data.page_grouped_view[0].page_name);
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

  const toggleCollapse = (cat) => {
    setCollapsed(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  // Scroll helper: Expands category details card and scrolls down smoothly
  const scrollToSection = (cat) => {
    setCollapsed(prev => ({
      ...prev,
      [cat]: false // Ensure it's expanded
    }));
    
    // Tiny delay to allow state changes to register
    setTimeout(() => {
      const element = document.getElementById(`category-sec-${cat}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Temporarily highlight the category card to guide the user
        element.classList.add('ring-2', 'ring-indigo-500', 'transition-all');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-indigo-500');
        }, 1500);
      }
    }, 120);
  };

  // Scroll helper: Expands report page details card and scrolls down smoothly
  const scrollToPage = (pageName) => {
    setActiveSheet(pageName);
    
    setTimeout(() => {
      const element = document.getElementById('sheet-content-area');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        element.classList.add('ring-2', 'ring-indigo-500', 'transition-all');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-indigo-500');
        }, 1500);
      }
    }, 120);
  };

  // Sorting helper to push bookmark and page navigation checks to the end
  const sortChecksLast = (checks) => {
    return [...checks].sort((a, b) => {
      const isA = a.category === 'functional' || 
                  (a.target && a.target.toLowerCase().includes('bookmark')) || 
                  (a.target && a.target.toLowerCase().includes('navigation'));
      const isB = b.category === 'functional' || 
                  (b.target && b.target.toLowerCase().includes('bookmark')) || 
                  (b.target && b.target.toLowerCase().includes('navigation'));
      if (isA && !isB) return 1;
      if (!isA && isB) return -1;
      return 0;
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <LoaderIcon className="h-8 w-8 animate-spin text-indigo-600" />
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

  // Prepare chart data
  const chartData = report.sections.map(sec => {
    const passed = sec.results.filter(r => r.status === 'pass').length;
    const warnings = sec.results.filter(r => r.status === 'warning').length;
    const failed = sec.results.filter(r => r.status === 'fail').length;
    return {
      name: sec.category_name,
      categoryKey: sec.category,
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
        
        <a
          href={`/api/jobs/${jobId}/report.pdf`}
          download
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <Download className="h-4 w-4" />
          Download PDF Report
        </a>
      </div>

      {/* Title block */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-100 pb-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Analysis Summary Report</h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">Job: {jobId}</p>
          </div>
          <div className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-900 rounded-lg text-xs font-semibold self-start">
            Mode: {method === 'pbix' ? 'Local PBIX Parse' : 'Power BI Service'}
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-400 font-bold uppercase block mb-1">Target Source</span>
            <code className="bg-slate-50 border border-slate-200 p-1.5 rounded block text-slate-800 break-all font-mono">
              {source}
            </code>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-slate-400 font-bold uppercase block mb-0.5">Started At</span>
              <span className="text-slate-700 font-medium">{new Date(started_at).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-slate-400 font-bold uppercase block mb-0.5">Completed At</span>
              <span className="text-slate-700 font-medium">{completed_at ? new Date(completed_at).toLocaleString() : 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Checks</span>
          <span className="text-2xl font-black text-slate-950 mt-1 block">{summary.total_checks}</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center border-l-4 border-l-emerald-500">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Passed</span>
          <span className="text-2xl font-black text-emerald-600 mt-1 block">{summary.passed}</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center border-l-4 border-l-amber-500">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Warnings</span>
          <span className="text-2xl font-black text-amber-500 mt-1 block">{summary.warnings}</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center border-l-4 border-l-rose-500">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Failed</span>
          <span className="text-2xl font-black text-rose-600 mt-1 block">{summary.failed}</span>
        </div>
      </div>

      {/* Visual Chart Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Checks Summary By Category</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">Click any bar inside the chart below to navigate directly to its details card.</p>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={chartData} 
              margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
              onClick={(state) => {
                if (state && state.activePayload && state.activePayload.length > 0) {
                  const data = state.activePayload[0].payload;
                  if (data && data.categoryKey) {
                    scrollToSection(data.categoryKey);
                  }
                }
              }}
              style={{ cursor: 'pointer' }}
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

      {/* Category/Page Shortcut Badges */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm space-y-2">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
          🎯 Quick Navigation Shortcuts ({activeTab === 'category' ? 'Categories' : 'Report Pages'})
        </span>
        <div className="flex flex-wrap gap-2">
          {activeTab === 'category' ? (
            report.sections.map(sec => {
              const passed = sec.results.filter(r => r.status === 'pass').length;
              const warnings = sec.results.filter(r => r.status === 'warning').length;
              const failed = sec.results.filter(r => r.status === 'fail').length;
              
              return (
                <button
                  key={sec.category}
                  type="button"
                  onClick={() => scrollToSection(sec.category)}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 rounded-lg text-xs font-semibold text-slate-700 shadow-sm transition-all flex items-center gap-1.5"
                >
                  <span>{sec.category_name}</span>
                  <span className="flex items-center gap-1">
                    {failed > 0 && <span className="h-2 w-2 rounded-full bg-rose-500"></span>}
                    {warnings > 0 && <span className="h-2 w-2 rounded-full bg-amber-500"></span>}
                    {failed === 0 && warnings === 0 && <span className="h-2 w-2 rounded-full bg-emerald-500"></span>}
                  </span>
                </button>
              );
            })
          ) : (
            report.page_grouped_view && report.page_grouped_view.map(page => {
              const allChecks = [
                ...page.page_checks,
                ...page.visuals.flatMap(v => v.results)
              ];
              const passed = allChecks.filter(r => r.status === 'pass').length;
              const warnings = allChecks.filter(r => r.status === 'warning').length;
              const failed = allChecks.filter(r => r.status === 'fail').length;

              return (
                <button
                  key={page.page_name}
                  type="button"
                  onClick={() => scrollToPage(page.page_name)}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 rounded-lg text-xs font-semibold text-slate-700 shadow-sm transition-all flex items-center gap-1.5"
                >
                  <span>{page.page_name}</span>
                  <span className="flex items-center gap-1">
                    {failed > 0 && <span className="h-2 w-2 rounded-full bg-rose-500"></span>}
                    {warnings > 0 && <span className="h-2 w-2 rounded-full bg-amber-500"></span>}
                    {failed === 0 && warnings === 0 && <span className="h-2 w-2 rounded-full bg-emerald-500"></span>}
                  </span>
                </button>
              );
            })
          )}
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
                onClick={() => setActiveTab('category')}
                className={`px-2.5 py-1 rounded transition-all ${
                  activeTab === 'category' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-950'
                }`}
              >
                Category View
              </button>
              {report.page_grouped_view && report.page_grouped_view.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('page')}
                  className={`px-2.5 py-1 rounded transition-all ${
                    activeTab === 'page' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-950'
                  }`}
                >
                  Page View
                </button>
              )}
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

        {/* Tab 1: Category View */}
        {activeTab === 'category' && report.sections.map(sec => {
          const filteredResults = sec.results.filter(res => {
            if (statusFilter === 'all') return true;
            return res.status === statusFilter;
          });
          
          if (filteredResults.length === 0 && statusFilter !== 'all') return null;

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
                  <h3 className="font-bold text-slate-800 text-sm">{sec.category_name}</h3>
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
                  {/* Caveat Alert */}
                  {sec.caveat && (
                    <div className="my-3 p-3 bg-amber-50/50 border border-amber-200 text-amber-900 rounded-lg text-xs leading-relaxed flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <span>{sec.caveat}</span>
                    </div>
                  )}

                  {/* REST STRUCTURE FOR POWER QUERY NAMING (TABLE-WISE) */}
                  {sec.category === 'power_query_naming' && sec.tables ? (
                    <div className="space-y-4 py-4">
                      {sec.tables.map(table => {
                        const filteredTableResults = table.results.filter(res => {
                          if (statusFilter === 'all') return true;
                          return res.status === statusFilter;
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
                                {table.summary.failed > 0 && (
                                  <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                    {table.summary.failed} Failed
                                  </span>
                                )}
                                {table.summary.warnings > 0 && (
                                  <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                    {table.summary.warnings} Warnings
                                  </span>
                                )}
                                {table.summary.passed > 0 && (
                                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                    {table.summary.passed} Passed
                                  </span>
                                )}
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
                      })}
                    </div>
                  ) : (
                    filteredResults.map((res, rIdx) => (
                      <div key={rIdx} className="py-4 last:border-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <h4 className="font-bold text-slate-800 text-sm font-mono break-all">
                              {res.target}
                            </h4>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {res.message}
                            </p>
                          </div>
                          
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border flex-shrink-0 flex items-center gap-1 ${
                            res.status === 'pass' && 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          } ${
                            res.status === 'warning' && 'bg-amber-50 text-amber-800 border-amber-200'
                          } ${
                            res.status === 'fail' && 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}>
                            {res.status === 'pass' && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                            {res.status === 'warning' && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                            {res.status === 'fail' && <XCircle className="h-3 w-3 text-rose-600" />}
                            {res.status}
                          </span>
                        </div>

                        {res.suggested_fix && (
                          <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs leading-relaxed">
                            <strong className="font-bold text-slate-700 block mb-0.5">Suggested Fix:</strong>
                            <span className="text-slate-600">{res.suggested_fix}</span>
                          </div>
                        )}

                        {res.screenshot_url && (
                          <div className="mt-3">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                              Screenshot Captured
                            </span>
                            <img 
                              src={res.screenshot_url} 
                              alt="Visual Error Screenshot" 
                              className="max-w-md w-full border border-slate-200 rounded-lg shadow-sm hover:scale-[1.02] transition-transform cursor-pointer"
                              onClick={() => window.open(res.screenshot_url, '_blank')}
                            />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Tab 2: Page View */}
        {activeTab === 'page' && report.page_grouped_view && (
          <div className="space-y-4">
            {/* Sheet Tabs Navigation Row */}
            <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar bg-slate-50/50 rounded-t-xl p-1 gap-1">
              {report.page_grouped_view.map(page => {
                const allChecks = [
                  ...page.page_checks,
                  ...page.visuals.flatMap(v => v.results)
                ];
                const warnings = allChecks.filter(r => r.status === 'warning').length;
                const failed = allChecks.filter(r => r.status === 'fail').length;
                const isActive = activeSheet === page.page_name;

                return (
                  <button
                    key={page.page_name}
                    type="button"
                    onClick={() => setActiveSheet(page.page_name)}
                    className={`px-4 py-2.5 rounded-lg font-bold text-xs whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      isActive 
                        ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60' 
                        : 'text-slate-500 hover:text-slate-900 hover:bg-white/50 border border-transparent'
                    }`}
                  >
                    <span>{page.page_name}</span>
                    <span className="flex items-center gap-1">
                      {failed > 0 && <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse"></span>}
                      {warnings > 0 && <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>}
                      {failed === 0 && warnings === 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Sheet Content Area */}
            <div id="sheet-content-area" className="bg-white border border-slate-200 rounded-b-xl p-6 shadow-sm min-h-[350px] space-y-6">
              {(() => {
                const page = report.page_grouped_view.find(p => p.page_name === activeSheet);
                if (!page) {
                  return (
                    <div className="text-center py-16 text-slate-400 text-xs">
                      Select a sheet from the navigation tabs above to view results.
                    </div>
                  );
                }

                const filteredPageChecks = page.page_checks.filter(res => {
                  if (statusFilter === 'all') return true;
                  return res.status === statusFilter;
                });

                const filteredVisuals = page.visuals.map(vis => {
                  const results = vis.results.filter(res => {
                    if (statusFilter === 'all') return true;
                    return res.status === statusFilter;
                  });
                  return { ...vis, results };
                }).filter(vis => vis.results.length > 0);

                if (filteredPageChecks.length === 0 && filteredVisuals.length === 0) {
                  return (
                    <div className="text-center py-20 text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                      <span className="font-semibold text-slate-700">No issues matching filters found on this sheet.</span>
                      <span className="text-slate-400 text-[10px]">Try changing your filters to All, Warnings, or Passed.</span>
                    </div>
                  );
                }

                const sortedPageChecks = sortChecksLast(filteredPageChecks);

                return (
                  <div className="space-y-6">
                    {/* Sheet Summary Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">Sheet Audit Details: {page.page_name}</h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">Showing all page standard configurations and individual visual checks on this sheet.</p>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded font-semibold border border-slate-200/50">
                          {filteredPageChecks.length} page checks
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded font-semibold border border-slate-200/50">
                          {filteredVisuals.length} visual containers
                        </span>
                      </div>
                    </div>

                    {/* Page-level Checks */}
                    {sortedPageChecks.length > 0 && (
                      <div className="border border-slate-200/70 rounded-xl overflow-hidden shadow-sm bg-slate-50/20">
                        <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          Page-Level Standard Checks
                        </div>
                        <div className="divide-y divide-slate-100 px-4 bg-white">
                          {sortedPageChecks.map((res, rIdx) => (
                            <div key={rIdx} className="py-4 flex items-start justify-between gap-4">
                              <div className="space-y-1">
                                <h4 className="font-bold text-slate-800 text-sm font-mono break-all">{res.target}</h4>
                                <p className="text-xs text-slate-600 leading-relaxed">{res.message}</p>
                                {res.suggested_fix && (
                                  <div className="mt-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs leading-relaxed">
                                    <strong className="font-bold text-slate-700">Suggested Fix:</strong>
                                    <span className="text-slate-600 block mt-0.5">{res.suggested_fix}</span>
                                  </div>
                                )}
                                {res.screenshot_url && (
                                  <div className="mt-3">
                                    <img 
                                      src={res.screenshot_url} 
                                      alt="Screenshot" 
                                      className="max-w-md w-full border border-slate-200 rounded-lg shadow-sm hover:scale-[1.02] transition-transform cursor-pointer"
                                      onClick={() => window.open(res.screenshot_url, '_blank')}
                                    />
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

                    {/* Visual containers */}
                    {filteredVisuals.length > 0 && (
                      <div className="space-y-4">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">
                          Visual Container Elements & Nested Findings
                        </div>
                        
                        <div className="grid grid-cols-1 gap-4">
                          {filteredVisuals.map(vis => {
                            const isVCollapsed = visualCollapsed[vis.visual_id] !== undefined
                              ? visualCollapsed[vis.visual_id]
                              : !vis.results.some(r => r.status === 'fail' || r.status === 'warning');

                            const sortedVisResults = sortChecksLast(vis.results);

                            return (
                              <div key={vis.visual_id} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                                <div 
                                  onClick={() => setVisualCollapsed(prev => ({...prev, [vis.visual_id]: !isVCollapsed}))}
                                  className="bg-slate-50/50 px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors select-none"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-800 text-xs">
                                      {vis.visual_title || `${vis.visual_type} Visual`}
                                    </span>
                                    <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono border border-slate-200/50">
                                      {vis.visual_id}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-500 font-semibold mr-1">
                                      {vis.results.length} checks
                                    </span>
                                    {isVCollapsed ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
                                  </div>
                                </div>

                                {!isVCollapsed && (
                                  <div className="divide-y divide-slate-100 px-4 bg-white">
                                    {sortedVisResults.map((res, rIdx) => (
                                      <div key={rIdx} className="py-3">
                                        <div className="flex items-start justify-between gap-4">
                                          <div className="space-y-1">
                                            <h5 className="font-bold text-slate-700 text-xs font-mono">{res.target}</h5>
                                            <p className="text-xs text-slate-600 leading-relaxed">{res.message}</p>
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
                                        {res.suggested_fix && (
                                          <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded text-[11px] leading-relaxed">
                                            <strong className="font-bold text-slate-700">Suggested Fix:</strong>
                                            <span className="text-slate-600 block mt-0.5">{res.suggested_fix}</span>
                                          </div>
                                        )}
                                        {res.screenshot_url && (
                                          <div className="mt-3">
                                            <img 
                                              src={res.screenshot_url} 
                                              alt="Screenshot" 
                                              className="max-w-md w-full border border-slate-200 rounded-lg shadow-sm hover:scale-[1.02] transition-transform cursor-pointer"
                                              onClick={() => window.open(res.screenshot_url, '_blank')}
                                            />
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
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LoaderIcon({ className }) {
  return <Loader2 className={className} />;
}
