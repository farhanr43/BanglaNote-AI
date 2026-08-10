import React from 'react';
import Button from './Button';
import AccountBar from './AccountBar';
import { AuthUser, UsageSummary } from '../types';

interface HeaderProps {
  toggleTheme: () => void;
  isDark: boolean;
  onLogoClick: () => void;
  onFeedbackClick: () => void;
  user: AuthUser | null;
  usage: UsageSummary | null;
  onLogin: () => void;
  onSignup: () => void;
  onLogout: () => void;
  onUpgrade: () => void;
}

const Header: React.FC<HeaderProps> = ({
  toggleTheme,
  isDark,
  onLogoClick,
  onFeedbackClick,
  user,
  usage,
  onLogin,
  onSignup,
  onLogout,
  onUpgrade,
}) => {
  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/70 dark:bg-gray-900/70 border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <a 
            href="/" 
            onClick={(e) => {
              e.preventDefault();
              onLogoClick();
            }}
            className="flex items-center space-x-2 transition-opacity hover:opacity-80"
          >
            <div className="bg-teal-600 p-1.5 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-teal-400">
              BanglaNote AI
            </span>
          </a>
          
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              onClick={onFeedbackClick}
              className="!px-3 text-sm hidden sm:inline-flex"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              }
            >
              Feedback
            </Button>
            
            {/* Mobile icon only button */}
            <button 
              onClick={onFeedbackClick}
              className="sm:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Feedback"
            >
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
               </svg>
            </button>

            <AccountBar
              user={user}
              usage={usage}
              onLogin={onLogin}
              onSignup={onSignup}
              onLogout={onLogout}
              onUpgrade={onUpgrade}
            />

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle Dark Mode"
            >
              {isDark ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;