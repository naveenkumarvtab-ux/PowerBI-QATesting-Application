import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import LandingPage from './pages/LandingPage';
import PbixUpload from './pages/PbixUpload';
import ServiceTest from './pages/ServiceTest';
import JobStatus from './pages/JobStatus';
import ReportView from './pages/ReportView';
import History from './pages/History';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ProtectedRoute from './components/ProtectedRoute';

function ApplicationLayout() {
  return <ProtectedRoute><div className="min-h-screen bg-slate-50 flex flex-col font-sans w-full"><Navbar /><main className="flex-1 w-full"><Outlet /></main><footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 w-full"><div className="w-full px-4">&copy; {new Date().getFullYear()} PBI QA Suite. Built for automated report validation.</div></footer></div></ProtectedRoute>;
}

export default function App() {
  useEffect(() => {
    // Intercept Microsoft OAuth responses landing anywhere and forward to /test-service
    const search = window.location.search || '';
    if (search && (search.includes('code=') || search.includes('error='))) {
      if (!window.location.pathname.includes('/test-service')) {
        window.location.replace(window.location.origin + '/test-service' + search);
      }
    }
  }, []);
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<ApplicationLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/upload-pbix" element={<PbixUpload />} />
          <Route path="/test-service" element={<ServiceTest />} />
          <Route path="/jobs/:jobId/status" element={<JobStatus />} />
          <Route path="/jobs/:jobId/report" element={<ReportView />} />
          <Route path="/history" element={<History />} />
        </Route>
      </Routes>
    </Router>
  );
}
