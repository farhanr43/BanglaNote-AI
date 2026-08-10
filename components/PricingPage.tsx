import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthUser, UsageSummary } from '../types';
import { PLANS } from '../constants';
import { requestUpgrade } from '../services/subscriptionService';
import PlanCard, { RequestStatus } from './PlanCard';

interface PricingPageProps {
  user: AuthUser | null;
  usage: UsageSummary | null;
  onRequireLogin: () => void;
}

const PricingPage: React.FC<PricingPageProps> = ({ user, usage, onRequireLogin }) => {
  const [status, setStatus] = useState<Record<string, RequestStatus>>({});
  const [error, setError] = useState('');

  const currentPlanId = usage?.planId ?? (user ? 'free' : 'guest');
  const isGuest = !user;

  const handleSelect = async (planId: string) => {
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
    <div className="max-w-5xl mx-auto">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-3">
          Simple, transparent pricing
        </h1>
        <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Start free. Every plan includes AI-powered OCR. Upgrade for more daily credits and
          editable DOCX export.
        </p>

        {!isGuest && usage && (
          <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 text-sm text-teal-700 dark:text-teal-300 font-medium">
            <span>Current plan:</span>
            <span className="font-bold">{usage.planName}</span>
            <span className="text-teal-600 dark:text-teal-400">·</span>
            <span>{usage.remaining} / {usage.limit} OCR credits left today</span>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-center">
          {error}
        </div>
      )}

      {/* Plans */}
        <div className="stagger grid gap-6 md:grid-cols-3 items-stretch">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isCurrent={currentPlanId === plan.id}
            status={status[plan.id] ?? 'idle'}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* Notes */}
      <div className="mt-10 space-y-4 text-sm text-gray-500 dark:text-gray-400 text-center">
        {isGuest ? (
          <p>
            You're browsing as a guest. Log in to start your free plan with{' '}
            <span className="font-semibold text-teal-600 dark:text-teal-400">10 OCR credits per day</span>.
          </p>
        ) : (
          <p>
            Subscriptions are activated manually after your request — you'll keep your current plan
            until then. Need a custom plan?{' '}
            <a
              href="https://www.facebook.com/farhan0043"
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-600 hover:underline"
            >
              Contact us
            </a>.
          </p>
        )}
        <p>
          All prices in Bangladeshi Taka (৳). Daily limits reset automatically at midnight.
        </p>
        <Link to="/" className="inline-block text-teal-600 hover:underline font-medium">
          ← Back to the app
        </Link>
      </div>
    </div>
  );
};

export default PricingPage;
