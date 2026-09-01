import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FileUp, File, AlertCircle, Loader2 } from 'lucide-react';

export default function PbixUpload() {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Pre-warm backend when page opens (wakes up sleeping Render instance)
  useEffect(() => {
    axios.get('/api/health').catch(() => {});
  }, []);

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
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('run_functional', 'true');
    formData.append('run_pdf', 'true');
    formData.append('run_excel', 'true');
    formData.append('auth_mode', 'service_principal');
    
    try {
      // Do not manually set Content-Type header so Axios generates the multipart boundary automatically
      const response = await axios.post('/api/pbix/upload', formData, {
        timeout: 180000,
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
        setError("Connection timeout or network error. The Render backend server may be waking up from sleep. Please wait 15 seconds and try again.");
      } else {
        setError("Failed to upload file and execute tests. Please try again.");
      }
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8 space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-slate-900">Upload PBIX File</h1>
        <p className="text-slate-600 text-sm mt-1">
          Upload your Power BI template or report file to execute the complete QA suite.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
        {/* Drag and Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[200px] ${
            dragActive ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-300 hover:border-indigo-400 bg-slate-50'
          } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pbix"
            onChange={handleChange}
          />
          
          <FileUp className="h-10 w-10 text-slate-400 mb-3" />
          
          {file ? (
            <div className="flex items-center gap-2 max-w-full">
              <File className="h-5 w-5 text-indigo-500 flex-shrink-0" />
              <span className="font-semibold text-slate-800 truncate text-sm">{file.name}</span>
              <span className="text-xs text-slate-500 flex-shrink-0">
                ({(file.size / (1024 * 1024)).toFixed(2)} MB)
              </span>
            </div>
          ) : (
            <div>
              <p className="font-semibold text-slate-800 text-sm">
                Drag and drop your PBIX file here, or <span className="text-indigo-600">browse</span>
              </p>
              <p className="text-slate-500 text-xs mt-1">Supports standard Power BI files up to 200MB</p>
            </div>
          )}
        </div>

        {/* Info Box */}
        {!uploading && (
          <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg text-indigo-950 text-xs leading-relaxed">
            <span className="font-bold block mb-1">💡 Automated Audit Run Includes:</span>
            <ul className="list-disc pl-4 space-y-1 text-indigo-900/90">
              <li>Formula naming standards & DAX complexity scanning</li>
              <li>Unused measures & duplicate calculations analysis</li>
              <li>Playwright browser functional page render & bookmark tests</li>
              <li>Power BI Service cloud PDF and Excel export verifications</li>
            </ul>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-600 font-medium mb-1">
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />
                Uploading & running complete QA tests...
              </span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-indigo-600 h-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
          <button
            onClick={() => navigate('/')}
            disabled={uploading}
            className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1.5 transition-colors"
          >
            {uploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Executing tests...
              </>
            ) : (
              'Run QA Suite'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
