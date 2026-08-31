import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import PbixUpload from './pages/PbixUpload';
import ServiceTest from './pages/ServiceTest';
import JobStatus from './pages/JobStatus';
import ReportView from './pages/ReportView';
import History from './pages/History';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/upload-pbix" element={<PbixUpload />} />
            <Route path="/test-service" element={<ServiceTest />} />
            <Route path="/jobs/:jobId/status" element={<JobStatus />} />
            <Route path="/jobs/:jobId/report" element={<ReportView />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </main>
        <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4">
            &copy; {new Date().getFullYear()} PBI QA Suite. Built for automated report validation.
          </div>
        </footer>
      </div>
    </Router>
  );
}
