import React from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext.jsx'

// Dynamic API URL resolution:
// 1. Explicit VITE_API_URL environment variable
// 2. Production Render deployment fallback (connect direct to pbi-qa-backend)
// 3. Local relative path (proxied by Vite)
const apiUrl = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com') ? 'https://pbi-qa-backend.onrender.com' : '');
if (apiUrl) {
  axios.defaults.baseURL = apiUrl;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><AuthProvider><App /></AuthProvider></React.StrictMode>,
)
