import React, { useEffect, useState } from 'react';
import { KeyRound, LockKeyhole, Mail, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AuthCard, AuthError, Field, SubmitButton } from './Login';

const RESEND_SECONDS = 60;

function SuccessMessage({ children }) {
  return <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{children}</div>;
}

export default function ForgotPassword() {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const sendOtp = async () => {
    setLoading(true);
    setError('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return false;
    }
    setCooldown(RESEND_SECONDS);
    return true;
  };

  const requestOtp = async (event) => {
    event.preventDefault();
    if (await sendOtp()) setStep('otp');
  };

  const verifyOtp = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: otp.trim(), type: 'recovery' });
    setLoading(false);
    if (verifyError) return setError('The OTP is incorrect or has expired. Request a new code and try again.');
    setStep('password');
  };

  const updatePassword = async (event) => {
    event.preventDefault();
    setError('');
    if (password !== confirm) return setError('Passwords do not match.');
    if (password.length < 8) return setError('Use at least 8 characters.');

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (!updateError) await supabase.auth.signOut();
    setLoading(false);
    if (updateError) return setError(updateError.message);
    setStep('success');
  };

  const title = step === 'email' ? 'Reset password' : step === 'otp' ? 'Verify your email' : step === 'password' ? 'Choose a new password' : 'Password updated';
  const subtitle = step === 'email' ? 'Receive a one-time password at your registered email' : step === 'otp' ? `Enter the code sent to ${email}` : step === 'password' ? 'Create a strong new password for your account' : 'Your account is ready to use again';

  return <AuthCard title={title} subtitle={subtitle}>
    {step === 'email' && <form onSubmit={requestOtp} className="space-y-4">
      {error && <AuthError message={error} />}
      <Field icon={Mail} label="Registered email" type="email" value={email} onChange={setEmail} autoComplete="email" />
      <SubmitButton loading={loading}>Send OTP</SubmitButton>
      <p className="text-center text-sm"><Link className="font-semibold text-indigo-600" to="/login">Back to sign in</Link></p>
    </form>}

    {step === 'otp' && <form onSubmit={verifyOtp} className="space-y-4">
      {error && <AuthError message={error} />}
      <SuccessMessage>A one-time password was sent. Check your inbox and spam folder.</SuccessMessage>
      <Field icon={KeyRound} label="One-time password" type="text" value={otp} onChange={(value) => setOtp(value.replace(/\D/g, ''))} autoComplete="one-time-code" inputMode="numeric" maxLength={8} />
      <SubmitButton loading={loading}>Verify OTP</SubmitButton>
      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={() => { setStep('email'); setOtp(''); setError(''); }} className="font-medium text-slate-600 hover:text-slate-900">Change email</button>
        <button type="button" disabled={cooldown > 0 || loading} onClick={sendOtp} className="flex items-center gap-1 font-semibold text-indigo-600 disabled:text-slate-400"><RotateCcw className="h-4 w-4" />{cooldown ? `Resend in ${cooldown}s` : 'Resend OTP'}</button>
      </div>
    </form>}

    {step === 'password' && <form onSubmit={updatePassword} className="space-y-4">
      {error && <AuthError message={error} />}
      <Field icon={LockKeyhole} label="New password" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
      <Field icon={LockKeyhole} label="Confirm new password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      <SubmitButton loading={loading}>Update password</SubmitButton>
    </form>}

    {step === 'success' && <div className="space-y-4">
      <SuccessMessage>Your password was changed successfully. You can now sign in with the new password.</SuccessMessage>
      <Link to="/login" className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700">Continue to sign in</Link>
    </div>}
  </AuthCard>;
}
