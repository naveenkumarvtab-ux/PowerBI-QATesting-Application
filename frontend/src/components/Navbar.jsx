import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TestTube, History, FileSpreadsheet } from 'lucide-react';

export default function Navbar() {
  const location = useLocation();
  
  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-slate-900 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 hover:opacity-95 transition-opacity">
              <TestTube className="h-6 w-6 text-indigo-400" />
              <span className="font-bold text-lg tracking-tight">PBI <span className="text-indigo-400">QA Suite</span></span>
            </Link>

            {/* Links */}
            <div className="flex items-center gap-1">
              <Link
                to="/"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  isActive('/') || isActive('/upload-pbix') || isActive('/test-service')
                    ? 'bg-slate-800 text-indigo-400'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <TestTube className="h-4 w-4" />
                New Test
              </Link>
              <Link
                to="/history"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  isActive('/history')
                    ? 'bg-slate-800 text-indigo-400'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <History className="h-4 w-4" />
                Job History
              </Link>
            </div>
          </div>
          
          <div className="flex items-center text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 font-mono">
            v1.0.0
          </div>
        </div>
      </div>
    </nav>
  );
}
