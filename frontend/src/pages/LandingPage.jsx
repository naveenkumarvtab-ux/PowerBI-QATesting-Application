import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, CloudLightning, ArrowRight, ShieldCheck, CheckCircle2, Sparkles, Database } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold mb-4">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Select Validation Process</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Choose Your Power BI QA Workflow
        </h1>
        <p className="mt-3 text-base text-slate-600">
          Select whether you want to validate an offline local <span className="font-semibold text-slate-800">.pbix</span> file or connect directly to a published report on <span className="font-semibold text-slate-800">Power BI Cloud Service</span>.
        </p>
      </div>

      {/* Validation Mode Cards */}
      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {/* Option 1: Local File Upload */}
        <div 
          onClick={() => navigate('/upload-pbix')}
          className="group relative bg-white border-2 border-slate-200 hover:border-indigo-500 rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-0 opacity-60 group-hover:scale-110 group-hover:bg-indigo-100 transition-all"></div>
          
          <div className="relative z-10">
            <div className="h-14 w-14 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-6 shadow-md shadow-indigo-200 group-hover:scale-105 transition-transform">
              <FileUp className="h-7 w-7" />
            </div>

            <div className="inline-block px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-3">
              Process 01
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-3 group-hover:text-indigo-600 transition-colors">
              Local File Upload (.pbix)
            </h2>

            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              Statically analyze offline Power BI templates and reports. Audits Power Query step names, DAX measures, font styling, visual alignment, unused columns, and unused measures.
            </p>

            <div className="space-y-2.5 pt-4 border-t border-slate-100 mb-6">
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Zero cloud credentials required</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Custom font family validation</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Deep DAX & Power Query parsing</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Supports .pbix files up to 200MB</span>
            <button className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg group-hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shadow-sm">
              <span>Select Option</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Option 2: Power BI Service Validation */}
        <div 
          onClick={() => navigate('/test-service')}
          className="group relative bg-white border-2 border-slate-200 hover:border-sky-500 rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-50 rounded-bl-full -z-0 opacity-60 group-hover:scale-110 group-hover:bg-sky-100 transition-all"></div>
          
          <div className="relative z-10">
            <div className="h-14 w-14 rounded-xl bg-sky-600 text-white flex items-center justify-center mb-6 shadow-md shadow-sky-200 group-hover:scale-105 transition-transform">
              <CloudLightning className="h-7 w-7" />
            </div>

            <div className="inline-block px-2.5 py-1 rounded bg-sky-50 text-sky-700 text-xs font-bold uppercase tracking-wider mb-3">
              Process 02
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-3 group-hover:text-sky-600 transition-colors">
              Power BI Service Validation
            </h2>

            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              Connect to live reports hosted in Power BI Service via Azure AD. Validates live REST APIs, dataset refresh status, Playwright functional visual interactions, and PDF/Excel exports.
            </p>

            <div className="space-y-2.5 pt-4 border-t border-slate-100 mb-6">
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Live Power BI Cloud REST API verification</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Interactive Playwright visual & slicer testing</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Automated PDF & Excel data export audits</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Workspace & App URLs supported</span>
            <button className="px-4 py-2 bg-sky-600 text-white text-xs font-bold rounded-lg group-hover:bg-sky-700 transition-colors flex items-center gap-1.5 shadow-sm">
              <span>Select Option</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* Reassurance Footer Banner */}
      <div className="bg-slate-900 text-white rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-indigo-400 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-sm text-slate-100">Enterprise Standards Compliance</h4>
            <p className="text-xs text-slate-400">All 15 QA categories execute with zero data loss or workspace alterations.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Database className="h-4 w-4 text-indigo-400" />
          <span>Local execution mode active</span>
        </div>
      </div>
    </div>
  );
}
