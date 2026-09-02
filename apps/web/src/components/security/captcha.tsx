'use client';

import React, { useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { api } from '../../lib/api';
import { useLanguage } from '../../lib/language-context';
import { RotateCw, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';

export interface CaptchaHandle {
  refresh: () => void;
  resetInput: () => void;
}

interface CaptchaProps {
  onCaptchaChange: (data: { captchaId: string; captchaAnswer: string }) => void;
  error?: string | null;
  disabled?: boolean;
}

export type CaptchaStatus = 'IDLE' | 'LOADING' | 'LOADED' | 'FAILED' | 'EXPIRED';

export const Captcha = forwardRef<CaptchaHandle, CaptchaProps>(function Captcha(
  { onCaptchaChange, error, disabled = false },
  ref,
) {
  const { t } = useLanguage();
  const [captchaId, setCaptchaId] = useState<string>('');
  const [captchaImage, setCaptchaImage] = useState<string>('');
  const [captchaAnswer, setCaptchaAnswer] = useState<string>('');
  const [status, setStatus] = useState<CaptchaStatus>('LOADING');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchCaptcha = useCallback(async () => {
    setStatus('LOADING');
    setErrorMessage(null);
    setCaptchaAnswer('');
    onCaptchaChange({ captchaId: '', captchaAnswer: '' });

    try {
      const res = await api.get<{ captchaId: string; image: string; expiresIn: number }>(
        '/auth/captcha',
        { timeoutMs: 8000 },
      );

      if (res && res.captchaId && res.image) {
        setCaptchaId(res.captchaId);
        setCaptchaImage(res.image);
        setStatus('LOADED');
      } else {
        throw new Error('Invalid CAPTCHA payload');
      }
    } catch (err: any) {
      setStatus('FAILED');
      setErrorMessage(
        'Unable to load security verification. Please check the server connection and try again.',
      );
    }
  }, [onCaptchaChange]);

  useImperativeHandle(ref, () => ({
    refresh: () => {
      fetchCaptcha();
    },
    resetInput: () => {
      setCaptchaAnswer('');
      onCaptchaChange({ captchaId, captchaAnswer: '' });
    },
  }));

  useEffect(() => {
    fetchCaptcha();
  }, [fetchCaptcha]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setCaptchaAnswer(val);
    onCaptchaChange({ captchaId, captchaAnswer: val });
  };

  const isLoading = status === 'LOADING';
  const isFailed = status === 'FAILED';

  return (
    <div className="space-y-3 pt-1">
      {/* CAPTCHA Display Card */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
            {t.securityVerification}
          </span>
          <span className="text-[10px] text-slate-400 font-normal">
            {isFailed ? 'Server Connection Required' : t.securityCodeCaseNotice}
          </span>
        </label>

        <div className="flex items-center gap-2 p-2 bg-amber-50/70 border border-amber-200 rounded-2xl">
          {/* Visual Distorted Image Container */}
          <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-amber-300/80 p-1.5 min-h-[64px] shadow-inner overflow-hidden select-none">
            {isLoading ? (
              <div className="flex items-center gap-2 text-xs text-amber-800 font-bold animate-pulse">
                <RotateCw className="w-4 h-4 animate-spin text-amber-600" />
                <span>Loading security verification...</span>
              </div>
            ) : isFailed ? (
              <div className="text-center p-2 space-y-1.5">
                <div className="text-[11px] text-rose-700 font-bold flex items-center justify-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Security verification could not be loaded.</span>
                </div>
                <button
                  type="button"
                  onClick={fetchCaptcha}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-black rounded-lg border border-amber-300 transition shadow-sm"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry CAPTCHA</span>
                </button>
              </div>
            ) : (
              <img
                src={captchaImage}
                alt={t.securityVerification}
                className="max-h-12 w-auto object-contain select-none pointer-events-none rounded-lg"
                draggable={false}
              />
            )}
          </div>

          {/* Refresh Button */}
          {!isFailed && (
            <button
              type="button"
              onClick={fetchCaptcha}
              disabled={isLoading || disabled}
              title={t.refreshSecurityCode}
              aria-label={t.refreshSecurityCode}
              className="p-3 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 text-amber-950 font-black rounded-xl border border-amber-300 shadow-sm transition transform active:scale-95 flex items-center justify-center shrink-0 disabled:opacity-50"
            >
              <RotateCw className={`w-5 h-5 text-amber-900 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Answer Input */}
      <div>
        <label htmlFor="captcha-input" className="block text-xs font-bold text-slate-700 mb-1">
          {t.enterCharactersAbove}
        </label>
        <input
          id="captcha-input"
          type="text"
          required
          maxLength={6}
          disabled={disabled || isLoading || isFailed}
          value={captchaAnswer}
          onChange={handleInputChange}
          placeholder={isFailed ? 'Server unavailable' : t.captchaInputPlaceholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck="false"
          className="w-full px-3.5 py-2.5 bg-amber-50/40 border border-amber-300 rounded-xl text-base font-black tracking-widest font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase placeholder:text-slate-400 placeholder:tracking-normal placeholder:font-sans placeholder:text-xs placeholder:font-normal disabled:bg-slate-100 disabled:text-slate-400"
        />
      </div>

      {(error || errorMessage) && (
        <p className="text-[11px] text-rose-600 font-bold flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{error || errorMessage}</span>
        </p>
      )}
    </div>
  );
});
