import React, { useState, useEffect } from 'react';
import { FeedbackItem } from '../types';
import Button from './Button';
import { supabase } from '../services/supabaseClient';

const AdminPanel: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // Data States
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Fetch feedback once authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchFeedback();
    }
  }, [isAuthenticated]);

  const fetchFeedback = async () => {
    setIsLoadingData(true);
    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // Map Supabase columns to our FeedbackItem type
        const mappedData: FeedbackItem[] = data.map((item: any) => ({
          id: item.id.toString(),
          name: item.name,
          message: item.message,
          date: item.created_at
        }));
        setFeedbackList(mappedData);
      }
    } catch (err) {
      console.error('Error fetching feedback:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Hardcoded credentials for client-side demo
    if (username === 'endless' && password === '20043') {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Invalid credentials');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername('');
    setPassword('');
    setFeedbackList([]);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Login</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Please sign in to view feedback.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white shadow-sm focus:border-teal-500 focus:ring-teal-500 p-2.5"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white shadow-sm focus:border-teal-500 focus:ring-teal-500 p-2.5"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 text-center bg-red-50 dark:bg-red-900/20 p-2 rounded">
                {error}
              </p>
            )}

            <Button variant="primary" type="submit" className="w-full">
              Sign In
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Feedback Dashboard</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={fetchFeedback} className="text-sm" disabled={isLoadingData}>
             Refresh
          </Button>
          <Button variant="outline" onClick={handleLogout} className="text-sm">
            Log Out
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden min-h-[200px]">
        {isLoadingData ? (
          <div className="flex flex-col items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
            <p className="mt-2 text-sm text-gray-500">Loading data from Supabase...</p>
          </div>
        ) : feedbackList.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            No feedback submitted yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Message
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {feedbackList.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(item.date).toLocaleDateString()} <span className="text-xs opacity-70">{new Date(item.date).toLocaleTimeString()}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {item.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 break-words max-w-lg">
                      {item.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;