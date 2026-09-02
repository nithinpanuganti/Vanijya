'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useLanguage } from '../../lib/language-context';
import { useToast } from '../../components/ui/toast';
import {
  LogIn,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  Lock,
  Phone,
  Building2,
  Sprout,
  ShieldAlert,
  AlertTriangle,
  Eye,
  EyeOff,
  UserPlus,
  Clock,
  XCircle,
} from 'lucide-react';

export default function UnifiedLoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, user } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [identifier, setIdentifier] = useState('9876543210');
  const [password, setPassword] = useState('Farmer@123');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'FARMER' | 'BUYER' | 'ADMIN'>('FARMER');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'GENERAL' | 'PENDING' | 'REJECTED'>('GENERAL');

  if (isAuthenticated && user) {
    return (
      <div className="max-w-md mx-auto bg-white p-6 md:p-8 rounded-3xl border border-amber-200 shadow-md text-center space-y-4 my-8 animate-in fade-in">
        <div className="w-14 h-14 bg-amber-100 text-amber-900 rounded-full flex items-center justify-center mx-auto">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900">{t.commonWelcomeBack}</h2>
        <p className="text-xs text-slate-600">
          <strong>{user.name}</strong> ({user.role})
        </p>
        <div className="pt-2">
          <Link
            href="/dashboard"
            className="block w-full bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black py-3 rounded-2xl text-xs transition shadow-md shadow-amber-500/20"
          >
            {t.navDashboard} ({user.role === 'FARMER' ? t.roleFarmer.split(' ')[0] : user.role === 'BUYER' ? t.roleBuyer.split(' ')[0] : t.roleAdmin.split(' ')[0]})
          </Link>
        </div>
      </div>
    );
  }

  const handleRoleSelect = (role: 'FARMER' | 'BUYER' | 'ADMIN') => {
    setSelectedRole(role);
    setErrorMessage(null);
    setErrorType('GENERAL');
    if (role === 'FARMER') {
      setIdentifier('9876543210');
      setPassword('Farmer@123');
    } else if (role === 'BUYER') {
      setIdentifier('buyer@freshcart.com');
      setPassword('asdfcv321');
    } else if (role === 'ADMIN') {
      setIdentifier('admin@vanijya.gov.in');
      setPassword('Admin@123');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!identifier.trim()) {
      setErrorMessage(t.errInvalidCredentials);
      setErrorType('GENERAL');
      return;
    }
    if (!password.trim()) {
      setErrorMessage(t.errInvalidCredentials);
      setErrorType('GENERAL');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setErrorType('GENERAL');

    try {
      const loggedInUser = await login(
        identifier.trim(),
        password,
        selectedRole,
      );
      showToast(`${t.commonWelcomeBack}, ${loggedInUser.name}!`, 'success');
      router.push('/dashboard');
    } catch (err: any) {
      const rawMsg = err.message || '';
      let msg = t.errInvalidCredentials;
      let type: 'GENERAL' | 'PENDING' | 'REJECTED' = 'GENERAL';

      if (rawMsg.toLowerCase().includes('awaiting admin approval') || rawMsg.toLowerCase().includes('pending')) {
        msg = t.errAccountPendingApproval;
        type = 'PENDING';
      } else if (rawMsg.toLowerCase().includes('rejected')) {
        msg = rawMsg;
        type = 'REJECTED';
      } else if (rawMsg.toLowerCase().includes('registered as') || rawMsg.toLowerCase().includes('account type')) {
        msg = rawMsg;
      }

      setErrorMessage(msg);
      setErrorType(type);
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoginDisabled = isSubmitting || !identifier.trim() || !password.trim();

  return (
    <div className="max-w-md mx-auto space-y-5 animate-in fade-in duration-300">
      <Link href="/" className="inline-flex items-center gap-1 text-xs text-amber-800 font-bold hover:underline">
        <ArrowLeft className="w-3.5 h-3.5" /> {t.navHome}
      </Link>

      {/* Top Toggle: Sign In vs Create Account */}
      <div className="bg-amber-100/70 p-1.5 rounded-2xl border border-amber-200 grid grid-cols-2 gap-1 text-xs font-bold">
        <button
          type="button"
          className="py-2 px-3 rounded-xl bg-white text-slate-900 shadow-sm flex items-center justify-center gap-1.5 font-black"
        >
          <LogIn className="w-3.5 h-3.5 text-amber-700" />
          {t.navLogin}
        </button>
        <Link
          href="/signup"
          className="py-2 px-3 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-white/60 transition flex items-center justify-center gap-1.5 text-center"
        >
          <UserPlus className="w-3.5 h-3.5 text-amber-700" />
          {t.btnCreateAccount}
        </Link>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-3xl border border-amber-200 shadow-md space-y-5">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 rounded-2xl flex items-center justify-center mx-auto mb-2 font-bold shadow-md shadow-amber-500/25">
            <LogIn className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{t.loginTitle}</h1>
          <p className="text-xs text-slate-500">{t.loginSubtitle}</p>
        </div>

        {/* Dynamic Error & Status Notices */}
        {errorMessage && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-medium space-y-1 ${
              errorType === 'PENDING'
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : errorType === 'REJECTED'
                ? 'bg-rose-50 border-rose-300 text-rose-950'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2 font-bold">
              {errorType === 'PENDING' ? (
                <Clock className="w-4 h-4 text-amber-700 shrink-0" />
              ) : errorType === 'REJECTED' ? (
                <XCircle className="w-4 h-4 text-rose-700 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>
                {errorType === 'PENDING'
                  ? t.pendingApprovalBadge
                  : errorType === 'REJECTED'
                  ? t.statusRejected
                  : 'Authentication Notice'}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed pl-6">{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 pt-1">
          {/* Mobile Number or Email */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-amber-700" />
              {t.phoneOrEmailLabel}
            </label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                setErrorMessage(null);
              }}
              placeholder={t.identifierPlaceholder}
              className="w-full px-3.5 py-2.5 bg-amber-50/40 border border-amber-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Password with Visibility Toggle */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-700" />
              {t.passwordLabel}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder={t.passwordPlaceholder}
                className="w-full px-3.5 py-2.5 pr-10 bg-amber-50/40 border border-amber-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={isLoginDisabled}
            className={`w-full font-black py-3.5 rounded-2xl text-sm transition transform flex items-center justify-center gap-2 shadow-md ${
              isLoginDisabled
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                : 'bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 shadow-amber-500/25 active:scale-95'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t.signingIn}
              </>
            ) : (
              t.btnSignIn
            )}
          </button>
        </form>

        {/* Create Account Link Banner */}
        <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200 text-center space-y-1.5">
          <span className="text-xs text-slate-600 block">New to Vanijya? Register your farm or enterprise:</span>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 text-xs font-black text-amber-900 hover:underline"
          >
            <UserPlus className="w-3.5 h-3.5" />
            {t.btnCreateAccount} &rarr;
          </Link>
        </div>

        {/* 1-Click Demo Personas */}
        <div className="pt-2 border-t border-amber-100 space-y-2">
          <label className="block text-[11px] font-bold text-slate-500 text-center">
            {t.chooseAccountTypeLabel}
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleRoleSelect('FARMER')}
              className={`p-2.5 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition ${
                selectedRole === 'FARMER'
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 border-amber-500 shadow-sm font-black'
                  : 'bg-amber-50/50 text-slate-700 border-amber-200 hover:bg-amber-100/50'
              }`}
            >
              <Sprout className="w-4 h-4" />
              <span>🌾 {t.roleFarmer.split(' ')[0]}</span>
            </button>

            <button
              type="button"
              onClick={() => handleRoleSelect('BUYER')}
              className={`p-2.5 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition ${
                selectedRole === 'BUYER'
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 border-amber-500 shadow-sm font-black'
                  : 'bg-amber-50/50 text-slate-700 border-amber-200 hover:bg-amber-100/50'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>🏢 {t.roleBuyer.split(' ')[0]}</span>
            </button>

            <button
              type="button"
              onClick={() => handleRoleSelect('ADMIN')}
              className={`p-2.5 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition ${
                selectedRole === 'ADMIN'
                  ? 'bg-slate-900 text-amber-400 border-slate-950 shadow-sm font-black'
                  : 'bg-amber-50/50 text-slate-700 border-amber-200 hover:bg-amber-100/50'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>⚙️ {t.roleAdmin.split(' ')[0]}</span>
            </button>
          </div>
        </div>

        <div className="pt-1 text-center text-[10px] text-slate-400">
          {t.tradeEnrolledNotice}
        </div>
      </div>
    </div>
  );
}
