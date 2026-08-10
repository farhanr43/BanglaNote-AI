import { supabase } from './supabaseClient';
import { authService } from './auth';
import { ADMIN_GRANT_URL } from '../constants';
import { SubscriptionRequest } from '../types';

// ---------------------------------------------------------------------------
// User-facing: request an upgrade (RLS allows inserting own rows only)
// ---------------------------------------------------------------------------
export const requestUpgrade = async (planId: string): Promise<{ ok: boolean; error?: string }> => {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return { ok: false, error: 'You must be logged in to request an upgrade.' };

  const { error } = await supabase.from('subscription_requests').insert([{ user_id: userId, plan_id: planId }]);
  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'You already have a pending request for this plan.' };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
};

// ---------------------------------------------------------------------------
// Admin-facing: routed through the admin-grant edge function, which verifies
// the caller's Supabase session and is_admin flag server-side.
// ---------------------------------------------------------------------------
interface AdminListData {
  users: any[];
  pending_requests: SubscriptionRequest[];
}

async function adminEdge(body: Record<string, unknown>): Promise<any> {
  const token = await authService.getAccessToken();
  if (!token) throw new Error('You must be logged in to access the admin panel.');

  const res = await fetch(ADMIN_GRANT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error?.message ?? `Admin request failed (${res.status}).`);
  }
  return data;
}

export const adminListAll = async (): Promise<AdminListData> => {
  const data = await adminEdge({ mode: 'list' });
  return { users: data.users ?? [], pending_requests: data.pending_requests ?? [] };
};

export const adminGrant = async (
  userEmail: string,
  planId: string | null,
  days: number | null,
): Promise<void> => {
  await adminEdge({ mode: 'grant', userEmail, planId, days });
};

export const adminApproveRequest = async (requestId: string, days: number): Promise<void> => {
  await adminEdge({ mode: 'approve', requestId, days });
};

export const adminRejectRequest = async (requestId: string): Promise<void> => {
  await adminEdge({ mode: 'reject', requestId });
};
