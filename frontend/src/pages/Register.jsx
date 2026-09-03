import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { LockKeyhole, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AuthCard, AuthError, Field, SubmitButton } from './Login';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;

  const submit = async (event) => {
    event.preventDefault(); setError(''); setMessage('');
    if (password !== confirm) return setError('Passwords do not match.');
    if (password.length < 8) return setError('Use at least 8 characters.');
    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/login` } });
    setLoading(false);
    if (signUpError) return setError(signUpError.message);
    setMessage(data.session ? 'Account created. You can now use the application.' : 'Account created. Check your email to confirm your account.');
  };

  return <AuthCard title="Create account" subtitle="Register securely with your work email">
    <form onSubmit={submit} className="space-y-4">
      {error && <AuthError message={error} />}{message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}
      <Field icon={Mail} label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
      <Field icon={LockKeyhole} label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
      <Field icon={LockKeyhole} label="Confirm password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      <SubmitButton loading={loading}>Create account</SubmitButton>
      <p className="text-center text-sm text-slate-600">Already registered? <Link className="font-semibold text-indigo-600" to="/login">Sign in</Link></p>
    </form>
  </AuthCard>;
}
