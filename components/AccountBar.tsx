import React, { useState } from 'react';
import { AuthUser, UsageSummary } from '../types';
import { GUEST_OCR_LIMIT } from '../constants';

interface AccountBarProps {
  user: AuthUser | null;
  usage: UsageSummary | null;
  onLogin: () => void;
  onSignup: () => void;
  onLogout: () => void;
  onUpgrade: () => void;
}

const CreditPill: React.FC<{ label: string; accent?: boolean }> = ({
  label,
  accent,
}) => (
  <span
    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap ${
      accent
        ? 'bg-teal-600 text-white'
        : 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
    }`}
  >
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
    {label}
  </span>
);

const AccountBar: React.FC<AccountBarProps> = ({
  user,
  usage,
  onLogin,
  onSignup,
  onLogout,
  onUpgrade,
}) => {
  const [open, setOpen] = useState(false);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        {usage && usage.isGuest && (
          <span className="hidden md:inline-flex">
            <CreditPill
              label={`${usage.remaining} / ${GUEST_OCR_LIMIT} free OCR left`}
            />
          </span>
        )}
        <button
          onClick={onLogin}
          className="hidden sm:inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          Log In
        </button>
        <button
          onClick={onSignup}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
        >
          Sign Up
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-teal-600 text-white flex items-center justify-center text-sm font-bold">
          {(user.email || 'U').charAt(0).toUpperCase()}
        </div>
        <div className="hidden sm:block text-left">
          <div className="text-xs font-semibold text-gray-900 dark:text-white leading-tight">
            {usage ? `${usage.planName} Plan` : 'Account'}
          </div>
          <div className="text-[11px] text-teal-600 dark:text-teal-400 leading-tight">
            {usage ? `${usage.remaining} / ${usage.limit} OCR today` : 'Loading credits…'}
          </div>
        </div>
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 z-40 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user.email}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {usage ? `${usage.remaining} of ${usage.limit} OCR credits remaining today` : 'Loading credits…'}
              </p>
            </div>

            {usage && (
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                  <span>Daily usage</span>
                  <span>{usage.used} / {usage.limit}</span>
                </div>
                <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-500 rounded-full transition-all"
                    style={{ width: `${usage.limit > 0 ? Math.min((usage.used / usage.limit) * 100, 100) : 0}%` }}
                  />
                </div>
              </div>
            )}

            <div className="p-2">
              <button
                onClick={() => { setOpen(false); onUpgrade(); }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-teal-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Upgrade plan
              </button>
              <button
                onClick={() => { setOpen(false); onLogout(); }}
                className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Log out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AccountBar;
