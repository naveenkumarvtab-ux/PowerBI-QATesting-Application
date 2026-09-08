import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, ShieldCheck, CheckCircle2, Zap, CloudLightning, FileUp, 
  Layers, BarChart3, Database, FileText, CheckCheck, PlayCircle, Sparkles
} from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 py-6 space-y-16">
      {/* Hero Section with High Impact Advertising & "Enter" Button */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-8 sm:p-12 lg:p-16 shadow-2xl border border-indigo-900/50 w-full">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-4xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold tracking-wide backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
            <span>Enterprise Power BI Quality Assurance Suite 2.0</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight text-white">
            Automated Quality Assurance for <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-300 to-teal-300">Power BI Reports</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl font-normal">
            Eliminate manual report auditing. Instantly scan DAX formulas, Power Query step naming, visual font styling, unused model assets, and cloud service export reliability with 15+ automated test categories.
          </p>

          {/* Prominent Enter Button */}
          <div className="pt-4 flex flex-wrap items-center gap-4">
            <button
              onClick={() => navigate('/landing')}
              className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold text-base rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3 group cursor-pointer"
            >
              <span>Enter QA Testing Suite</span>
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* Quick Highlights Bar */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-4 mt-12 pt-8 border-t border-indigo-900/60">
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">15+</div>
            <div className="text-xs text-slate-400 mt-0.5">Automated QA Audits</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-indigo-300">100%</div>
            <div className="text-xs text-slate-400 mt-0.5">Static & Cloud Coverage</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-sky-300">90%</div>
            <div className="text-xs text-slate-400 mt-0.5">Time Saved on QA</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-300">0%</div>
            <div className="text-xs text-slate-400 mt-0.5">Data Modification Risk</div>
          </div>
        </div>
      </div>

      {/* 3-Step Process Flow */}
      <div className="space-y-6">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">How the QA Suite Works</h2>
          <p className="text-sm text-slate-600 mt-2">End-to-end automated validation pipeline designed for Power BI developers and QA engineers.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative hover:border-indigo-300 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-base mb-4">
              01
            </div>
            <h3 className="font-bold text-slate-900 text-lg mb-2">Choose Mode</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Select between offline <strong>.pbix file upload</strong> with custom expected font validation, or live <strong>Power BI Service</strong> automated browser validation.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative hover:border-indigo-300 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-base mb-4">
              02
            </div>
            <h3 className="font-bold text-slate-900 text-lg mb-2">Automated Deep Scan</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Our dual-engine extracts M-queries, evaluates DAX formulas, detects unused model columns, audits layout font/alignment consistency, and runs Playwright UI events.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative hover:border-indigo-300 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-base mb-4">
              03
            </div>
            <h3 className="font-bold text-slate-900 text-lg mb-2">Actionable Left-Nav Report</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Review a structured report with Left-Side Navigation (Overview, Power Query tables, Data Model, and Sheet-Wise Visual Containers with Page Results).
            </p>
          </div>
        </div>
      </div>

      {/* Visual Highlights & Feature Pillars */}
      <div className="space-y-8">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Comprehensive QA Audit Pillars</h2>
          <p className="text-sm text-slate-600 mt-2">Every aspect of your Power BI ecosystem verified for production readiness.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCheck className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Formula & Step Naming</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Checks PascalCase naming on DAX measures and verifies non-default naming on Power Query ETL transformation steps.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Zap className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Font & Visual Consistency</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Matches all visual headers and value/data labels against your expected font standard (e.g. Segoe UI, Calibri, Arial).
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="h-10 w-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Database className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Model & Unused Assets</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Scans dataset relationships, bi-directional cross filters, unused columns, and unreferenced DAX measures.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="h-10 w-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Layers className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Page & Visual Containers</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Visualizes pass/fail findings broken down page-by-page, visual-by-visual, and concludes with overall page health scores.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <PlayCircle className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Functional UI & Slicers</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Playwright headless browser clicks slicers, validates bookmark states, and catches broken visual interactions.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="h-10 w-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">PDF & Excel Export Audits</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Verifies cloud export APIs, checking underlying data extraction and rendered PDF page completeness.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom CTA Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 rounded-2xl p-8 sm:p-10 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
        <div>
          <h3 className="text-2xl font-bold text-white">Ready to validate your Power BI report?</h3>
          <p className="text-sm text-slate-300 mt-1">Navigate to the Landing Page to choose Local Upload or Service Validation.</p>
        </div>
        <button
          onClick={() => navigate('/landing')}
          className="px-6 py-3.5 bg-white text-indigo-900 hover:bg-slate-100 font-bold text-sm rounded-xl shadow-md transition-all flex items-center gap-2 group whitespace-nowrap cursor-pointer"
        >
          <span>Enter QA Suite</span>
          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
