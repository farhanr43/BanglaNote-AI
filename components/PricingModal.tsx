import React, { useEffect, useState } from 'react';
import { AuthUser, UsageSummary } from '../types';
import { PLANS } from '../constants';
import { requestUpgrade } from '../services/subscriptionService';
import PlanCard, { RequestStatus } from './PlanCard';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser | null;
  usage: UsageSummary | null;
  onRequireLogin: () => void;
}

const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose, user, usage, onRequireLogin }) => {
  const [status, setStatus] = useState<Record<string, RequestStatus>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStatus({});
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentPlanId = usage?.planId ?? (user ? 'free' : 'guest');

  const handleSubscribe = async (planId: string) => {
    if (!user) {
      onRequireLogin();
      return;
    }
    if (currentPlanId === planId) return;

    setError('');
    setStatus((s) => ({ ...s, [planId]: 'sending' }));
    const result = await requestUpgrade(planId);
    if (!result.ok) {
      setError(result.error ?? 'Failed to request upgrade.');
      setStatus((s) => ({ ...s, [planId]: 'error' }));
      return;
    }
    setStatus((s) => ({ ...s, [planId]: 'done' }));
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 animate-scale-in">
          <div className="px-6 pt-6 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Choose your plan</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                More daily OCR credits, editable DOCX export, and layout-aware previews.
              </p>
            </div>
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

          {error && (
            <div className="mx-6 mb-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              {error}
            </div>
          )}

          <div className="px-6 pb-6 grid gap-4 md:grid-cols-3 stagger">
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isCurrent={currentPlanId === plan.id}
                status={status[plan.id] ?? 'idle'}
                onSelect={handleSubscribe}
              />
            ))}
          </div>

          {user && (
            <div className="px-6 pb-5 text-center text-xs text-gray-500 dark:text-gray-400">
              Subscriptions are activated manually after your request. You'll keep your current plan
              until then.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PricingModal;
