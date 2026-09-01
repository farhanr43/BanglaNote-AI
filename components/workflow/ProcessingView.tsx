import React, { useEffect, useState } from 'react';

interface ProcessingViewProps {
  mode: 'ocr' | 'analysis';
  fileName?: string;
  onCancel?: () => void;
}

const ocrMessages = [
  'Detecting text regions...',
  'Extracting Bangla & English text...',
  'Preserving reading order...',
  'Detecting tables & lists...',
];

const analysisMessages = [
  { label: 'Analyzing document format...', desc: 'Detecting headings, paragraphs, and structure' },
  { label: 'Reconstructing layout...', desc: 'Rebuilding tables, lists, and alignment' },
  { label: 'Refining OCR result...', desc: 'Fixing recognition errors while preserving original wording' },
];

const ProcessingView: React.FC<ProcessingViewProps> = ({ mode, fileName }) => {
  const [tick, setTick] = useState(0);
  const [analysisIdx, setAnalysisIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % ocrMessages.length), 1400);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (mode !== 'analysis') return;
    const id = setInterval(() => setAnalysisIdx((i) => (i + 1) % analysisMessages.length), 1600);
    return () => clearInterval(id);
  }, [mode]);

  if (mode === 'ocr') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 flex flex-col items-center text-center">
        <div className="relative w-20 h-20 mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-teal-100 dark:border-teal-900/30" />
          <div className="absolute inset-0 rounded-full border-4 border-teal-600 border-t-transparent animate-spin" />
          <div className="absolute inset-2 rounded-full bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Processing with OCR…</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md">
          Extracting text, headings, lists, and tables. Reading order is preserved.
        </p>
        {fileName && <p className="text-xs text-gray-400 mt-1 truncate max-w-xs">{fileName}</p>}
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-teal-50 dark:bg-teal-900/20 rounded-full border border-teal-200 dark:border-teal-800">
          <span className="w-2 h-2 bg-teal-600 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-teal-700 dark:text-teal-300">{ocrMessages[tick]}</span>
        </div>
        <div className="mt-6 w-full max-w-sm h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-teal-600 rounded-full animate-pulse" style={{ width: '70%' }} />
        </div>
        <p className="text-xs text-gray-400 mt-2">This usually takes 5–15 seconds</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Format Analysis & Refinement</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Reconstructing document structure without changing meaning</p>
        </div>
      </div>

      <div className="space-y-3">
        {analysisMessages.map((m, i) => {
          const isActive = i === analysisIdx;
          const isDone = i < analysisIdx;
          return (
            <div
              key={m.label}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                isActive
                  ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800'
                  : isDone
                  ? 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-600 opacity-75'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              }`}
            >
              <div
                className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  isDone
                    ? 'bg-teal-600 text-white'
                    : isActive
                    ? 'bg-teal-600 text-white animate-pulse'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                }`}
              >
                {isDone ? '✓' : i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-medium ${isActive ? 'text-teal-800 dark:text-teal-200' : 'text-gray-800 dark:text-gray-200'}`}>
                  {m.label}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{m.desc}</div>
                {isActive && (
                  <div className="mt-2 h-1 bg-teal-100 dark:bg-teal-900/30 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-600 rounded-full animate-[shimmer_1.5s_ease_infinite]" style={{ width: '60%', background: 'linear-gradient(90deg, transparent, #0d9488, transparent)', backgroundSize: '200% 100%' }} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
        <p className="text-xs text-amber-800 dark:text-amber-200 flex gap-2">
          <span>⚠️</span>
          <span>We only fix obvious OCR errors when confidence is high. Original wording, numbers, dates, and names are preserved.</span>
        </p>
      </div>
    </div>
  );
};

export default ProcessingView;
