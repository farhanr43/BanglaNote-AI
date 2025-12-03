import React from 'react';

const Privacy: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Privacy Policy</h1>
      <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
        <p className="mb-4">Last updated: 2025-01-01</p>
        
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-6 mb-3">1. Information We Collect</h2>
        <p className="mb-4">
          BanglaNote AI processes images and documents you upload solely for the purpose of extracting and formatting text. 
          We do not permanently store your uploaded files on our servers. The files are processed in memory and sent to Google Gemini API for analysis.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-6 mb-3">2. How We Use Your Information</h2>
        <p className="mb-4">
          The text and images you provide are used strictly to provide the service requested (OCR, formatting, translation). 
          We do not use your content to train our own models or share it with third parties for marketing purposes.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-6 mb-3">3. Data Security</h2>
        <p className="mb-4">
          We implement appropriate technical measures to protect your data during transmission. Your data is processed securely 
          using industry-standard encryption protocols.
        </p>
        
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-6 mb-3">4. Third-Party Services</h2>
        <p className="mb-4">
          We use Google Gemini API for AI processing. Please refer to Google's Privacy Policy for information on how they handle data 
          submitted to their API services.
        </p>
      </div>
    </div>
  );
};

export default Privacy;