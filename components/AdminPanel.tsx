import React, { useState, useEffect } from 'react';
import { AuthUser, FeedbackItem } from '../types';
import Button from './Button';
import { supabase } from '../services/supabaseClient';
import { authService } from '../services/auth';
import { PLANS } from '../constants';
import {
  adminApproveRequest,
  adminGrant,
  adminListAll,
  adminRejectRequest,
} from '../services/subscriptionService';

type Tab = 'feedback' | 'subscriptions';

interface AdminPanelProps {
  user: AuthUser | null;
  onRequireLogin: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ user, onRequireLogin }) => {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('subscriptions');

  // Feedback state
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);

  // Subscription state
  const [users, setUsers] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(false);
  const [grantEmail, setGrantEmail] = useState('');
  const [grantPlan, setGrantPlan] = useState('standard');
  const [grantDays, setGrantDays] = useState(30);
  const [adminMessage, setAdminMessage] = useState('');

  // Resolve admin status from the real session's profile.
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsAdmin(false);
      return () => { cancelled = true; };
    }

    setIsAdmin(null);
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();
      if (!cancelled) setIsAdmin(!!data?.is_admin);
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (isAdmin === true) {
      fetchFeedback();
      fetchAdminData();
    }
  }, [isAdmin]);

  const fetchFeedback = async () => {
    setIsLoadingFeedback(true);
    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setFeedbackList(
          data.map((item: any) => ({
            id: item.id.toString(),
            name: item.name,
            message: item.message,
            date: item.created_at,
          })),
        );
      }
    } catch (err) {
      console.error('Error fetching feedback:', err);
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  const fetchAdminData = async () => {
    setIsLoadingAdmin(true);
    setAdminMessage('');
    try {
      const data = await adminListAll();
      setUsers(data.users ?? []);
      setPendingRequests(data.pending_requests ?? []);
    } catch (err: any) {
      console.error('Error fetching admin data:', err);
      setAdminMessage(err.message ?? 'Failed to load subscriptions.');
    } finally {
      setIsLoadingAdmin(false);
    }
  };

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminMessage('');
    try {
      const planId = grantPlan === 'remove' ? null : grantPlan;
      const days = planId ? grantDays : null;
      await adminGrant(grantEmail.trim(), planId, days);
      setAdminMessage(`Done. ${grantEmail} is now on ${planId ?? 'Free'}.`);
      setGrantEmail('');
      fetchAdminData();
    } catch (err: any) {
      setAdminMessage(err.message ?? 'Grant failed.');
    }
  };

  const handleApprove = async (requestId: string) => {
    setAdminMessage('');
    try {
      await adminApproveRequest(requestId, grantDays);
      setAdminMessage('Subscription approved.');
      fetchAdminData();
    } catch (err: any) {
      setAdminMessage(err.message ?? 'Approval failed.');
    }
  };

  const handleReject = async (requestId: string) => {
    setAdminMessage('');
    try {
      await adminRejectRequest(requestId);
      setAdminMessage('Request rejected.');
      fetchAdminData();
    } catch (err: any) {
      setAdminMessage(err.message ?? 'Reject failed.');
    }
  };

  const handleLogout = async () => {
    await authService.signOut();
  };

  // Not logged in
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Admin access</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
            Please log in with an admin account to manage feedback and subscriptions.
          </p>
          <Button variant="primary" className="w-full mt-6" onClick={onRequireLogin}>
            Log In
          </Button>
        </div>
      </div>
    );
  }

  // Checking admin status
  if (isAdmin === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent"></div>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Checking access…</p>
      </div>
    );
  }

  // Not an admin
  if (isAdmin === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20 mb-4">
            <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h.01M18 10a8 8 0 11-16 0 8 8 0 0116 0zM9.22 6.16a8 8 0 015.56 0" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Access denied</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
            Your account ({user.email}) does not have admin permissions.
          </p>
          <Button variant="outline" className="w-full mt-6" onClick={handleLogout}>
            Switch account
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { fetchFeedback(); fetchAdminData(); }} className="text-sm">
            Refresh
          </Button>
          <Button variant="outline" onClick={handleLogout} className="text-sm">
            Log Out
          </Button>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {(['subscriptions', 'feedback'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'bg-teal-600 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {adminMessage && (
        <div className="mb-4 text-sm text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 rounded-lg p-3">
          {adminMessage}
        </div>
      )}

      {tab === 'subscriptions' && (
        <div className="space-y-6">
          {/* Pending requests */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pending upgrade requests</h2>
            </div>
            {isLoadingAdmin ? (
              <div className="p-8 text-center text-sm text-gray-500">Loading…</div>
            ) : pendingRequests.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                No pending requests.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {pendingRequests.map((r) => (
                      <tr key={r.id}>
                        <td className="px-6 py-3 text-sm text-gray-900 dark:text-white">{r.email}</td>
                        <td className="px-6 py-3 text-sm capitalize text-teal-600">{r.plan_id}</td>
                        <td className="px-6 py-3 text-sm text-gray-500">
                          {new Date(r.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(r.id)}
                              className="text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg"
                            >
                              Approve (30d)
                            </button>
                            <button
                              onClick={() => handleReject(r.id)}
                              className="text-xs font-medium bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-lg"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Manual grant */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Grant / change a subscription</h2>
            <form onSubmit={handleGrant} className="grid gap-4 sm:grid-cols-4 items-end">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  User email
                </label>
                <input
                  type="email"
                  required
                  value={grantEmail}
                  onChange={(e) => setGrantEmail(e.target.value)}
                  className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white p-2.5"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Plan
                </label>
                <select
                  value={grantPlan}
                  onChange={(e) => setGrantPlan(e.target.value)}
                  className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white p-2.5"
                >
                  {PLANS.filter((p) => p.id !== 'free').map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (৳{p.priceBdt}/mo)
                    </option>
                  ))}
                  <option value="remove">Remove plan (Free)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Days
                </label>
                <input
                  type="number"
                  min={1}
                  value={grantDays}
                  onChange={(e) => setGrantDays(Number(e.target.value))}
                  className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white p-2.5"
                />
              </div>
              <div className="sm:col-span-4">
                <Button type="submit" variant="primary" className="w-full sm:w-auto">
                  Apply
                </Button>
              </div>
            </form>
          </div>

          {/* Users */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Users</h2>
            </div>
            {isLoadingAdmin ? (
              <div className="p-8 text-center text-sm text-gray-500">Loading…</div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">No users yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td className="px-6 py-3 text-sm text-gray-900 dark:text-white">{u.email}</td>
                        <td className="px-6 py-3 text-sm capitalize text-teal-600">{u.plan_id}</td>
                        <td className="px-6 py-3 text-sm text-gray-500">{u.subscription_status}</td>
                        <td className="px-6 py-3 text-sm text-gray-500">
                          {u.subscription_expires_at
                            ? new Date(u.subscription_expires_at).toLocaleDateString()
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'feedback' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden min-h-[200px]">
          {isLoadingFeedback ? (
            <div className="flex flex-col items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
              <p className="mt-2 text-sm text-gray-500">Loading data from Supabase...</p>
            </div>
          ) : feedbackList.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">No feedback submitted yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {feedbackList.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(item.date).toLocaleDateString()}
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
      )}
    </div>
  );
};

export default AdminPanel;
