import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Cloud, Lock, User, Key, CheckSquare, Square, AlertCircle, Loader2, Settings, HelpCircle, LogOut } from 'lucide-react';

export default function ServiceTest() {
  const [reportUrl, setReportUrl] = useState('');
  const [authMode, setAuthMode] = useState('delegated'); // 'delegated', 'direct_token', 'service_principal', 'demo'
  
  // User auth state
  const [username, setUsername] = useState(null);
  const [token, setToken] = useState(null);
  const [manualToken, setManualToken] = useState('');
  
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
              setAuthMode('delegated');
              setSuccessMsg(`Authenticated successfully as: ${response.data.username}`);
            }
          } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || "OAuth login exchange failed. Check your Azure AD settings.");
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
        redirect_uri: redirectUri,
        client_id: customClientId || undefined,
        tenant_id: customTenantId || undefined
      });
      
      if (authMode === 'service_principal' && response.data.success) {
        setToken(response.data.token);
        setUsername("Service Principal (App Identity)");
        setSuccessMsg("Connected to backend Power BI client via Service Principal.");
      } else if (authMode === 'delegated' && response.data.auth_url) {
        // Save custom settings before redirect
        if (customClientId) localStorage.setItem('pbi_custom_client_id', customClientId);
        if (customTenantId) localStorage.setItem('pbi_custom_tenant_id', customTenantId);
        // Redirect user to Microsoft Azure AD login page
        window.location.href = response.data.auth_url;
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to initiate sign-in. Check your Azure Client ID.");
    } finally {
      setConnecting(false);
    }
  };

  const handleDemoSignIn = () => {
    setToken("MOCK_DELEGATED_ACCESS_TOKEN_12345");
    setUsername("demo_user@yourdomain.onmicrosoft.com (Demo Simulation)");
    setSuccessMsg("Signed in with simulated demo account.");
    setError(null);
  };

  const handleApplyDirectToken = () => {
    if (!manualToken.trim()) {
      setError("Please paste a valid Power BI Bearer access token.");
      return;
    }
    setToken(manualToken.trim());
    setUsername("Authenticated via Direct Access Token");
    setSuccessMsg("Access token set successfully.");
    setError(null);
  };

  const handleSignOut = () => {
    setToken(null);
    setUsername(null);
    setManualToken('');
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
    if (!reportUrl) {
      setError("Please specify a live Power BI report URL.");
      return;
    }
    
    const activeToken = token || (authMode === 'direct_token' ? manualToken.trim() : null);
    if (!activeToken && authMode !== 'service_principal') {
      setError("Please sign in or provide an access token first.");
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
        auth_mode: authMode === 'demo' ? 'delegated' : authMode,
        token: activeToken
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => { setAuthMode('delegated'); handleSignOut(); }}
                className={`p-3 border rounded-xl flex flex-col justify-between text-left transition-all ${
                  authMode === 'delegated' 
                    ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-medium ring-1 ring-indigo-500' 
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <User className="h-4 w-4 text-indigo-600" />
                  <span className="font-bold text-xs">Microsoft Sign-In</span>
                </div>
                <span className="text-[11px] text-slate-500">Corporate AD login</span>
              </button>

              <button
                type="button"
                onClick={() => { setAuthMode('direct_token'); handleSignOut(); }}
                className={`p-3 border rounded-xl flex flex-col justify-between text-left transition-all ${
                  authMode === 'direct_token' 
                    ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-medium ring-1 ring-indigo-500' 
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Key className="h-4 w-4 text-indigo-600" />
                  <span className="font-bold text-xs">Direct Token</span>
                </div>
                <span className="text-[11px] text-slate-500">Paste Bearer token</span>
              </button>

              <button
                type="button"
                onClick={() => { setAuthMode('service_principal'); handleSignOut(); }}
                className={`p-3 border rounded-xl flex flex-col justify-between text-left transition-all ${
                  authMode === 'service_principal' 
                    ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-medium ring-1 ring-indigo-500' 
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Lock className="h-4 w-4 text-indigo-600" />
                  <span className="font-bold text-xs">Service Principal</span>
                </div>
                <span className="text-[11px] text-slate-500">Client Secret (CI/CD)</span>
              </button>
            </div>
          </div>

          {/* Auth Input Blocks */}
          <div className="pt-2">
            {username ? (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-900 text-xs">
                  <Cloud className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <span className="block text-[11px] text-emerald-600 font-semibold uppercase">Active Session</span>
                    <span className="font-bold">{username}</span>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="px-2.5 py-1 bg-white border border-red-200 hover:bg-red-50 text-red-700 text-xs font-bold rounded-lg shadow-sm flex items-center gap-1 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Method 1: Delegated Microsoft Login */}
                {authMode === 'delegated' && (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={connecting}
                      className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                      {connecting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Redirecting to Microsoft Login...
                        </>
                      ) : (
                        <>
                          <Cloud className="h-4 w-4" />
                          Sign In via Microsoft
                        </>
                      )}
                    </button>

                    {/* Azure AD App Settings Toggle */}
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
                          <p className="text-slate-500">
                            If your backend does not have Azure App Registration credentials configured in <code>.env</code>, specify your Azure App Client ID below:
                          </p>
                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">Azure Client ID (Application ID)</label>
                            <input
                              type="text"
                              placeholder="e.g. 11111111-2222-3333-4444-555555555555"
                              value={customClientId}
                              onChange={(e) => setCustomClientId(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">Azure Tenant ID (Optional, default: 'common')</label>
                            <input
                              type="text"
                              placeholder="e.g. your-tenant-id or common"
                              value={customTenantId}
                              onChange={(e) => setCustomTenantId(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Method 2: Direct Token */}
                {authMode === 'direct_token' && (
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Power BI Bearer Token
                      </label>
                      <textarea
                        rows="3"
                        placeholder="Paste Bearer eyJ0eXAiOiJKV1Qi... token from Azure CLI / PowerShell / Postman"
                        value={manualToken}
                        onChange={(e) => setManualToken(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyDirectToken}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                    >
                      Apply Access Token
                    </button>
                  </div>
                )}

                {/* Method 3: Service Principal */}
                {authMode === 'service_principal' && (
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={connecting}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                      {connecting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Authenticating Service Principal...
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4" />
                          Verify Service Principal Connection
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Simulated Demo Fallback */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Don't have Azure credentials?</span>
                  <button
                    type="button"
                    onClick={handleDemoSignIn}
                    className="text-xs text-slate-700 font-bold hover:underline"
                  >
                    Try with Demo Account
                  </button>
                </div>
              </div>
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
            disabled={running || (!token && authMode !== 'service_principal')}
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
