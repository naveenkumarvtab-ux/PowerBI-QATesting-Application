import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, CloudLightning, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl">
          Automated Power BI QA Testing
        </h1>
        <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
          Ensure report reliability, name formatting compliance, code complexity standards, and service visual integrity in minutes.
        </p>
      </div>

      {/* Mode Select Cards */}
      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {/* Method 1: Local PBIX */}
        <div 
          onClick={() => navigate('/upload-pbix')}
          className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all flex flex-col justify-between group"
        >
          <div>
            <div className="bg-indigo-50 border border-indigo-100 text-indigo-600 h-12 w-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <FileUp className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Local PBIX Analysis</h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              Statically analyze an offline <strong>.pbix</strong> file. Extracts and parses Power Query (M) code steps, DAX measures, and calculated columns for best practices, naming schema, and complexity checks.
            </p>
          </div>
          <div className="text-sm font-semibold text-indigo-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            Start PBIX Analysis &rarr;
          </div>
        </div>

        {/* Method 2: Power BI Service */}
        <div 
          onClick={() => navigate('/test-service')}
          className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all flex flex-col justify-between group"
        >
          <div>
            <div className="bg-indigo-50 border border-indigo-100 text-indigo-600 h-12 w-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <CloudLightning className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Power BI Service Validation</h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              Test a live report published on the <strong>Power BI Cloud Service</strong>. Logs in via Azure AD, queries dataset schema metadata, runs Playwright functional UI regression checks, and validates Excel/PDF exports.
            </p>
          </div>
          <div className="text-sm font-semibold text-indigo-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            Connect & Run Service Suite &rarr;
          </div>
        </div>
      </div>

      {/* Feature List Section */}
      <div className="bg-slate-100 border border-slate-200 rounded-xl p-6">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-1.5">
          <ShieldCheck className="h-5 w-5 text-indigo-600" />
          Included QA Verifications
        </h3>
        
        <div className="grid sm:grid-cols-3 gap-6">
          <div className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-slate-800 text-sm">Naming Standards</h4>
              <p className="text-xs text-slate-600 mt-1">Regex matching for PascalCase DAX measures and non-default Power Query steps.</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <Zap className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-slate-800 text-sm">Complexity Checks</h4>
              <p className="text-xs text-slate-600 mt-1">Identifies overly nested engine functions and highlights missing VAR variables.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <CloudLightning className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-slate-800 text-sm">Visual & Export Health</h4>
              <p className="text-xs text-slate-600 mt-1">Visual tile timeout detection, bookmark integrity checks, and data export audits.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
