import { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle, Check, Lock, GraduationCap, ArrowLeft, Mail, RefreshCw, ShieldCheck, KeyRound } from 'lucide-react';
import type { AppUser } from './mockData';
import {
  login, register, sendRegistrationOtp, verifyRegistrationOtp,
  sendPasswordResetOtp, resetPassword, ApiError,
} from '../../lib/api';
import logo from '../../imports/logo.png';
import { DepartmentSelect } from './DepartmentSelect';

const NAVY = '#1D3A5F';
const ACCENT = '#9CC7EE';

const LABEL_CLS = 'block text-xs font-semibold tracking-wider text-gray-500 uppercase mb-2';

interface LoginPageProps {
  onLogin: (user: AppUser) => void;
  onRegister: (user: AppUser) => void;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local[0] ?? '';
  const stars = '*'.repeat(Math.min(local.length - 1, 5));
  return `${visible}${stars}@${domain}`;
}

export function LoginPage({ onLogin, onRegister }: LoginPageProps) {
  const [view, setView] = useState<'login' | 'register' | 'forgot'>('login');

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-8"
      style={{ background: 'linear-gradient(135deg, #f7f3ea 0%, #f0ead9 50%, #e9e0c9 100%)' }}>
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden grid lg:grid-cols-2">
        {/* Left branding panel */}
        <div className="hidden lg:flex flex-col justify-between p-10 text-white relative overflow-hidden" style={{ backgroundColor: NAVY }}>
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }} />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full border border-white/10" />
          <div className="absolute -bottom-10 -right-10 w-44 h-44 rounded-full border border-white/10" />

          <div className="relative">
            <div className="flex items-center gap-3 mb-14">
              <img src={logo} alt="AUCA Logo" className="w-12 h-12 rounded-full bg-white p-0.5 object-cover" />
              <div>
                <p className="font-bold text-lg leading-tight">CaseFlow</p>
                <p className="text-white/50 text-xs">AUCA</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-5">
              <span className="w-4 h-px" style={{ backgroundColor: ACCENT }} />
              <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: ACCENT }}>Student Disciplinary Platform</p>
            </div>

            <h2 className="font-serif text-4xl leading-tight mb-5 text-white">
              Manage every case. Protect every outcome.
            </h2>
            <p className="text-white/60 text-sm leading-relaxed">
              A secure, transparent platform for managing the full lifecycle of student disciplinary cases — from incident reporting through committee review, decision, and re-integration.
            </p>
          </div>

          <div className="relative space-y-3">
            {[
              'Digital incident reporting with evidence tracking',
              'Online committee review and deliberation workspace',
              'Real-time case status visibility for students',
              'Automated registration enforcement and alerts',
              'Verifiable re-integration records',
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${ACCENT}26`, border: `1px solid ${ACCENT}66` }}>
                  <Check size={11} style={{ color: ACCENT }} />
                </span>
                <span className="text-white/60 text-sm">{f}</span>
              </div>
            ))}
            <p className="text-white/30 text-xs pt-4">© 2026 CaseFlow · Adventist University of Central Africa, Rwanda</p>
          </div>
        </div>

        {/* Right form panel */}
        <div className="flex flex-col overflow-y-auto bg-white">
          <div className="lg:hidden flex items-center gap-3 p-6 pb-0" style={{ color: NAVY }}>
            <img src={logo} alt="AUCA Logo" className="w-9 h-9 rounded-full bg-white border border-gray-200 object-cover" />
            <span className="font-bold text-base">CaseFlow</span>
          </div>
          <div className="flex-1 flex items-start sm:items-center justify-center p-6 sm:p-10 py-8">
            <div className="w-full max-w-md">
              {view === 'login' ? (
                <LoginForm onLogin={onLogin} onSwitchToRegister={() => setView('register')}
                  onForgotPassword={() => setView('forgot')} />
              ) : view === 'register' ? (
                <RegisterForm onRegister={onRegister} onSwitchToLogin={() => setView('login')} />
              ) : (
                <ForgotPasswordForm onReset={onLogin} onSwitchToLogin={() => setView('login')} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   LOGIN FORM
───────────────────────────────────────── */
function LoginForm({ onLogin, onSwitchToRegister, onForgotPassword }: {
  onLogin: (user: AppUser) => void;
  onSwitchToRegister: () => void;
  onForgotPassword: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(email.trim(), password, remember);
      onLogin(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-gray-900 mb-1.5" style={{ color: NAVY }}>Welcome back</h1>
        <p className="text-sm text-gray-500">Sign in to your CaseFlow account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 mb-6">
        <div>
          <label className={LABEL_CLS}>Email address</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input type="email" required value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              placeholder="you@auca.ac.rw"
              className="w-full border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none"
              onFocus={focusStyle} onBlur={blurStyle} />
          </div>
        </div>
        <div>
          <label className={LABEL_CLS}>Password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input type={showPassword ? 'text' : 'password'} required value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Enter your password"
              className="w-full border border-gray-300 rounded-xl pl-10 pr-11 py-2.5 text-sm focus:outline-none"
              onFocus={focusStyle} onBlur={blurStyle} />
            <button type="button" onClick={() => setShowPassword(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none w-fit">
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 accent-[#1D3A5F]" />
            Remember me
          </label>
          <button type="button" onClick={onForgotPassword}
            className="text-sm font-medium hover:opacity-80 transition-opacity" style={{ color: NAVY }}>
            Forgot password?
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle size={15} className="shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <button type="submit" disabled={busy} className="w-full text-white rounded-xl py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
          style={{ backgroundColor: NAVY }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mb-8">
        Are you a student?{' '}
        <button onClick={onSwitchToRegister} className="font-medium hover:opacity-80 transition-opacity" style={{ color: NAVY }}>
          Create a student account
        </button>
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────
   REGISTER FORM  (3-step OTP flow)
───────────────────────────────────────── */
type RegStep = 'details' | 'otp' | 'password';

interface Details { name: string; studentId: string; department: string; email: string; }

function RegisterForm({ onRegister, onSwitchToLogin }: {
  onRegister: (user: AppUser) => void;
  onSwitchToLogin: () => void;
}) {
  const [step, setStep] = useState<RegStep>('details');
  const [details, setDetails] = useState<Details>({ name: '', studentId: '', department: '', email: '' });
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [sendError, setSendError] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);

  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  // Countdown tick
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!details.name.trim()) errors.name = 'Full name is required.';
    if (!details.studentId.trim()) errors.studentId = 'Student ID is required.';
    if (!details.department.trim()) errors.department = 'Department is required.';
    if (!details.email.trim()) errors.email = 'Email is required.';
    setDetailErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSendError('');
    setSendingOtp(true);
    try {
      await sendRegistrationOtp(details.email.trim());
      setEnteredOtp('');
      setOtpError('');
      setCountdown(60);
      setStep('otp');
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : 'Unable to send a verification code. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleResend() {
    setOtpError('');
    setSendingOtp(true);
    try {
      await sendRegistrationOtp(details.email.trim());
      setEnteredOtp('');
      setCountdown(60);
    } catch (err) {
      setOtpError(err instanceof ApiError ? err.message : 'Unable to resend the code. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (enteredOtp.length < 6) { setOtpError('Please enter the complete 6-digit code.'); return; }
    setOtpError('');
    setVerifyingOtp(true);
    try {
      await verifyRegistrationOtp(details.email.trim(), enteredOtp);
      setStep('password');
    } catch (err) {
      setOtpError(err instanceof ApiError ? err.message : 'Incorrect code. Please check and try again.');
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');
    const errors: Record<string, string> = {};
    if (!password) errors.password = 'Password is required.';
    else if (password.length < 8) errors.password = 'Minimum 8 characters.';
    if (confirmPw !== password) errors.confirm = 'Passwords do not match.';
    setPwErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setCreating(true);
    try {
      const newUser = await register({
        name: details.name.trim(),
        studentId: details.studentId.trim(),
        department: details.department.trim(),
        email: details.email.trim(),
        password,
        otp: enteredOtp,
      });
      setSuccess(true);
      setTimeout(() => onRegister(newUser), 1200);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Unable to create your account. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  if (success) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#1D3A5F' }}>
          <CheckCircle size={30} className="text-white" />
        </div>
        <h2 className="text-xl text-gray-900 mb-2">Account created!</h2>
        <p className="text-sm text-gray-500">Signing you in now…</p>
      </div>
    );
  }

  const stepIndex = step === 'details' ? 0 : step === 'otp' ? 1 : 2;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-3xl mb-1.5" style={{ color: NAVY }}>Create Student Account</h1>
        <p className="text-sm text-gray-500">Students only · Staff accounts are issued by the Registrar</p>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-2 mb-8">
        {(['details', 'otp', 'password'] as RegStep[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
              i < stepIndex ? 'text-white' : i === stepIndex ? 'text-white' : 'bg-gray-200 text-gray-400'
            }`} style={i <= stepIndex ? { backgroundColor: '#1D3A5F' } : {}}>
              {i < stepIndex ? <CheckCircle size={14} /> : i + 1}
            </div>
            <span className={`text-xs hidden sm:block whitespace-nowrap ${i === stepIndex ? 'text-gray-700' : 'text-gray-400'}`}>
              {s === 'details' ? 'Your Details' : s === 'otp' ? 'Verify Email' : 'Set Password'}
            </span>
            {i < 2 && <div className={`flex-1 h-px ml-1 ${i < stepIndex ? 'bg-[#1D3A5F]' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* ── STEP 1: Details ── */}
      {step === 'details' && (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div className="flex items-center gap-2 bg-[#1D3A5F]/5 border border-[#1D3A5F]/20 rounded-xl px-4 py-2.5 mb-2">
            <GraduationCap size={15} className="text-[#1D3A5F] shrink-0" />
            <span className="text-sm text-[#1D3A5F]">Registering as: <strong>Student</strong></span>
          </div>

          <RegField label="Full Name" error={detailErrors.name}>
            <input type="text" value={details.name}
              onChange={e => { setDetails(d => ({ ...d, name: e.target.value })); setDetailErrors(p => ({ ...p, name: '' })); }}
              placeholder="e.g. Jean Bosco Habimana"
              className={inputCls(!!detailErrors.name)} onFocus={focusStyle} onBlur={blurStyle} />
          </RegField>

          <RegField label="Student ID" error={detailErrors.studentId}>
            <input type="text" value={details.studentId}
              onChange={e => { setDetails(d => ({ ...d, studentId: e.target.value })); setDetailErrors(p => ({ ...p, studentId: '' })); }}
              placeholder="e.g. 21045"
              className={inputCls(!!detailErrors.studentId)} onFocus={focusStyle} onBlur={blurStyle} />
          </RegField>

          <RegField label="Department" error={detailErrors.department}>
            <DepartmentSelect
              role="student"
              value={details.department}
              onChange={v => { setDetails(d => ({ ...d, department: v })); setDetailErrors(p => ({ ...p, department: '' })); }}
              placeholder="Select your programme…"
              className={inputCls(!!detailErrors.department)}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
          </RegField>

          <RegField label="Email Address" error={detailErrors.email}>
            <input type="email" value={details.email}
              onChange={e => { setDetails(d => ({ ...d, email: e.target.value })); setDetailErrors(p => ({ ...p, email: '' })); }}
              placeholder="you@student.auca.ac.rw"
              className={inputCls(!!detailErrors.email)} onFocus={focusStyle} onBlur={blurStyle} />
          </RegField>

          {sendError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={15} className="shrink-0" />
              <p className="text-sm">{sendError}</p>
            </div>
          )}

          <button type="submit" disabled={sendingOtp} className="w-full flex items-center justify-center gap-2 text-white rounded-xl py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity mt-2"
            style={{ backgroundColor: '#1D3A5F' }}>
            <Mail size={15} /> {sendingOtp ? 'Sending…' : 'Send Verification Code'}
          </button>

          <p className="text-center text-sm text-gray-500 pt-1">
            Already have an account?{' '}
            <button type="button" onClick={onSwitchToLogin} className="font-medium hover:opacity-80 transition-opacity" style={{ color: '#1D3A5F' }}>
              Sign in
            </button>
          </p>
        </form>
      )}

      {/* ── STEP 2: OTP ── */}
      {step === 'otp' && (
        <form onSubmit={handleVerifyOtp} className="space-y-5">
          <div className="text-center mb-2">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#1D3A5F' }}>
              <Mail size={24} className="text-white" />
            </div>
            <p className="text-sm text-gray-700">We sent a 6-digit code to</p>
            <p className="font-medium text-gray-900 mt-0.5">{maskEmail(details.email)}</p>
          </div>

          {/* OTP input boxes */}
          <div>
            <label className="block text-sm text-gray-700 mb-3 text-center">Enter verification code</label>
            <OtpBoxes value={enteredOtp} onChange={v => { setEnteredOtp(v); setOtpError(''); }} />
            {otpError && (
              <p className="text-xs text-red-600 mt-2 flex items-center justify-center gap-1">
                <AlertCircle size={11} /> {otpError}
              </p>
            )}
          </div>

          <button type="submit" disabled={verifyingOtp} className="w-full flex items-center justify-center gap-2 text-white rounded-xl py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
            style={{ backgroundColor: '#1D3A5F' }}>
            <ShieldCheck size={15} /> {verifyingOtp ? 'Verifying…' : 'Verify Code'}
          </button>

          {/* Resend */}
          <div className="text-center text-sm text-gray-500">
            {countdown > 0 ? (
              <span>Resend code in <span className="font-medium" style={{ color: '#1D3A5F' }}>{countdown}s</span></span>
            ) : (
              <button type="button" onClick={handleResend} disabled={sendingOtp}
                className="flex items-center gap-1.5 mx-auto font-medium hover:opacity-80 disabled:opacity-60 transition-opacity"
                style={{ color: '#1D3A5F' }}>
                <RefreshCw size={13} /> {sendingOtp ? 'Resending…' : 'Resend OTP'}
              </button>
            )}
          </div>

          <button type="button" onClick={() => setStep('details')}
            className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft size={14} /> Back
          </button>
        </form>
      )}

      {/* ── STEP 3: Password ── */}
      {step === 'password' && (
        <form onSubmit={handleCreateAccount} className="space-y-4">
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-2">
            <CheckCircle size={16} className="text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">Email verified</p>
              <p className="text-xs text-green-700">{details.email}</p>
            </div>
          </div>

          <p className="text-sm text-gray-600">Choose a secure password for your account.</p>

          <RegField label="New Password" error={pwErrors.password}>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={password}
                onChange={e => { setPassword(e.target.value); setPwErrors(p => ({ ...p, password: '' })); }}
                placeholder="Minimum 8 characters"
                className={inputCls(!!pwErrors.password) + ' pr-11'} onFocus={focusStyle} onBlur={blurStyle} />
              <button type="button" onClick={() => setShowPw(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {password.length >= 8 && !pwErrors.password && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle size={11} /> Strong password</p>
            )}
          </RegField>

          <RegField label="Confirm Password" error={pwErrors.confirm}>
            <div className="relative">
              <input type={showConfirm ? 'text' : 'password'} value={confirmPw}
                onChange={e => { setConfirmPw(e.target.value); setPwErrors(p => ({ ...p, confirm: '' })); }}
                placeholder="Re-enter your password"
                className={inputCls(!!pwErrors.confirm) + ' pr-11'} onFocus={focusStyle} onBlur={blurStyle} />
              <button type="button" onClick={() => setShowConfirm(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </RegField>

          {createError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={15} className="shrink-0" />
              <p className="text-sm">{createError}</p>
            </div>
          )}

          <button type="submit" disabled={creating} className="w-full text-white rounded-xl py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity mt-2"
            style={{ backgroundColor: '#1D3A5F' }}>
            {creating ? 'Creating Account…' : 'Create Account'}
          </button>

          <button type="button" onClick={() => setStep('otp')}
            className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft size={14} /> Back
          </button>
        </form>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   FORGOT PASSWORD FORM  (2-step OTP flow)
───────────────────────────────────────── */
function ForgotPasswordForm({ onReset, onSwitchToLogin }: {
  onReset: (user: AppUser) => void;
  onSwitchToLogin: () => void;
}) {
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);

  const [enteredOtp, setEnteredOtp] = useState('');
  const [countdown, setCountdown] = useState(0);

  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetErrors, setResetErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setEmailError('Email is required.'); return; }
    setEmailError('');
    setSendingOtp(true);
    try {
      await sendPasswordResetOtp(email.trim());
      setEnteredOtp('');
      setResetErrors({});
      setCountdown(60);
      setStep('reset');
    } catch (err) {
      setEmailError(err instanceof ApiError ? err.message : 'Unable to send a reset code. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleResend() {
    setResetErrors(p => ({ ...p, otp: '' }));
    setSendingOtp(true);
    try {
      await sendPasswordResetOtp(email.trim());
      setEnteredOtp('');
      setCountdown(60);
    } catch (err) {
      setResetErrors(p => ({ ...p, otp: err instanceof ApiError ? err.message : 'Unable to resend the code. Please try again.' }));
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (enteredOtp.length < 6) errors.otp = 'Please enter the complete 6-digit code.';
    if (!password) errors.password = 'Password is required.';
    else if (password.length < 8) errors.password = 'Minimum 8 characters.';
    if (confirmPw !== password) errors.confirm = 'Passwords do not match.';
    setResetErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setResetting(true);
    try {
      const user = await resetPassword(email.trim(), enteredOtp, password);
      setSuccess(true);
      setTimeout(() => onReset(user), 1200);
    } catch (err) {
      setResetErrors({ otp: err instanceof ApiError ? err.message : 'Unable to reset your password. Please try again.' });
    } finally {
      setResetting(false);
    }
  }

  if (success) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#1D3A5F' }}>
          <CheckCircle size={30} className="text-white" />
        </div>
        <h2 className="text-xl text-gray-900 mb-2">Password reset!</h2>
        <p className="text-sm text-gray-500">Signing you in now…</p>
      </div>
    );
  }

  if (step === 'request') {
    return (
      <div>
        <div className="mb-8">
          <h1 className="font-serif text-3xl text-gray-900 mb-1.5" style={{ color: NAVY }}>Reset your password</h1>
          <p className="text-sm text-gray-500">Enter your account email and we'll send you a reset code.</p>
        </div>

        <form onSubmit={handleSendOtp} className="space-y-4">
          <RegField label="Email Address" error={emailError}>
            <input type="email" value={email}
              onChange={e => { setEmail(e.target.value); setEmailError(''); }}
              placeholder="you@auca.ac.rw"
              className={inputCls(!!emailError)} onFocus={focusStyle} onBlur={blurStyle} />
          </RegField>

          <button type="submit" disabled={sendingOtp} className="w-full flex items-center justify-center gap-2 text-white rounded-xl py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity mt-2"
            style={{ backgroundColor: '#1D3A5F' }}>
            <Mail size={15} /> {sendingOtp ? 'Sending…' : 'Send Reset Code'}
          </button>

          <button type="button" onClick={onSwitchToLogin}
            className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors pt-1">
            <ArrowLeft size={14} /> Back to sign in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-3xl mb-1.5" style={{ color: NAVY }}>Reset your password</h1>
      </div>

      <form onSubmit={handleResetPassword} className="space-y-5">
        <div className="text-center mb-2">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#1D3A5F' }}>
            <KeyRound size={24} className="text-white" />
          </div>
          <p className="text-sm text-gray-700">We sent a 6-digit code to</p>
          <p className="font-medium text-gray-900 mt-0.5">{maskEmail(email)}</p>
        </div>

        <div>
          <label className="block text-sm text-gray-700 mb-3 text-center">Enter verification code</label>
          <OtpBoxes value={enteredOtp} onChange={v => { setEnteredOtp(v); setResetErrors(p => ({ ...p, otp: '' })); }} />
          {resetErrors.otp && (
            <p className="text-xs text-red-600 mt-2 flex items-center justify-center gap-1">
              <AlertCircle size={11} /> {resetErrors.otp}
            </p>
          )}
        </div>

        <RegField label="New Password" error={resetErrors.password}>
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} value={password}
              onChange={e => { setPassword(e.target.value); setResetErrors(p => ({ ...p, password: '' })); }}
              placeholder="Minimum 8 characters"
              className={inputCls(!!resetErrors.password) + ' pr-11'} onFocus={focusStyle} onBlur={blurStyle} />
            <button type="button" onClick={() => setShowPw(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </RegField>

        <RegField label="Confirm Password" error={resetErrors.confirm}>
          <div className="relative">
            <input type={showConfirm ? 'text' : 'password'} value={confirmPw}
              onChange={e => { setConfirmPw(e.target.value); setResetErrors(p => ({ ...p, confirm: '' })); }}
              placeholder="Re-enter your password"
              className={inputCls(!!resetErrors.confirm) + ' pr-11'} onFocus={focusStyle} onBlur={blurStyle} />
            <button type="button" onClick={() => setShowConfirm(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </RegField>

        <button type="submit" disabled={resetting} className="w-full text-white rounded-xl py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
          style={{ backgroundColor: '#1D3A5F' }}>
          {resetting ? 'Resetting…' : 'Reset Password'}
        </button>

        <div className="text-center text-sm text-gray-500">
          {countdown > 0 ? (
            <span>Resend code in <span className="font-medium" style={{ color: '#1D3A5F' }}>{countdown}s</span></span>
          ) : (
            <button type="button" onClick={handleResend} disabled={sendingOtp}
              className="flex items-center gap-1.5 mx-auto font-medium hover:opacity-80 disabled:opacity-60 transition-opacity"
              style={{ color: '#1D3A5F' }}>
              <RefreshCw size={13} /> {sendingOtp ? 'Resending…' : 'Resend Code'}
            </button>
          )}
        </div>

        <button type="button" onClick={() => setStep('request')}
          className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft size={14} /> Back
        </button>
      </form>
    </div>
  );
}

/* ─────────────────────────────────────────
   OTP BOXES COMPONENT
───────────────────────────────────────── */
function OtpBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');

  function handleChange(i: number, ch: string) {
    if (!/^\d*$/.test(ch)) return;
    const next = [...digits];
    next[i] = ch.slice(-1);
    onChange(next.join(''));
    if (ch && i < 5) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (!digits[i] && i > 0) {
        refs.current[i - 1]?.focus();
      } else {
        const next = [...digits];
        next[i] = '';
        onChange(next.join(''));
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < 5) {
      refs.current[i + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted.padEnd(6, '').slice(0, 6).replace(/\s/g, ''));
    const focusIdx = Math.min(pasted.length, 5);
    setTimeout(() => refs.current[focusIdx]?.focus(), 0);
    e.preventDefault();
  }

  return (
    <div className="flex gap-2 sm:gap-3 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => refs.current[i] = el}
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={d}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={e => e.currentTarget.select()}
          className={`w-10 h-12 sm:w-12 sm:h-14 text-center border-2 rounded-xl text-lg font-mono font-bold focus:outline-none transition-all ${
            d ? 'border-[#1D3A5F] bg-[#1D3A5F]/5 text-[#1D3A5F]' : 'border-gray-300 text-gray-700'
          }`}
          style={{ boxShadow: d ? '0 0 0 0px transparent' : undefined }}
          onFocusCapture={e => { e.currentTarget.style.borderColor = '#1D3A5F'; e.currentTarget.style.boxShadow = '0 0 0 2px #1D3A5F30'; }}
          onBlurCapture={e => { if (!e.currentTarget.value) { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; } }}
        />
      ))}
    </div>
  );
}

/* ── shared helpers ── */
function RegField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={LABEL_CLS}>{label}</label>
      {children}
      {error && (
        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
          <AlertCircle size={11} className="shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}

function inputCls(hasError: boolean) {
  return `w-full border ${hasError ? 'border-red-400 bg-red-50' : 'border-gray-300'} rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors`;
}

// Generic over the element type so the same handlers work on <input> and <select>.
function focusStyle(e: React.FocusEvent<HTMLElement>) {
  e.currentTarget.style.boxShadow = '0 0 0 2px #1D3A5F40';
  e.currentTarget.style.borderColor = '#1D3A5F';
}

function blurStyle(e: React.FocusEvent<HTMLElement>) {
  e.currentTarget.style.boxShadow = '';
  e.currentTarget.style.borderColor = '';
}
