import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FileUp, File, AlertCircle, Loader2, CheckCircle2, Type, Clock, ArrowLeft, Sparkles, ShieldCheck } from 'lucide-react';

export default function PbixUpload() {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [expectedFont, setExpectedFont] = useState('Segoe UI');
  
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const timerRef = useRef(null);

  const ESTIMATED_SECONDS = 30;
  const [countdownSeconds, setCountdownSeconds] = useState(ESTIMATED_SECONDS);

  // Pre-warm backend when page opens
  useEffect(() => {
    axios.get('/api/health').catch(() => {});
  }, []);

  // Timer effect during upload/execution
  useEffect(() => {
    if (uploading) {
      setCountdownSeconds(ESTIMATED_SECONDS);
      timerRef.current = setInterval(() => {
        setCountdownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [uploading]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}s`;
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile) => {
    setError(null);
    if (!selectedFile.name.toLowerCase().endsWith('.pbix')) {
      setError("Invalid file format. Please select a Power BI .pbix file.");
      setFile(null);
      return;
    }
    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    setError(null);
    setUploadProgress(0);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('run_functional', 'true');
    formData.append('run_pdf', 'true');
    formData.append('run_excel', 'true');
    formData.append('auth_mode', 'service_principal');
    if (expectedFont && expectedFont.trim()) {
      formData.append('expected_font', expectedFont.trim());
    }
    
    try {
      const response = await axios.post('/api/pbix/upload', formData, {
        timeout: 240000,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        }
      });
      
      const jobId = response.data.job_id;
      navigate(`/jobs/${jobId}/status`);
      
    } catch (err) {
      console.error("Upload error:", err);
      const serverError = err.response?.data?.error || err.response?.data?.message;
      if (serverError) {
        setError(serverError);
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout') || err.message?.includes('Network Error')) {
        setError("Connection timeout or network error. Please try again.");
      } else {
        setError("Failed to upload file and execute tests. Please try again.");
      }
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const fontPresets = ['Segoe UI', 'Calibri', 'Arial', 'DIN', 'Segoe UI Semibold', 'Georgia'];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Back to Landing navigation */}
      <button 
        onClick={() => navigate('/landing')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Process Selection
      </button>

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Local PBIX File Validation</h1>
        <p className="text-slate-600 text-sm mt-1">
          Upload your offline Power BI file to run full static formula, layout, font consistency, and model checks.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        {/* Drag and Drop Zone */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            1. Select or Drop Power BI File (.pbix)
          </label>
          
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current.click()}
            className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[190px] ${
              dragActive 
                ? 'border-indigo-500 bg-indigo-50/50' 
                : file 
                  ? 'border-emerald-400 bg-emerald-50/30' 
                  : 'border-slate-300 hover:border-indigo-400 bg-slate-50'
            } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pbix"
              onChange={handleChange}
            />
            
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-2 max-w-full mt-1">
                  <File className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span className="font-bold text-slate-900 truncate text-sm">{file.name}</span>
                  <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex-shrink-0">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
                <p className="text-xs font-semibold text-emerald-700 mt-1">
                  ✓ File uploaded and ready for QA testing. Click to replace.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="h-12 w-12 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mb-3">
                  <FileUp className="h-6 w-6" />
                </div>
                <p className="font-semibold text-slate-800 text-sm">
                  Drag & drop your PBIX file here, or <span className="text-indigo-600 underline">browse computer</span>
                </p>
                <p className="text-slate-500 text-xs mt-1">Supports all Power BI Desktop formats up to 200MB</p>
              </div>
            )}
          </div>
        </div>

        {/* Font Consistency Validation Configuration */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Type className="h-4 w-4 text-indigo-600" />
              2. Expected Font Consistency Validation
            </label>
            <span className="text-[11px] text-slate-500 font-medium">Headers & Values</span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Enter the brand/theme font family expected in this report. The QA engine validates that visual titles, axis headers, and value/data labels match this font.
          </p>

          <div>
            <input
              type="text"
              value={expectedFont}
              onChange={(e) => setExpectedFont(e.target.value)}
              placeholder="e.g. Segoe UI, Calibri, Arial, DIN..."
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-slate-800 shadow-sm"
            />
          </div>

          {/* Preset Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-slate-500 font-medium mr-1">Presets:</span>
            {fontPresets.map((font) => (
              <button
                key={font}
                type="button"
                onClick={() => setExpectedFont(font)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  expectedFont.toLowerCase() === font.toLowerCase()
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {font}
              </button>
            ))}
          </div>
        </div>

        {/* Live Elapsed Time & Progress Bar */}
        {uploading && (
          <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-900">
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                <span>Uploading file & running QA test suite...</span>
              </span>
              <span className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-full border border-indigo-200 text-indigo-700 font-mono text-xs">
                <Clock className="h-3.5 w-3.5 text-indigo-500" />
                {countdownSeconds > 0 ? `Est. ${formatTimer(countdownSeconds)} left` : 'Finalizing...'}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-indigo-700 font-medium">
                <span>Upload Progress</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-indigo-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-600" />
            <div className="space-y-0.5">
              <span className="font-bold block">Upload failed:</span>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Actions Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <button
            onClick={() => navigate('/landing')}
            disabled={uploading}
            className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50 flex items-center gap-2 transition-all cursor-pointer"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Running QA Suite ({countdownSeconds > 0 ? formatTimer(countdownSeconds) : 'Finalizing'})...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Run QA Test Suite</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
