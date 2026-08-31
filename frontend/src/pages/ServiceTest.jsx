import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Cloud, Lock, User, CheckSquare, Square, AlertCircle, Loader2 } from 'lucide-react';

export default function ServiceTest() {
  const [reportUrl, setReportUrl] = useState('');
  const [authMode, setAuthMode] = useState('service_principal'); // 'service_principal' or 'delegated'
  
  // User auth state (for delegated mode)
  const [username, setUsername] = useState(null);
  const [token, setToken] = useState(null);
  
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
      // In HashRouter, search parameters can be parsed from hash or window.location.href
      const urlParts = window.location.href.split('?');
      if (urlParts.length > 1) {
        const searchParams = new URLSearchParams(urlParts[1]);
        const code = searchParams.get('code');
        if (code) {
          setConnecting(true);
          setError(null);
          try {
            const redirectUri = window.location.origin + "/#/test-service";
            const response = await axios.post('/api/service/oauth/callback', {
              code,
              redirect_uri: redirectUri
            });
            
            if (response.data.success) {
              setToken(response.data.token);
              setUsername(response.data.username);
              setAuthMode('delegated');
              setSuccessMsg(`Authenticated successfully as: ${response.data.username}`);
              
              // Clear URL parameters
              window.history.replaceState({}, document.title, window.location.pathname + window.location.hash.split('?')[0]);
            }
          } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || "OAuth login exchange failed.");
          } finally {
            setConnecting(false);
          }
        }
      }
    };
    
    handleCallback();
  }, [location]);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    setSuccessMsg(null);
    
    try {
      const redirectUri = window.location.origin + "/#/test-service";
      const response = await axios.post('/api/service/connect', {
        auth_mode: authMode,
        redirect_uri: redirectUri
      });
      
      if (authMode === 'service_principal' && response.data.success) {
        setToken(response.data.token);
        setSuccessMsg("Connected to backend Power BI client via Service Principal.");
      } else if (authMode === 'delegated' && response.data.auth_url) {
        // Redirect user to Azure AD login page
        window.location.href = response.data.auth_url;
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to establish connection. Check backend configuration.");
    } finally {
      setConnecting(false);
    }
  };

  const handleToggleCheck = (key) => {
    setChecks(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleRunTests = async () => {
    if (!reportUrl) {
      setError("Please specify a live Power BI report URL.");
      return;
    }
    
    setRunning(true);
    setError(null);
    
    // Compile active checks keys
    const activeChecks = Object.keys(checks).filter(k => checks[k]);
    if (activeChecks.length === 0) {
      setError("Please select at least one QA check type to execute.");
      setRunning(false);
      return;
    }
    
    try {
      const response = await axios.post('/api/service/test', {
        report_url: reportUrl,
        checks: activeChecks,
        auth_mode: authMode,
        token: token
      });
      
      const jobId = response.data.job_id;
      navigate(`/jobs/${jobId}/status`);
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to trigger testing run.");
      setRunning(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Power BI Service Testing</h1>
        <p className="text-slate-600 text-sm mt-1">
          Perform live quality audits including page visual errors, bookmarks rendering, and data exports.
        </p>
      </div>

      <div className="space-y-6">
        {/* Form panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
              Power BI Report URL
            </label>
            <input
              type="text"
              placeholder="e.g., https://app.powerbi.com/groups/me/reports/e8b1b228-..."
              value={reportUrl}
              onChange={(e) => setReportUrl(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          {/* Auth Selection */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
              Authentication Method
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => { setAuthMode('service_principal'); setToken(null); setUsername(null); }}
                className={`p-3 border rounded-xl flex items-center gap-2 text-left transition-all ${
                  authMode === 'service_principal' 
                    ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-medium' 
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Lock className="h-4 w-4 text-indigo-500" />
                <div className="text-xs">
                  <span className="block font-bold">Service Principal</span>
                  <span className="text-slate-500">Unattended Client secret</span>
                </div>
              </button>
              
              <button
                type="button"
                onClick={() => { setAuthMode('delegated'); setToken(null); setUsername(null); }}
                className={`p-3 border rounded-xl flex items-center gap-2 text-left transition-all ${
                  authMode === 'delegated' 
                    ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-medium' 
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <User className="h-4 w-4 text-indigo-500" />
                <div className="text-xs">
                  <span className="block font-bold">User Delegated OAuth</span>
                  <span className="text-slate-500">Sign in with AD identity</span>
                </div>
              </button>
            </div>
          </div>

          {/* Connect Trigger */}
          <div className="pt-2">
            {username ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-800 text-xs">
                  <Cloud className="h-5 w-5 text-emerald-600" />
                  <span>Authenticated as <strong>{username}</strong></span>
                </div>
                <button
                  onClick={() => { setToken(null); setUsername(null); }}
                  className="text-xs text-red-600 font-bold hover:underline"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting to Active Directory...
                  </>
                ) : (
                  <>
                    <Cloud className="h-4 w-4" />
                    {authMode === 'delegated' ? 'Sign In via Microsoft' : 'Verify Service Connection'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Check types selection */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <label className="block text-xs font-bold uppercase text-slate-500 mb-3">
            Select QA Audits to Execute
          </label>
          <div className="space-y-3">
            <div 
              onClick={() => handleToggleCheck('naming')}
              className="flex items-start gap-3 cursor-pointer p-2 hover:bg-slate-50 rounded-lg"
            >
              {checks.naming ? <CheckSquare className="h-5 w-5 text-indigo-600 mt-0.5" /> : <Square className="h-5 w-5 text-slate-400 mt-0.5" />}
              <div>
                <h3 className="text-sm font-bold text-slate-800">Database & Name Compliance Checks</h3>
                <p className="text-xs text-slate-500">Analyzes tables, M steps, and calculated columns via REST DMV execution.</p>
              </div>
            </div>

            <div 
              onClick={() => handleToggleCheck('functional')}
              className="flex items-start gap-3 cursor-pointer p-2 hover:bg-slate-50 rounded-lg"
            >
              {checks.functional ? <CheckSquare className="h-5 w-5 text-indigo-600 mt-0.5" /> : <Square className="h-5 w-5 text-slate-400 mt-0.5" />}
              <div>
                <h3 className="text-sm font-bold text-slate-800">Playwright Visual & Bookmark Integrity</h3>
                <p className="text-xs text-slate-500">Automates browser traversal of pages, bookmarks, and slicers to test visual stability.</p>
              </div>
            </div>

            <div 
              onClick={() => handleToggleCheck('export_pdf')}
              className="flex items-start gap-3 cursor-pointer p-2 hover:bg-slate-50 rounded-lg"
            >
              {checks.export_pdf ? <CheckSquare className="h-5 w-5 text-indigo-600 mt-0.5" /> : <Square className="h-5 w-5 text-slate-400 mt-0.5" />}
              <div>
                <h3 className="text-sm font-bold text-slate-800">PDF Report Export Verification</h3>
                <p className="text-xs text-slate-500">Calls cloud ExportTo API, polls status, downloads and validates document structure.</p>
              </div>
            </div>

            <div 
              onClick={() => handleToggleCheck('export_excel')}
              className="flex items-start gap-3 cursor-pointer p-2 hover:bg-slate-50 rounded-lg"
            >
              {checks.export_excel ? <CheckSquare className="h-5 w-5 text-indigo-600 mt-0.5" /> : <Square className="h-5 w-5 text-slate-400 mt-0.5" />}
              <div>
                <h3 className="text-sm font-bold text-slate-800">Excel visual data export check</h3>
                <p className="text-xs text-slate-500">Clicks visual dropdowns to extract data, checks row counts and exported column names.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts and errors */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs">
            {successMsg}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleRunTests}
            disabled={running || (authMode === 'delegated' && !token)}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1.5 transition-colors"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Spawning Test Runner...
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
