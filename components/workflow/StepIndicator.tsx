import React from 'react';
import { WorkflowStep } from '../../types';

interface StepIndicatorProps {
  currentStep: WorkflowStep;
  hasResult: boolean;
}

const steps: { id: WorkflowStep; label: string; sub: string }[] = [
  { id: 1, label: 'OCR', sub: 'Image to Text' },
  { id: 2, label: 'Format Analysis', sub: 'Structure & Refinement' },
  { id: 3, label: 'Edit', sub: 'Editable Document' },
  { id: 4, label: 'Export', sub: 'DOCX / PDF' },
];

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, hasResult }) => {
  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
      <div className="flex items-center justify-between gap-2 overflow-x-auto">
        {steps.map((step, idx) => {
          const isCompleted = currentStep > step.id || (hasResult && step.id < currentStep);
          const isCurrent = currentStep === step.id;

          return (
            <React.Fragment key={step.id}>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                    isCompleted
                      ? 'bg-teal-600 border-teal-600 text-white'
                      : isCurrent
                      ? 'bg-white dark:bg-gray-800 border-teal-600 text-teal-600 dark:text-teal-400 shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span>{step.id}</span>
                  )}
                </div>
                <div className="min-w-0 hidden sm:block">
                  <div
                    className={`text-sm font-semibold leading-tight truncate ${
                      isCurrent
                        ? 'text-teal-700 dark:text-teal-300'
                        : isCompleted
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {isCurrent ? (
                      <span className="inline-flex items-center gap-1.5">
                        {step.label}
                        <span className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
                      </span>
                    ) : (
                      step.label
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate hidden lg:block">{step.sub}</div>
                </div>
                {/* Mobile label */}
                <div className="sm:hidden min-w-0">
                  <div
                    className={`text-xs font-semibold leading-tight ${
                      isCurrent ? 'text-teal-700 dark:text-teal-300' : isCompleted ? 'text-gray-900 dark:text-white' : 'text-gray-500'
                    }`}
                  >
                    {step.label}
                  </div>
                </div>
              </div>

              {idx < steps.length - 1 && (
                <div className="flex-shrink-0 w-6 sm:w-10 lg:w-16 h-0.5 mx-1 rounded-full transition-colors"
                  style={{
                    background: isCompleted || currentStep > step.id ? '#0d9488' : '#e5e7eb',
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
      {/* Mobile progress bar */}
      <div className="sm:hidden mt-3 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-teal-600 transition-all duration-500"
          style={{ width: `${(currentStep / 4) * 100}%` }}
        />
      </div>
    </div>
  );
};

export default StepIndicator;
