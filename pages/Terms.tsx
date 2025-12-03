import React from 'react';

const Terms: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Terms of Service</h1>
      <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
        <p className="mb-4">Welcome to BanglaNote AI. By using our website, you agree to these terms.</p>
        
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-6 mb-3">1. Use of Service</h2>
        <p className="mb-4">
          You agree to use BanglaNote AI only for lawful purposes. You must not upload content that is illegal, harmful, 
          threatening, abusive, or otherwise objectionable.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-6 mb-3">2. Intellectual Property</h2>
        <p className="mb-4">
          The content you upload remains your property. However, by uploading, you grant us a temporary license to process 
          the content to provide the service.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-6 mb-3">3. Disclaimer of Warranties</h2>
        <p className="mb-4">
          The service is provided "as is" without any warranties. We do not guarantee the accuracy of the OCR or AI-generated text. 
          Users should verify important information.
        </p>
        
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-6 mb-3">4. Limitation of Liability</h2>
        <p className="mb-4">
          BanglaNote AI shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting 
          from your use of the service.
        </p>
      </div>
    </div>
  );
};

export default Terms;