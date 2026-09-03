import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AuthCard, AuthError, Field, SubmitButton } from './Login';

export default function ResetPassword() {
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState(''); const [updated, setUpdated] = useState(false); const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setError('');
    if (password !== confirm) return setError('Passwords do not match.');
    if (password.length < 8) return setError('Use at least 8 characters.');
    setLoading(true); const { error: updateError } = await supabase.auth.updateUser({ password }); setLoading(false);
    if (updateError) return setError(updateError.message); setUpdated(true);
  };
  return <AuthCard title="Choose a new password" subtitle="Enter a strong password for your account"><form onSubmit={submit} className="space-y-4">{error && <AuthError message={error} />}{updated && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Password updated successfully. <Link className="font-semibold" to="/">Continue to the application</Link>.</div>}<Field icon={LockKeyhole} label="New password" type="password" value={password} onChange={setPassword} autoComplete="new-password" /><Field icon={LockKeyhole} label="Confirm new password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" /><SubmitButton loading={loading}>Update password</SubmitButton></form></AuthCard>;
}
