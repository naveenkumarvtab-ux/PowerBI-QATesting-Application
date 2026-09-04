import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen grid place-items-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  }

  // Prevent OAuth redirect parameters from hitting login page
  const search = window.location.search || '';
  if (search.includes('code=') || search.includes('error=')) {
    return children;
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}
