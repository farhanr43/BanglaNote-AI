// ============================================================================
// BanglaNote AI — AI Proxy Edge Function
// Enforces the credit system (backend is the source of truth) and forwards
// to Google Gemini. The Gemini API key lives ONLY here, never in the browser.
//
// Modes:
//   "ocr"       -> layout-aware OCR. Requires 1 credit. Returns {text, layout}
//   "transform" -> free text transforms (grammar/format/summary/translate/bullets)
//   "usage"     -> peek current credits without consuming
//
// Deploy:  supabase functions deploy ai-proxy --no-verify-jwt
// Secrets: GEMINI_API_KEY (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are
//          auto-injected by Supabase and always kept current).
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "gemini-3.5-flash-lite";
const GUEST_LIMIT_MESSAGE =
  "You've used your 3 free OCR attempts. Please log in or create a free account to continue.";
const USER_LIMIT_MESSAGE =
  "You've used all your OCR credits for today. Your limit resets daily. Please log in or upgrade your plan to continue.";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const geminiApiKey = Deno.env.get("GEMINI_API_KEY") ?? "";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

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

const errorResponse = (
  code: string,
  message: string,
  status = 400,
  extra: Record<string, unknown> = {},
) =>
  json({ ok: false, error: { code, message, ...extra } }, status);

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
const sha256 = async (input: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const clientIp = (request: Request): string => {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("cf-connecting-ip") ?? "unknown";
};

const bearerToken = (request: Request): string | null => {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : null;
};

/** Resolve the caller: returns { userId } or null for guests. */
async function resolveUser(token: string | null) {
  if (!token) return null;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

/** Peek credits via Postgres (service role). */
async function checkCredits(userId: string | null, ipHash: string) {
  const { data, error } = await supabase.rpc("check_ocr_credits", {
    p_user_id: userId,
    p_ip_hash: ipHash,
  });
  if (error) throw new Error(`credit check failed: ${error.message}`);
  return data as any;
}

/** Deduct one credit, idempotent per requestId. */
async function consumeCredit(requestId: string, userId: string | null, ipHash: string) {
  const { data, error } = await supabase.rpc("consume_ocr_credit", {
    p_request_id: requestId,
    p_user_id: userId,
    p_ip_hash: ipHash,
  });
  if (error) throw new Error(`credit consume failed: ${error.message}`);
  return data as any;
}

// ----------------------------------------------------------------------------
// Gemini layout-aware OCR prompt + schema
// ----------------------------------------------------------------------------
const LAYOUT_PROMPT = `Extract ALL text from this document image AND detect its visual layout so it can be reconstructed as an editable Word document.

Rules:
- Preserve headings, paragraphs, bullet lists, numbered lists, tables, mathematical expressions, bold/italic/underline text, alignment, indentation, and question/answer structures exactly as they appear.
- "text" must be the complete extraction in natural reading order with paragraph breaks preserved (use \\n between blocks) — this is the plain-text fallback.
- Each distinct visual element becomes one object in "blocks":
  - type "heading" with level 1 (title), 2 (section), or 3 (subsection)
  - type "paragraph"
  - type "bullet" with an "items" array (each bullet text)
  - type "numbered" with an "items" array (keep the numbering order)
  - type "table" with "rows" as an array of cell-arrays
  - type "equation" for math expressions
- Set bold/italic/underline only when the source text is styled that way.
- Keep all text in its original language (Bangla and/or English). Do not translate.
- Return ONLY valid JSON matching this schema. No commentary, no markdown fences.`;

const LAYOUT_SCHEMA = {
  type: "object",
  properties: {
    text: { type: "string" },
    blocks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["heading", "paragraph", "bullet", "numbered", "table", "equation"],
          },
          text: { type: "string" },
          level: { type: "integer" },
          bold: { type: "boolean" },
          italic: { type: "boolean" },
          underline: { type: "boolean" },
          alignment: { type: "string" },
          items: { type: "array", items: { type: "string" } },
          rows: { type: "array", items: { type: "array", items: { type: "string" } } },
        },
      },
    },
  },
};

/** Try to coerce model output into {text, blocks}. */
function normalizeLayout(raw: string): { text: string; blocks: unknown[] } {
  let parsed: any = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const stripped = raw.replace(/```json|```/g, "").trim();
    try {
      parsed = JSON.parse(stripped);
    } catch {
      parsed = null;
    }
  }

  if (parsed && typeof parsed === "object") {
    const text = typeof parsed.text === "string" ? parsed.text : "";
    const blocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
    if (blocks.length) return { text, blocks };
    if (text.trim()) {
      const paragraphs = text
        .split(/\n+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => ({ type: "paragraph", text: t }));
      return { text, blocks: paragraphs };
    }
    return { text: "", blocks: [] };
  }

  // Last resort: treat the raw output as one paragraph.
  return { text: raw || "", blocks: [{ type: "paragraph", text: raw || "" }] };
}

