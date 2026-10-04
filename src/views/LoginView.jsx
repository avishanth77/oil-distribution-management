import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';

export default function LoginView() {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email, password });
    } catch (err) {
      setErrorMsg(err.message || 'Invalid email or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center items-center py-12 px-4 sm:px-6 font-body-md text-on-surface">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-11 h-11 rounded-lg bg-primary flex items-center justify-center text-amber-400 mb-3 shadow-sm">
            <span className="material-symbols-outlined text-[24px]">local_gas_station</span>
          </div>
          <h1 className="font-headline-sm text-2xl font-bold text-primary tracking-tight">
            PETRO<span className="text-secondary font-normal">FLOW</span>
          </h1>
          <p className="text-[12px] text-secondary font-medium mt-0.5">
            Oil Distribution Management System
          </p>
        </div>

        {/* Login Card */}
        <div className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm p-6 sm:p-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[18px] font-bold text-on-surface font-headline-sm">
                Sign In
              </h2>
              <p className="text-[12px] text-on-surface-variant mt-0.5">
                Enter your account credentials to continue
              </p>
            </div>

            {/* Live Database status pill */}
            {isSupabaseConfigured ? (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-label-code text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                <span>Live DB</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-label-code text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                <span>Offline</span>
              </div>
            )}
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[12px] flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0 mt-0.5">error</span>
              <span className="leading-snug">{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="font-title-md text-[12px] font-semibold text-on-surface mb-1.5 block">
                Email Address
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-[18px] text-secondary pointer-events-none">
                  mail
                </span>
                <input
                  type="email"
                  required
                  autoComplete="username"
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@texol.com"
                  className="w-full bg-surface-container-lowest border border-outline-variant/40 focus:border-primary focus:ring-1 focus:ring-primary rounded pl-9 pr-3 py-2 text-[13px] text-on-surface placeholder:text-outline/60 outline-none transition-colors"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="font-title-md text-[12px] font-semibold text-on-surface mb-1.5 block">
                Password
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-[18px] text-secondary pointer-events-none">
                  lock
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  maxLength={200}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-surface-container-lowest border border-outline-variant/40 focus:border-primary focus:ring-1 focus:ring-primary rounded pl-9 pr-10 py-2 text-[13px] text-on-surface placeholder:text-outline/60 outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 p-1 text-secondary hover:text-on-surface transition-colors cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center text-[12px] pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer text-on-surface-variant">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-outline-variant text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                />
                <span>Remember me</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-2.5 px-4 bg-primary text-on-primary hover:bg-primary-container transition-colors rounded text-body-sm font-semibold shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">login</span>
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
