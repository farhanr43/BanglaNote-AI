import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
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
            <Link 
              to="/privacy"
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
            >
              Privacy
            </Link>
            <Link 
              to="/terms"
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
            >
              Terms
            </Link>
            <Link 
              to="/admin"
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
            >
              Admin
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;