import React from 'react';
import { HistoryItem } from '../types';

interface HistoryProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
}

const History: React.FC<HistoryProps> = ({ history, onSelect, onClear }) => {
  if (history.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Recent Notes
        </h3>
        <button 
          onClick={onClear}
          className="text-xs text-red-500 hover:text-red-600 transition-colors"
        >
          Clear
        </button>
      </div>
      <div className="space-y-3">
        {history.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className="w-full text-left p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-all group"
          >
            <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1 font-bengali">
              {item.previewText}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {new Date(item.date).toLocaleDateString()}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default History;