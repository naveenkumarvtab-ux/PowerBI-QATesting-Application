import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AuthCard, AuthError, Field, SubmitButton } from './Login';

export default function ForgotPassword() {
  const [email, setEmail] = useState(''); const [error, setError] = useState(''); const [sent, setSent] = useState(false); const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setLoading(true); setError('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false); if (resetError) return setError(resetError.message); setSent(true);
  };
  return <AuthCard title="Reset password" subtitle="We’ll send a secure recovery link to your registered email">
    <form onSubmit={submit} className="space-y-4">{error && <AuthError message={error} />}{sent && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">If an account exists for this email, a reset link has been sent.</div>}<Field icon={Mail} label="Registered email" type="email" value={email} onChange={setEmail} autoComplete="email" /><SubmitButton loading={loading}>Send reset link</SubmitButton><p className="text-center text-sm"><Link className="font-semibold text-indigo-600" to="/login">Back to sign in</Link></p></form>
  </AuthCard>;
}
