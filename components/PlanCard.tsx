import React from 'react';
import { Plan } from '../types';
import Button from './Button';

export type RequestStatus = 'idle' | 'sending' | 'done' | 'error';

interface PlanCardProps {
  plan: Plan;
  isCurrent: boolean;
  status: RequestStatus;
  onSelect: (planId: string) => void;
}

const PlanCard: React.FC<PlanCardProps> = ({ plan, isCurrent, status, onSelect }) => {
  const isPopular = plan.id === 'standard';

  return (
    <div
      className={`hover-lift relative rounded-2xl border p-5 flex flex-col ${
        isPopular ? 'border-teal-500 ring-1 ring-teal-500' : 'border-gray-200 dark:border-gray-700'
      } ${isCurrent ? 'bg-teal-50/60 dark:bg-teal-900/20' : 'bg-white dark:bg-gray-800 hover:border-teal-400'}`}
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

      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {plan.dailyOcrLimit} OCR credits per day
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
        isLoading={status === 'sending'}
        onClick={() => onSelect(plan.id)}
      >
        {isCurrent
          ? 'Current plan'
          : status === 'done'
            ? 'Request sent ✓'
            : plan.priceBdt === 0
              ? 'Free'
              : 'Request upgrade'}
      </Button>
    </div>
  );
};

export default PlanCard;