async function geminiGenerate(parts: unknown[], schema?: unknown): Promise<string> {
  if (!geminiApiKey) throw new Error("Gemini is not configured (missing GEMINI_API_KEY)");

  const generationConfig: Record<string, unknown> = {};
  if (schema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = schema;
  }

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": geminiApiKey,
    },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig,
    }),
  });

  const payload = await res.json();
  if (!res.ok) {
    const detail = payload?.error?.message ?? JSON.stringify(payload);
    throw new Error(detail);
  }

  return (
    payload?.candidates?.[0]?.content?.parts
      ?.map((p: any) => (typeof p?.text === "string" ? p.text : ""))
      .join("") ?? ""
  );
}

async function runOcr(base64: string, mimeType: string) {
  const raw = await geminiGenerate(
    [
      { inlineData: { mimeType, data: base64 } },
      { text: LAYOUT_PROMPT },
    ],
    LAYOUT_SCHEMA,
  );
  return normalizeLayout(raw);
}

async function runTransform(prompt: string, text: string) {
  return geminiGenerate([{ text: `${prompt}\n\n---\n\n${text}` }]);
}

// ----------------------------------------------------------------------------
// Handlers
// ----------------------------------------------------------------------------
async function handleOcr(body: any, userId: string | null, ipHash: string) {
  const { base64, mimeType } = body;
  if (!base64 || !mimeType) {
    return errorResponse("BAD_REQUEST", "Missing base64 or mimeType.");
  }
  const requestId =
    typeof body.requestId === "string" && body.requestId.length > 0
      ? body.requestId.slice(0, 64)
      : crypto.randomUUID();

  // 1. Pre-flight credit check (peek) — no deduction yet.
  const summary = await checkCredits(userId, ipHash);
  if ((summary.remaining ?? 0) <= 0) {
    const message = summary.is_guest ? GUEST_LIMIT_MESSAGE : USER_LIMIT_MESSAGE;
    return json(
      { ok: false, error: { code: "LIMIT_REACHED", message }, summary },
      402,
    );
  }

  // 2. Run Gemini.
  let layout: { text: string; blocks: unknown[] };
  try {
    layout = await runOcr(base64, mimeType);
  } catch (err: any) {
    return errorResponse("OCR_FAILED", `OCR failed: ${err.message ?? err}`, 502);
  }

  // 3. Deduct one credit ONLY on success (idempotent per requestId).
  const deduction = await consumeCredit(requestId, userId, ipHash);
  if (!deduction?.ok) {
    return json(
      { ok: false, error: { code: "LIMIT_REACHED", message: USER_LIMIT_MESSAGE }, summary: deduction?.summary },
      402,
    );
  }

  return json({
    ok: true,
    mode: "ocr",
    text: layout.text,
    layout: { text: layout.text, blocks: layout.blocks },
    summary: deduction.summary,
  });
}

async function handleTransform(body: any) {
  const { prompt, text } = body;
  if (!prompt || !text) {
    return errorResponse("BAD_REQUEST", "Missing prompt or text.");
  }
  const result = await runTransform(prompt, text);
  return json({ ok: true, mode: "transform", text: result });
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "POST only.", 405);
  }

  try {
    const body = await req.json();
    const mode = body?.mode ?? "ocr";

    // Usage peek does not need an IP or auth distinction.
    if (mode === "usage") {
      const token = bearerToken(req);
      const user = await resolveUser(token);
      const ipHash = await sha256(clientIp(req));
      const summary = await checkCredits(user?.id ?? null, ipHash);
      return json({ ok: true, summary });
    }

    if (mode === "transform") {
      return await handleTransform(body);
    }

    if (mode === "ocr") {
      const token = bearerToken(req);
      const user = await resolveUser(token);
      const ipHash = await sha256(clientIp(req));

      return await handleOcr(body, user?.id ?? null, ipHash);
    }

    return errorResponse("BAD_REQUEST", `Unknown mode: ${mode}`);
  } catch (err: any) {
    console.error("ai-proxy error:", err);
    return errorResponse("INTERNAL", err.message ?? "Unexpected error.", 500);
  }
});
