import React, { useEffect, useState } from 'react';
import { FEEDBACK_STORAGE_KEY } from '../constants';
import { Feedback } from '../types';
import Button from '../components/Button';

const Admin: React.FC = () => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);

  useEffect(() => {
    loadFeedback();
  }, []);

  const loadFeedback = () => {
    const data = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (data) {
      try {
        setFeedbacks(JSON.parse(data));
      } catch (e) {
        console.error("Failed to load feedback", e);
      }
    }
  };

  const deleteFeedback = (id: string) => {
    if (!window.confirm("Are you sure you want to delete this?")) return;
    
    const updated = feedbacks.filter(f => f.id !== id);
    setFeedbacks(updated);
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(updated));
  };

  const clearAll = () => {
    if (!window.confirm("Clear ALL feedback? This cannot be undone.")) return;
    setFeedbacks([]);
    localStorage.removeItem(FEEDBACK_STORAGE_KEY);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard - Feedback</h1>
        <Button variant="outline" onClick={clearAll} disabled={feedbacks.length === 0}>
          Clear All
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {feedbacks.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            No feedback submitted yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Message</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {feedbacks.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(item.date).toLocaleDateString()} <br/>
                      <span className="text-xs">{new Date(item.date).toLocaleTimeString()}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {item.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300 max-w-md truncate">
                      {item.message}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => deleteFeedback(item.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="mt-4 text-xs text-gray-400 text-center">
        Note: Feedback is stored in browser LocalStorage. You will only see feedback submitted from this browser.
      </p>
    </div>
  );
};

export default Admin;