import React from 'react';

const TermsOfService: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-gray-800 dark:text-gray-200">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 sm:p-12">
        <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">Terms of Service</h1>
        <p className="mb-8 text-sm text-gray-500">Last updated: {new Date().toLocaleDateString()}</p>
        
        <div className="space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3 text-teal-600">1. Acceptance of Terms</h2>
            <p className="leading-relaxed">
              By accessing and using BanglaNote AI, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by these terms, please do not use this service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-teal-600">2. Use of Service</h2>
            <p className="leading-relaxed mb-2">
              You agree to use BanglaNote AI only for lawful purposes. You are prohibited from:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-gray-600 dark:text-gray-300">
              <li>Uploading content that is illegal, harmful, threatening, or abusive.</li>
              <li>Attempting to interfere with the proper working of the API or application.</li>
              <li>Reverse engineering or attempting to extract the source code of the application.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-teal-600">3. AI Generated Content</h2>
            <p className="leading-relaxed">
              The text generation and OCR features are powered by Artificial Intelligence. While we strive for accuracy, AI models can make mistakes. We do not guarantee 100% accuracy of the extracted text, translations, or summaries. You should verify important information independently.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-teal-600">4. Intellectual Property</h2>
            <p className="leading-relaxed">
              The content you upload remains yours. However, by using the service, you grant us the right to process that content to provide the service to you. The interface, graphics, and code of BanglaNote AI are the property of the developers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-teal-600">5. Limitation of Liability</h2>
            <p className="leading-relaxed">
              In no event shall BanglaNote AI or its developers be liable for any direct, indirect, incidental, special, or consequential damages arising out of the use or inability to use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-teal-600">6. Changes to Terms</h2>
            <p className="leading-relaxed">
              We reserve the right to modify these terms at any time. Your continued use of the service after any such changes constitutes your acceptance of the new Terms of Service.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;