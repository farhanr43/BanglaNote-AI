// ============================================================================
// BanglaNote AI — Admin subscription management (admin-granted payments)
//
// Guarded by a shared secret ADMIN_TOKEN (env) sent as the `x-admin-token`
// header. Calls service-role-only Postgres functions, so the anon key can
// never grant subscriptions directly.
//
// Modes:
//   "list"   -> list users + pending subscription requests
//   "grant"  -> { userEmail, planId, days }  (days = null removes plan)
//   "approve"-> { requestId, days } approve a pending subscription request
//   "reject" -> { requestId } mark a request as rejected
//
// Deploy: supabase functions deploy admin-grant --no-verify-jwt
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_TOKEN
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const adminToken = Deno.env.get("ADMIN_TOKEN") ?? "";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const errorResponse = (code: string, message: string, status = 400) =>
  json({ ok: false, error: { code, message } }, status);

async function listAll() {
  const { data, error } = await supabase.rpc("admin_list_users");
  if (error) throw new Error(error.message);
  return json({ ok: true, ...(data as any) });
}

async function grant(body: any) {
  const { userEmail, planId, days } = body ?? {};
  if (!userEmail) return errorResponse("BAD_REQUEST", "userEmail is required.");
  if (days != null && !Number.isFinite(days)) {
    return errorResponse("BAD_REQUEST", "days must be a number or null.");
  }

  const { data, error } = await supabase.rpc("grant_subscription", {
    p_user_email: userEmail,
    p_plan_id: planId ?? null,
    p_days: days ?? null,
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) {
    return errorResponse("NOT_FOUND", data?.error ?? "Failed to grant subscription.");
  }
  return json({ ok: true, result: data });
}

async function approve(body: any) {
  const { requestId, days } = body ?? {};
  if (!requestId) return errorResponse("BAD_REQUEST", "requestId is required.");

  // Fetch the pending request (service role bypasses RLS).
  const { data: rows, error: fetchErr } = await supabase
    .from("subscription_requests")
    .select("id, user_id, plan_id")
    .eq("id", requestId)
    .eq("status", "pending")
    .limit(1);
  if (fetchErr) throw new Error(fetchErr.message);

  const row = rows?.[0];
  if (!row) return errorResponse("NOT_FOUND", "No pending request with that id.");

  // Resolve email for the grant RPC.
  const { data: user, error: userErr } = await supabase.auth.admin.getUserById(row.user_id);
  if (userErr || !user?.user) return errorResponse("NOT_FOUND", "User not found.");
  const email = user.user.email!;

  const grantResult = await supabase.rpc("grant_subscription", {
    p_user_email: email,
    p_plan_id: row.plan_id,
    p_days: days ?? 30,
  });
  if (grantResult.error) throw new Error(grantResult.error.message);

  await supabase
    .from("subscription_requests")
    .update({ status: "approved" })
    .eq("id", requestId);

  return json({ ok: true, result: grantResult.data });
}

async function reject(body: any) {
  const { requestId } = body ?? {};
  if (!requestId) return errorResponse("BAD_REQUEST", "requestId is required.");
  await supabase.from("subscription_requests").update({ status: "rejected" }).eq("id", requestId);
  return json({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "POST only.", 405);
  }

  // Shared-secret guard.
  const provided = req.headers.get("x-admin-token");
  if (!adminToken || provided !== adminToken) {
    return errorResponse("UNAUTHORIZED", "Invalid admin token.", 401);
  }

  try {
    const body = await req.json();
    const mode = body?.mode ?? "list";

    switch (mode) {
      case "list":
        return await listAll();
      case "grant":
        return await grant(body);
      case "approve":
        return await approve(body);
      case "reject":
        return await reject(body);
      default:
        return errorResponse("BAD_REQUEST", `Unknown mode: ${mode}`);
    }
  } catch (err: any) {
    console.error("admin-grant error:", err);
    return errorResponse("INTERNAL", err.message ?? "Unexpected error.", 500);
  }
});
