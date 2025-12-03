import React from 'react';

interface FooterProps {
  onNavigate: (view: 'HOME' | 'PRIVACY' | 'TERMS' | 'ADMIN') => void;
}

const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 mt-12">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex justify-center md:justify-start">
            <p className="text-base text-gray-500 dark:text-gray-400">
              &copy; {new Date().getFullYear()} BanglaNote AI. Powered by{' '}
              <a 
                href="https://www.facebook.com/farhan0043" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-teal-600 hover:text-teal-500 dark:text-teal-400 dark:hover:text-teal-300 font-medium"
              >
                Farhan Rahman
              </a>
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex justify-center space-x-6">
            <button 
              onClick={() => onNavigate('PRIVACY')}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
            >
              Privacy
            </button>
            <button 
              onClick={() => onNavigate('TERMS')}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
            >
              Terms
            </button>
            <button 
              onClick={() => onNavigate('ADMIN')}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
            >
              Admin
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;