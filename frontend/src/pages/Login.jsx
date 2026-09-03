import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, LockKeyhole, Mail, TestTube } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (user) return <Navigate to="/" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) return setError(signInError.message);
    navigate(location.state?.from?.pathname || '/', { replace: true });
  };

  return <AuthCard title="Welcome back" subtitle="Sign in to continue to the Power BI QA Suite">
    <form onSubmit={submit} className="space-y-4">
      {error && <AuthError message={error} />}
      <Field icon={Mail} label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
      <Field icon={LockKeyhole} label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
      <div className="flex justify-end"><Link className="text-sm font-medium text-indigo-600 hover:text-indigo-700" to="/forgot-password">Forgot password?</Link></div>
      <SubmitButton loading={loading}>Sign in</SubmitButton>
      <p className="text-center text-sm text-slate-600">New here? <Link className="font-semibold text-indigo-600" to="/register">Create an account</Link></p>
    </form>
  </AuthCard>;
}

export function AuthCard({ title, subtitle, children }) {
  return <div className="min-h-screen bg-slate-100 grid place-items-center px-4 py-10">
    <div className="w-full max-w-md rounded-2xl bg-white p-7 sm:p-9 shadow-xl border border-slate-200">
      <div className="mb-7 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-slate-900"><TestTube className="h-6 w-6 text-indigo-400" /></div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
    </div>
  </div>;
}

export function Field({ icon: Icon, label, type, value, onChange, autoComplete }) {
  return <label className="block text-sm font-semibold text-slate-700">{label}
    <div className="relative mt-1.5"><Icon className="absolute left-3 top-3 h-5 w-5 text-slate-400" /><input required type={type} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></div>
  </label>;
}

export function SubmitButton({ loading, children }) {
  return <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin" />}{children}</button>;
}

export function AuthError({ message }) {
  return <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{message}</div>;
}
