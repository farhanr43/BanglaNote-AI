import React, { useEffect, useState } from 'react';
import { AuthUser, Plan, UsageSummary } from '../types';
import { PLANS } from '../constants';
import { requestUpgrade } from '../services/subscriptionService';
import Button from './Button';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser | null;
  usage: UsageSummary | null;
  onRequireLogin: () => void;
}

const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose, user, usage, onRequireLogin }) => {
  const [status, setStatus] = useState<Record<string, 'idle' | 'sending' | 'done' | 'error'>>({});
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
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700">
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

          <div className="px-6 pb-6 grid gap-4 md:grid-cols-3">
            {PLANS.map((plan: Plan) => {
              const isCurrent = currentPlanId === plan.id;
              const state = status[plan.id] ?? 'idle';
              const isPopular = plan.id === 'standard';

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl border p-5 flex flex-col ${
                    isPopular
                      ? 'border-teal-500 ring-1 ring-teal-500'
                      : 'border-gray-200 dark:border-gray-700'
                  } ${isCurrent ? 'bg-teal-50/60 dark:bg-teal-900/20' : 'bg-white dark:bg-gray-800'}`}
                >
                  {isPopular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-teal-600 text-white text-[11px] font-bold px-3 py-0.5 rounded-full">
                      MOST POPULAR
                    </span>
                  )}

                  <h4 className="text-lg font-bold text-gray-900 dark:text-white">{plan.name}</h4>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
                      {plan.priceBdt === 0 ? '৳0' : `৳${plan.priceBdt}`}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">/ month</span>
                  </div>

                  <ul className="mt-4 space-y-2 flex-1">
                    {plan.benefits.map((b) => (
                      <li key={b} className="flex items-start text-sm text-gray-600 dark:text-gray-300">
                        <svg className="w-4 h-4 text-teal-500 mt-0.5 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {b}
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant={isCurrent ? 'secondary' : 'primary'}
                    className="w-full mt-5"
                    disabled={isCurrent}
                    isLoading={state === 'sending'}
                    onClick={() => handleSubscribe(plan.id)}
                  >
                    {isCurrent
                      ? 'Current plan'
                      : state === 'done'
                        ? 'Request sent ✓'
                        : plan.priceBdt === 0
                          ? 'Free'
                          : 'Request upgrade'}
                  </Button>
                </div>
              );
            })}
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
