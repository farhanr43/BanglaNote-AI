import React from 'react';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-gray-800 dark:text-gray-200">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 sm:p-12">
        <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">Privacy Policy</h1>
        <p className="mb-8 text-sm text-gray-500">Last updated: {new Date().toLocaleDateString()}</p>
        
        <div className="space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3 text-teal-600">1. Information We Collect</h2>
            <p className="leading-relaxed mb-2">
              We collect information that you explicitly provide when using BanglaNote AI. This includes:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-gray-600 dark:text-gray-300">
              <li>Images uploaded for Optical Character Recognition (OCR).</li>
              <li>Text content generated, edited, or formatted within the application.</li>
              <li>Preferences such as theme settings (Light/Dark mode).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-teal-600">2. How We Use Your Information</h2>
            <p className="leading-relaxed mb-2">
              We use your information solely to provide the services offered by BanglaNote AI:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-gray-600 dark:text-gray-300">
              <li>To convert handwritten notes into digital text using AI.</li>
              <li>To perform text transformations like summarization, translation, and grammar correction.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-teal-600">3. Data Processing & AI</h2>
            <p className="leading-relaxed">
              This application utilizes Google's Gemini API for image and text processing. When you upload an image or submit text for transformation, that data is sent to Google's servers for processing. We do not permanently store your uploaded images or notes on our own servers; they are processed in real-time and returned to your browser.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-teal-600">4. Local Storage</h2>
            <p className="leading-relaxed">
              We use your browser's Local Storage to save your recent history and theme preferences locally on your device. This data never leaves your browser unless you choose to share it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-teal-600">5. Third-Party Links</h2>
            <p className="leading-relaxed">
              Our service may contain links to third-party websites. We are not responsible for the privacy practices or the content of these third-party sites.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-teal-600">6. Contact Us</h2>
            <p className="leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us via the link in the footer.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;