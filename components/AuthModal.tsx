import React, { useEffect, useState } from 'react';
import Button from './Button';
import { authService } from '../services/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup';
  message?: string;
  onAuthenticated?: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  message,
  onAuthenticated,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError('');
      setInfo('');
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleGoogle = async () => {
    setError('');
    setInfo('');
    setIsGoogleLoading(true);
    const result = await authService.signInWithGoogle();
    if (!result.ok) {
      setError(result.error ?? 'Google sign-in failed. Please try again.');
      setIsGoogleLoading(false);
    }
    // On success the browser redirects to Google; no state change needed here.
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (!email.trim() || password.length < 6) {
      setError('Please enter a valid email and a password of at least 6 characters.');
      return;
    }

    if (mode === 'signup') {
      if (password !== confirm) {
        setError('Passwords do not match.');
        return;
      }
      setIsLoading(true);
      const result = await authService.signUp(email.trim(), password);
      setIsLoading(false);
      if (!result.ok) {
        setError(result.error ?? 'Sign up failed.');
        return;
      }
      if (result.needsEmailConfirmation) {
        setInfo('Account created! Check your email to confirm, then log in.');
        setMode('login');
        return;
      }
      onAuthenticated?.();
      onClose();
      return;
    }

    setIsLoading(true);
    const result = await authService.signIn(email.trim(), password);
    setIsLoading(false);
    if (!result.ok) {
      setError(result.error ?? 'Login failed.');
      return;
    }
    onAuthenticated?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={isLoading ? undefined : onClose} />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700">
          <div className="px-6 pt-6 pb-2">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                {mode === 'login' ? 'Welcome back' : 'Create a free account'}
              </h3>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {mode === 'login'
                ? 'Log in to continue with your daily OCR credits.'
                : 'Get 10 free OCR credits every day, forever.'}
            </p>
          </div>

          <div className="px-6 pb-6">
            {message && (
              <div className="mb-4 text-sm text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 rounded-lg p-3">
                {message}
              </div>
            )}

            {error && (
              <div className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                {error}
              </div>
            )}

            {info && (
              <div className="mb-4 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                {info}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <button
                type="button"
                onClick={handleGoogle}
                disabled={isGoogleLoading || isLoading}
                className="w-full inline-flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700/50 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGoogleLoading ? (
                  <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 010-4.2V7.06H2.18a11 11 0 000 9.88l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 002 7.06l3.84 2.84C6.71 7.3 9.14 5.38 12 5.38z"/>
                  </svg>
                )}
                {isGoogleLoading ? 'Redirecting to Google…' : 'Continue with Google'}
              </button>

              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                <span className="text-xs text-gray-400 dark:text-gray-500">or continue with email</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              </div>

              <div>
                <label htmlFor="auth-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white shadow-sm focus:border-teal-500 focus:ring-teal-500 p-2.5 disabled:opacity-50"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="auth-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password
                </label>
                <input
                  id="auth-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white shadow-sm focus:border-teal-500 focus:ring-teal-500 p-2.5 disabled:opacity-50"
                  placeholder="At least 6 characters"
                />
              </div>

              {mode === 'signup' && (
                <div>
                  <label htmlFor="auth-confirm" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Confirm password
                  </label>
                  <input
                    id="auth-confirm"
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    disabled={isLoading}
                    className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white shadow-sm focus:border-teal-500 focus:ring-teal-500 p-2.5 disabled:opacity-50"
                    placeholder="Repeat your password"
                  />
                </div>
              )}

              <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
                {mode === 'login' ? 'Log In' : 'Sign Up'}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
              {mode === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <button onClick={() => { setMode('signup'); setError(''); setInfo(''); }} className="text-teal-600 hover:underline font-medium">
                    Sign up free
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button onClick={() => { setMode('login'); setError(''); setInfo(''); }} className="text-teal-600 hover:underline font-medium">
                    Log in
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
