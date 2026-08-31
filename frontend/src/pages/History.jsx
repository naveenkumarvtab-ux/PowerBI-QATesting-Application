import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { 
  History as HistoryIcon, FileText, Download, Calendar, Loader2, PlayCircle, ShieldAlert 
} from 'lucide-react';

export default function History() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters
  const [methodFilter, setMethodFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const response = await axios.get('/api/jobs');
        setJobs(response.data);
      } catch (err) {
        console.error(err);
        setError("Failed to fetch historical test runs from API.");
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, []);

  const filteredJobs = jobs.filter(job => {
    const matchesMethod = methodFilter === 'all' || job.method === methodFilter;
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    return matchesMethod && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="text-sm text-slate-600 font-medium">Loading history logs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <HistoryIcon className="h-6 w-6 text-slate-500" />
            Testing History Logs
          </h1>
          <p className="text-slate-600 text-sm mt-0.5">
            Audit history tracking of previous local file parsing and live cloud test runs.
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1">
            <span className="text-[10px] font-bold text-slate-400 px-1 uppercase">Method</span>
            <button
              onClick={() => setMethodFilter('all')}
              className={`px-2 py-1 rounded-md transition-colors ${
                methodFilter === 'all' ? 'bg-slate-900 text-white font-medium' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setMethodFilter('pbix')}
              className={`px-2 py-1 rounded-md transition-colors ${
                methodFilter === 'pbix' ? 'bg-slate-900 text-white font-medium' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              PBIX
            </button>
            <button
              onClick={() => setMethodFilter('service')}
              className={`px-2 py-1 rounded-md transition-colors ${
                methodFilter === 'service' ? 'bg-slate-900 text-white font-medium' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Service
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1">
            <span className="text-[10px] font-bold text-slate-400 px-1 uppercase">Status</span>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-1 rounded-md transition-colors ${
                statusFilter === 'all' ? 'bg-slate-900 text-white font-medium' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('complete')}
              className={`px-2 py-1 rounded-md transition-colors ${
                statusFilter === 'complete' ? 'bg-slate-900 text-white font-medium' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Success
            </button>
            <button
              onClick={() => setStatusFilter('failed')}
              className={`px-2 py-1 rounded-md transition-colors ${
                statusFilter === 'failed' ? 'bg-slate-900 text-white font-medium' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Failed
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs">
          {error}
        </div>
      )}

      {/* History table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {filteredJobs.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <ShieldAlert className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-sm">No historical test runs found</p>
            <p className="text-xs text-slate-400 mt-1">Try running a new analysis from the homepage.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Job ID / Run Date</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4">Source Object</th>
                  <th className="px-6 py-4">Checks Run</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredJobs.map(job => (
                  <tr key={job.job_id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-medium">
                      <Link 
                        to={job.status === 'complete' ? `/jobs/${job.job_id}/report` : `/jobs/${job.job_id}/status`}
                        className="text-indigo-600 hover:underline font-bold font-mono block text-xs"
                      >
                        {job.job_id.substring(0, 8)}...
                      </Link>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(job.started_at).toLocaleString()}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 uppercase">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        job.method === 'pbix' ? 'bg-sky-50 text-sky-800 border border-sky-200' : 'bg-purple-50 text-purple-800 border border-purple-200'
                      }`}>
                        {job.method}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 max-w-xs">
                      <p className="truncate font-semibold text-slate-800" title={job.source}>
                        {job.source}
                      </p>
                    </td>
                    
                    <td className="px-6 py-4">
                      {job.status === 'complete' ? (
                        <div className="flex gap-1.5 text-[10px] font-bold">
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded">
                            {job.summary.passed} Pass
                          </span>
                          {job.summary.warnings > 0 && (
                            <span className="bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded">
                              {job.summary.warnings} Warn
                            </span>
                          )}
                          {job.summary.failed > 0 && (
                            <span className="bg-rose-50 text-rose-700 border border-rose-100 px-1.5 py-0.5 rounded">
                              {job.summary.failed} Fail
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider text-[9px] border ${
                        job.status === 'complete' && 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      } ${
                        job.status === 'running' && 'bg-indigo-50 text-indigo-800 border-indigo-300 animate-pulse'
                      } ${
                        job.status === 'queued' && 'bg-slate-50 text-slate-800 border-slate-300'
                      } ${
                        job.status === 'failed' && 'bg-rose-50 text-rose-800 border-rose-300'
                      }`}>
                        {job.status}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {job.status === 'complete' ? (
                          <>
                            <Link 
                              to={`/jobs/${job.job_id}/report`}
                              className="p-1 text-slate-500 hover:text-indigo-600 transition-colors"
                              title="View Report"
                            >
                              <FileText className="h-4 w-4" />
                            </Link>
                            <a
                              href={`/api/jobs/${job.job_id}/report.pdf`}
                              className="p-1 text-slate-500 hover:text-indigo-600 transition-colors"
                              title="Download PDF"
                              download
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </>
                        ) : (
                          <Link
                            to={`/jobs/${job.job_id}/status`}
                            className="p-1 text-slate-500 hover:text-indigo-600 animate-pulse"
                            title="Track Progress"
                          >
                            <PlayCircle className="h-4 w-4" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
