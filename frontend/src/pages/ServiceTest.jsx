import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Cloud, User, CheckSquare, Square, AlertCircle, Loader2, Settings, LogOut, ExternalLink, ShieldCheck } from 'lucide-react';

export default function ServiceTest() {
  const [reportUrl, setReportUrl] = useState('');
  
  // User auth state
  const [username, setUsername] = useState(null);
  const [token, setToken] = useState(null);
  
  // Custom Azure App credentials (optional in UI)
  const [showAzureConfig, setShowAzureConfig] = useState(false);
  const [customClientId, setCustomClientId] = useState(localStorage.getItem('pbi_custom_client_id') || '');
  const [customTenantId, setCustomTenantId] = useState(localStorage.getItem('pbi_custom_tenant_id') || '');
  
  const [checks, setChecks] = useState({
    naming: true,
    functional: true,
    export_pdf: true,
    export_excel: true
  });
  
  const [connecting, setConnecting] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  // Handle OAuth Redirect callback on mount
  useEffect(() => {
    const handleCallback = async () => {
      const urlParts = window.location.href.split('?');
      if (urlParts.length > 1) {
        const searchParams = new URLSearchParams(urlParts[1]);
        const code = searchParams.get('code');
        if (code) {
          // Immediately strip ?code= from URL to avoid re-triggering on reload
          window.history.replaceState({}, document.title, window.location.pathname + window.location.hash.split('?')[0]);
          
          setConnecting(true);
          setError(null);
          try {
            const redirectUri = window.location.origin + "/#/test-service";
            const response = await axios.post('/api/service/oauth/callback', {
              code,
              redirect_uri: redirectUri,
              client_id: customClientId || undefined,
              tenant_id: customTenantId || undefined
            });
            
            if (response.data.success) {
              setToken(response.data.token);
              setUsername(response.data.username);
              setSuccessMsg(`Authenticated successfully as: ${response.data.username}`);
            }
          } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || "Microsoft login exchange failed. Check your Azure settings.");
          } finally {
            setConnecting(false);
          }
        }
      }
    };
    
    handleCallback();
  }, [location]);

  const handleMicrosoftSignIn = async () => {
    setConnecting(true);
    setError(null);
    setSuccessMsg(null);
    
    try {
      const redirectUri = window.location.origin + "/#/test-service";
      const response = await axios.post('/api/service/connect', {
        auth_mode: 'delegated',
        redirect_uri: redirectUri,
        client_id: customClientId || undefined,
        tenant_id: customTenantId || undefined
      });
      
      if (response.data.auth_url) {
        // Save custom settings before redirect
        if (customClientId) localStorage.setItem('pbi_custom_client_id', customClientId);
        if (customTenantId) localStorage.setItem('pbi_custom_tenant_id', customTenantId);
        // Redirect user to Microsoft Azure AD login page
        window.location.href = response.data.auth_url;
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to initiate Microsoft sign-in. Check your Azure Client ID.");
    } finally {
      setConnecting(false);
    }
  };

  const handleSignOut = () => {
    setToken(null);
    setUsername(null);
    setSuccessMsg(null);
    setError(null);
    // Clear URL parameters completely
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash.split('?')[0]);
  };

  const handleToggleCheck = (key) => {
    setChecks(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleRunTests = async () => {
    if (!reportUrl.trim()) {
      setError("Please specify a live Power BI report URL from app.powerbi.com.");
      return;
    }
    
    if (!token) {
      setError("Please sign in with your Microsoft account first.");
      return;
    }

    setRunning(true);
    setError(null);
    
    const activeChecks = Object.keys(checks).filter(k => checks[k]);
    if (activeChecks.length === 0) {
      setError("Please select at least one QA check type to execute.");
      setRunning(false);
      return;
    }
    
    try {
      const response = await axios.post('/api/service/test', {
        report_url: reportUrl.trim(),
        checks: activeChecks,
        auth_mode: 'delegated',
        token: token
      });
      
      const jobId = response.data.job_id;
      navigate(`/jobs/${jobId}/status`);
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to trigger Power BI Service testing.");
      setRunning(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Power BI Service Testing</h1>
        <p className="text-slate-600 text-sm mt-1">
          Authenticate with Microsoft to read and audit live Power BI Service reports, datasets, and visuals.
        </p>
      </div>

      <div className="space-y-6">
        {/* Step 1: Microsoft Authentication Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-indigo-600" />
              1. Microsoft Authentication
            </label>
            {username && (
              <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                Connected
              </span>
            )}
          </div>

          {username ? (
            /* Active Authenticated State */
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-emerald-900 text-xs">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <User className="h-4 w-4 text-emerald-700" />
                </div>
                <div>
                  <span className="block text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Signed in as</span>
                  <span className="font-bold text-slate-900 text-sm">{username}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="px-3 py-1.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors self-start sm:self-auto"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          ) : (
            /* Unauthenticated State */
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleMicrosoftSignIn}
                disabled={connecting}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl shadow-sm flex items-center justify-center gap-2.5 transition-colors disabled:opacity-50"
              >
                {connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                    Opening Microsoft Sign-In...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 21 21" fill="none">
                      <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                      <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                      <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
                    </svg>
                    Sign In with Microsoft
                  </>
                )}
              </button>

              {/* Azure App Registration Configuration (Optional dropdown) */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAzureConfig(!showAzureConfig)}
                  className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-medium"
                >
                  <Settings className="h-3.5 w-3.5" />
                  {showAzureConfig ? "Hide Azure App Configuration" : "Custom Azure App Registration (Optional)"}
                </button>

                {showAzureConfig && (
                  <div className="mt-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5 text-xs">
                    <p className="text-slate-500 leading-relaxed">
                      If your organization uses a specific Azure AD App Registration, specify your Client ID below:
                    </p>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Azure Client ID (Application ID)</label>
                      <input
                        type="text"
                        placeholder="e.g. 11111111-2222-3333-4444-555555555555"
                        value={customClientId}
                        onChange={(e) => setCustomClientId(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Azure Tenant ID (Optional, default: 'common')</label>
                      <input
                        type="text"
                        placeholder="e.g. your-tenant-id or common"
                        value={customTenantId}
                        onChange={(e) => setCustomTenantId(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Power BI Report URL */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
            2. Power BI Report URL (app.powerbi.com)
          </label>
          <input
            type="text"
            placeholder="e.g., https://app.powerbi.com/groups/me/reports/e8b1b228-..."
            value={reportUrl}
            onChange={(e) => setReportUrl(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:border-indigo-500"
          />
          <p className="text-[11px] text-slate-400">
            Open the report in your browser on Power BI Service, copy the URL from the address bar, and paste it here.
          </p>
        </div>

        {/* Step 3: QA Audits Selection */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            3. Select QA Audits to Execute
          </label>
          <div className="space-y-3">
            <div 
              onClick={() => handleToggleCheck('naming')}
              className="flex items-start gap-3 cursor-pointer p-2 hover:bg-slate-50 rounded-lg select-none"
            >
              {checks.naming ? <CheckSquare className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" /> : <Square className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />}
              <div>
                <h3 className="text-sm font-bold text-slate-800">Database & Name Compliance Checks</h3>
                <p className="text-xs text-slate-500">Reads dataset schema, tables, M queries, and calculated columns directly from Power BI Service.</p>
              </div>
            </div>

            <div 
              onClick={() => handleToggleCheck('functional')}
              className="flex items-start gap-3 cursor-pointer p-2 hover:bg-slate-50 rounded-lg select-none"
            >
              {checks.functional ? <CheckSquare className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" /> : <Square className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />}
              <div>
                <h3 className="text-sm font-bold text-slate-800">Playwright Visual & Bookmark Integrity</h3>
                <p className="text-xs text-slate-500">Automates browser traversal of pages, bookmarks, and slicers to test visual stability.</p>
              </div>
            </div>

            <div 
              onClick={() => handleToggleCheck('export_pdf')}
              className="flex items-start gap-3 cursor-pointer p-2 hover:bg-slate-50 rounded-lg select-none"
            >
              {checks.export_pdf ? <CheckSquare className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" /> : <Square className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />}
              <div>
                <h3 className="text-sm font-bold text-slate-800">PDF Report Export Verification</h3>
                <p className="text-xs text-slate-500">Calls cloud ExportTo API, polls status, downloads and validates document structure.</p>
              </div>
            </div>

            <div 
              onClick={() => handleToggleCheck('export_excel')}
              className="flex items-start gap-3 cursor-pointer p-2 hover:bg-slate-50 rounded-lg select-none"
            >
              {checks.export_excel ? <CheckSquare className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" /> : <Square className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />}
              <div>
                <h3 className="text-sm font-bold text-slate-800">Excel Visual Data Export Check</h3>
                <p className="text-xs text-slate-500">Extracts data from report visuals and checks row counts and exported column names.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts and errors */}
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-rose-600" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}
        
        {successMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
            <Cloud className="h-4 w-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleRunTests}
            disabled={running || !token}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Auditing Power BI Service Report...
              </>
            ) : (
              'Run Live QA Tests'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
