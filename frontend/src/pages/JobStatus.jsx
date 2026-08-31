import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2, AlertCircle, Play, CheckCircle2, XCircle } from 'lucide-react';

export default function JobStatus() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState('queued'); // queued, running, complete, failed
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('Queued...');
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    let intervalId;

    const pollStatus = async () => {
      try {
        const response = await axios.get(`/api/jobs/${jobId}/status`);
        const data = response.data;
        
        setStatus(data.status);
        setProgress(data.progress || 0);
        setCurrentStep(data.current_step || 'Processing...');
        
        if (data.status === 'complete') {
          clearInterval(intervalId);
          // Small delay for visual completion, then redirect to report view
          setTimeout(() => {
            navigate(`/jobs/${jobId}/report`);
          }, 1200);
        } else if (data.status === 'failed') {
          clearInterval(intervalId);
          setErrorMsg(data.current_step || "Job execution failed.");
        }
      } catch (err) {
        console.error(err);
        setErrorMsg("Failed to query status from server. Re-trying...");
      }
    };

    // First check immediate
    pollStatus();
    
    // Poll every 2s
    intervalId = setInterval(pollStatus, 2000);

    return () => clearInterval(intervalId);
  }, [jobId, navigate]);

  return (
    <div className="max-w-md mx-auto py-12">
      <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center">
        {/* State Icon */}
        <div className="flex justify-center mb-6">
          {status === 'queued' && (
            <div className="h-16 w-16 bg-slate-100 border border-slate-200 text-slate-500 rounded-full flex items-center justify-center animate-pulse">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          )}
          {status === 'running' && (
            <div className="h-16 w-16 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
          )}
          {status === 'complete' && (
            <div className="h-16 w-16 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
          )}
          {status === 'failed' && (
            <div className="h-16 w-16 bg-red-50 border border-red-100 text-red-600 rounded-full flex items-center justify-center">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          )}
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-slate-900 mb-1">
          {status === 'queued' && 'Initializing Test Suite...'}
          {status === 'running' && 'Executing Audits...'}
          {status === 'complete' && 'Analysis Complete!'}
          {status === 'failed' && 'Job Execution Failed'}
        </h2>
        <p className="text-xs font-mono text-slate-400 mb-6">ID: {jobId}</p>

        {/* Progress Bar */}
        <div className="space-y-2 mb-6">
          <div className="flex justify-between text-xs text-slate-600 font-medium">
            <span>Overall Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
            <div 
              className={`h-full transition-all duration-500 ${
                status === 'failed' ? 'bg-red-500' : 'bg-indigo-600'
              }`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Live Step Status */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-left">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Current Action
          </span>
          <p className="text-sm font-semibold text-slate-700 leading-snug break-words">
            {currentStep}
          </p>
        </div>

        {/* Failed Error Message Info */}
        {errorMsg && status === 'failed' && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start gap-2 text-left">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold mb-0.5">Details:</strong>
              <p>{errorMsg}</p>
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-center gap-4">
          {status === 'failed' && (
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-medium rounded-lg shadow-sm transition-colors"
            >
              Return Home
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
