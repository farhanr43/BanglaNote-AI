import React, { useState } from 'react';
import Button from './Button';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, message: string) => Promise<void>;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && message.trim()) {
      setIsSubmitting(true);
      try {
        await onSubmit(name, message);
        
        // Show success state only after successful API call
        setIsSuccess(true);
        
        // Close after 2 seconds
        setTimeout(() => {
          onClose();
          // Reset state after transition
          setTimeout(() => {
            setIsSuccess(false);
            setIsSubmitting(false);
            setName('');
            setMessage('');
          }, 300);
        }, 2000);
      } catch (error) {
        console.error("Submission error", error);
        setIsSubmitting(false);
        // Error handling could be added here (e.g. show a toast)
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
        onClick={isSuccess || isSubmitting ? undefined : onClose}
      />

      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-gray-200 dark:border-gray-700">
          <div className="bg-white dark:bg-gray-800 px-4 pb-4 pt-5 sm:p-6 sm:pb-4 min-h-[300px] flex flex-col justify-center">
            
            {isSuccess ? (
              <div className="flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300 py-8">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mb-6">
                  <svg className="h-10 w-10 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Thank You!</h3>
                <p className="text-gray-500 dark:text-gray-400 text-center">
                  Your feedback has been submitted successfully.<br/>Returning to homepage...
                </p>
              </div>
            ) : (
              <>
                <h3 className="text-xl font-semibold leading-6 text-gray-900 dark:text-white mb-4" id="modal-title">
                  We value your feedback
                </h3>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm py-2 px-3 disabled:opacity-50"
                      placeholder="Your name"
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Feedback
                    </label>
                    <textarea
                      id="message"
                      required
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm py-2 px-3 resize-none disabled:opacity-50"
                      placeholder="Tell us what you think..."
                    />
                  </div>

                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full sm:col-start-2"
                      isLoading={isSubmitting}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Sending...' : 'Submit Feedback'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="mt-3 w-full sm:mt-0 sm:col-start-1"
                      onClick={onClose}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;