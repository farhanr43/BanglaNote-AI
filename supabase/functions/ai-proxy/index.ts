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
const MODEL_FALLBACKS = ["gemini-3.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"];
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
const LAYOUT_PROMPT = `You are a precise document OCR engine. Extract ALL text from this document image AND detect its visual layout so it can be reconstructed as an editable Word document.

CRITICAL OUTPUT RULES — VIOLATION WILL BREAK THE APP:
- Output MUST be ONLY a single valid JSON object matching the schema. No markdown, no fences, no commentary, no reasoning, no chain-of-thought, no explanation, no JSON key descriptions.
- NEVER output your thinking, planning, or any text like "Block 1 (Paragraph):", "Let's make sure", "Wait,", "affirmative JSON", "End of thought", "Do not generate any control token".
- NEVER generate control tokens or placeholders like _and_, _at_any_places_, or escaped newlines commentary. Inside JSON strings, escape newlines as \\n correctly and do not discuss escaping.
- NEVER wrap JSON values as separate blocks. Each document element is ONE block object; do not create blocks for "{" or "\\"text\\":".

Content rules:
- Preserve headings, paragraphs, bullet/numbered lists, tables, bold/italic/underline, alignment, indentation, question/answer structures exactly as they appear.
- MATHEMATICAL FIDELITY (CRITICAL for this document type):
  - Inline math inside a paragraph: use $...$ e.g. "প্রদত্ত সমীকরণ, $x^{2}-xy+4=0$" , "(2, 4) বিন্দুতে $y_{1}=1-1=0$ এবং $y_{2}=\\frac{8}{8}=1$"
  - Display / centered equations: type "equation" with LaTeX WITHOUT outer $, centered and with vertical fractions. Use \\frac for EVERY fraction, even simple ones.
    Examples MUST be followed:
    • "\\Rightarrow y = x + \\frac{4}{x}"
    • "\\Rightarrow y_{1}=1-\\frac{4}{x^{2}} \\text{ এবং } y_{2}=\\frac{8}{x^{3}}"
    • "\\therefore \\rho = \\frac{(1+y_{1}^{2})^{3/2}}{y_{2}} = 1"
    • "\\therefore \\alpha = 2-\\frac{y_{1}(1+y_{1}^{2})}{y_{2}} = 2-\\frac{0}{1}=2"
    • "\\beta = 4+\\frac{1+y_{1}^{2}}{y_{2}} = 4+1=5"
    • "\\Rightarrow x^{2}+y^{2}-4x-10y+28=0"
    • Use \\therefore for ∴ and \\Rightarrow for ⇒/=>.
  - Use ^{2}, _{1} (always with braces: x^{2}, y_{1}), \\frac{a}{b}, \\sqrt{}, \\alpha \\beta, \\rho. NEVER plain "x^2", "y_1", "4/x", "8/x^3".
  - For multi-line derivations, create SEPARATE "equation" blocks for each centered line (even if image shows two equations on one line with "এবং", split or keep with \\text{ এবং }).
  - Mixed Bangla+math: keep Bangla Unicode outside $, math inside $...$, e.g. "ধরি $(2, 4)$ বিন্দুতে বক্রতার কেন্দ্র $(\\alpha, \\beta)$"
  - NEVER output XML-like tags such as </Text>.
- "text" is plain-text fallback with \\n between blocks, preserving $...$ for math.
- blocks: heading (level 1-3), paragraph (may contain inline $...$), bullet/numbered (items array), table (rows), equation (display LaTeX).
- Keep original language (Bangla and/or English). Do NOT translate. Do NOT hallucinate. Keep (2, 4), NUH-04, 11, etc. verbatim.
- For documents containing mathematics (Bangla or English), ensure EVERY fraction has a horizontal vinculum via \\frac, EVERY exponent has ^{}, EVERY subscript has _{}, and display equations are centered.

Example (short) valid output:
{"text":"উদাহরণ-35. $x^{2}-xy+4=0$\\nসমাধান : $x^{2}-xy+4=0$","blocks":[{"type":"paragraph","text":"উদাহরণ-35. $x^{2}-xy+4=0$"},{"type":"equation","text":"\\Rightarrow y = x + \\frac{4}{x}"}]}`;

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

const sanitizeText = (s: string): string =>
  s
    .replace(/<\/?Text[^>]*>?/gi, "")
    .replace(/\s*<\/?Text\s*\/?\s*$/gi, "")
    .replace(/\s*affirmative\s+JSON.*$/is, "")
    .replace(/\s*No other comments.*$/is, "")
    .replace(/\s*Let's make sure.*$/is, "")
    .replace(/\s*Let's carefully construct.*$/is, "")
    .replace(/\s*Let's combine them.*$/is, "")
    .replace(/\s*Let's write out.*$/is, "")
    .replace(/\s*Wait,.*End of thought.*$/is, "")
    .replace(/\s*Wait,.*$/is, "")
    .replace(/\s*I will output just the JSON.*$/is, "")
    .replace(/\s*End of thought\.?\s*$/is, "")
    .replace(/_and_\s*/g, " ")
    .replace(/_at_any_places_*/g, " ")
    .replace(/Do not generate any control token.*$/is, "")
    .replace(/Do not include any extra text.*$/is, "")
    .replace(/Only generate a valid.*$/is, "")
    .replace(/Wait, the prompt.*$/is, "")
    .replace(/Usually it means.*$/is, "")
    .replace(/safe_execution.*$/is, "")
    .replace(/safe_JSON.*$/is, "")
    .replace(/<\/?[^>]+>/g, (m) => (m.includes("$") || m.includes("\\") ? m : ""))
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isHallucinated = (s: string): boolean => {
  const t = s.toLowerCase();
  if (s.includes('"type"') && s.includes('"blocks"')) return true;
  if (s.includes('"type":') && s.length > 80) return true;
  if (t.includes('affirmative json') || t.includes('no other comments') || t.includes('end of thought') || t.includes('i will output just the json') || t.includes('i will provide') || t.includes("let's make sure") || t.includes("let's carefully") || t.includes("let's combine") || t.includes("let's write") || t.includes('do not include any extra text') || t.includes('only generate a valid')) return true;
  if (t.includes('do not generate') || t.includes('control token')) return true;
  if (t.includes('_and_') || t.includes('_at_any_places_') || t.includes('wait_the_rule')) return true;
  if (t.includes('block 1') || t.includes('block 2') || (t.includes('block ') && (t.includes('(paragraph)') || t.includes('(equation)')))) return true;
  if (t.startsWith('{') && s.includes('"blocks"')) return true;
  if (/^["\s]*\{?\s*"?(text|blocks|type)"?\s*:/.test(s.trim())) return true;
  if (/^[\{\}\[\]":,\s]+$/.test(s.trim())) return true;
  if (t.includes('wait,') && t.length > 60) return true;
  if (t.includes('wait the prompt') || t.includes('usually it means') || t.includes('escaped_') || t.includes('_or_no_literal')) return true;
  if (t.includes('safe_execution') || t.includes('safe_json')) return true;
  return false;
};

const looksLikeJsonFragment = (s: string): boolean => {
  const t = s.trim();
  if (t.length === 0) return false;
  if (/^[\{\}\[\]":,\s]+$/.test(t) && t.includes('"')) return true;
  if (/^"\w+"\s*:\s*[\[\{"]/.test(t)) return true;
  if (t === "{" || t === "}" || t === "}," || t === "]," || t === "[" || t === "]" || t === '"text":' || t === '"blocks":' || t === '"blocks": [' ) return true;
  if (t.startsWith('"type"') || t.startsWith('"text"') || t.startsWith('"blocks"')) return true;
  if (t.startsWith('{') && t.includes('"type"')) return true;
  return false;
};

// Find balanced JSON object/array starting at first occurrence of open char, respecting strings
const findBalanced = (src: string, open: string, close: string, startIdx = 0): string | null => {
  const start = src.indexOf(open, startIdx);
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    } else {
      if (ch === '"') { inStr = true; continue; }
      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) return src.slice(start, i + 1);
      }
    }
  }
  return null;
};

/** Try to coerce model output into {text, blocks}. */
function normalizeLayout(raw: string): { text: string; blocks: unknown[] } {
  let parsed: any = null;
  const tryParse = (s: string): any => {
    try { return JSON.parse(s); } catch { return null; }
  };
  // 1. direct
  parsed = tryParse(raw);
  // 2. strip fences
  if (!parsed) {
    const stripped = raw.replace(/```json|```/g, "").trim();
    parsed = tryParse(stripped);
    if (!parsed) {
      // 3. balanced object extraction
      const objStr = findBalanced(stripped, '{', '}');
      if (objStr) parsed = tryParse(objStr);
      // 4. if still null, try to extract blocks array + text separately (handles dump like "\"blocks\": [...]")
      if (!parsed) {
        const blocksArrStr = findBalanced(stripped, '[', ']');
        // find blocks key
        const blkIdx = stripped.indexOf('"blocks"');
        if (blkIdx !== -1 && blocksArrStr) {
          try {
            const arr = JSON.parse(blocksArrStr);
            if (Array.isArray(arr)) {
              // try to get text field
              const textMatch = stripped.match(/"text"\s*:\s*"([\s\S]*?)"/);
              const txt = textMatch ? textMatch[1] : "";
              parsed = { text: txt, blocks: arr };
            }
          } catch { /* ignore */ }
        }
      }
      // 5. try to find blocks array start explicitly after "blocks"
      if (!parsed) {
        const idx = stripped.indexOf('"blocks"');
        if (idx !== -1) {
          const arrStart = stripped.indexOf('[', idx);
          if (arrStart !== -1) {
            const arrStr = findBalanced(stripped, '[', ']', arrStart);
            if (arrStr) {
              try {
                const arr = JSON.parse(arrStr);
                if (Array.isArray(arr)) parsed = { text: "", blocks: arr };
              } catch {}
            }
          }
        }
      }
    }
  }

  if (parsed && typeof parsed === "object") {
    let text = typeof parsed.text === "string" ? parsed.text : "";
    let blocks: any[] = Array.isArray(parsed.blocks) ? parsed.blocks : [];
    text = sanitizeText(text);
    // filter hallucinated text
    if (isHallucinated(text)) text = "";
    blocks = blocks
      .map((b: any) => {
        if (typeof b.text === "string") b.text = sanitizeText(b.text);
        if (Array.isArray(b.items)) b.items = b.items.map((it: string) => sanitizeText(String(it)));
        if (Array.isArray(b.rows)) b.rows = b.rows.map((r: any) => Array.isArray(r) ? r.map((c: string) => sanitizeText(String(c))) : [sanitizeText(String(r))]);
        const upconvertPlain = (s: string): string => {
          let t = s;
          t = t.replace(/=>/g, "\\Rightarrow").replace(/⇒/g, "\\Rightarrow").replace(/∴/g, "\\therefore");
          t = t.replace(/ρ/g, "\\rho").replace(/α/g, "\\alpha").replace(/β/g, "\\beta");
          t = t.replace(/([a-zA-Z0-9\)\]])\^(\d+)(?!\{)/g, "$1^{$2}");
          t = t.replace(/([a-zA-Z0-9\)\]])\^([a-zA-Z])/g, "$1^{$2}");
          t = t.replace(/([a-zA-Z])_(\d+)(?!\{)/g, "$1_{$2}");
          t = t.replace(/([a-zA-Z])_([a-zA-Z])/g, "$1_{$2}");
          // Only convert SIMPLE fractions like 4/x, 8/x^{3}, 8/8 — keep complex (1+y)^{3/2}/y as is for prompt to handle
          if (t.includes("/")) {
            // number / x^{...}  -> \frac
            t = t.replace(/(\b\d+\b)\s*\/\s*(x(?:\^\{[^}]+\}|\^\d+|)(?![a-zA-Z0-9]))/g, "\\frac{$1}{$2}");
            // number / number  -> \frac (e.g., 8/8)
            t = t.replace(/(\b\d+\b)\s*\/\s*(\b\d+\b)/g, "\\frac{$1}{$2}");
          }
          return t;
        };
        const fixMath = (s: string): string => {
          if (!s) return s;
          // If already perfect LaTeX, still ensure symbols are LaTeX
          if (s.includes("$")) return s;
          // For equation or paragraph with math, upconvert
          if (b.type === "equation" || /[=∫∑\^_\/]/.test(s) || /[ρ\alpha\beta]/.test(s)) {
            return upconvertPlain(s);
          }
          return s;
        };
        if (typeof b.text === "string") b.text = fixMath(b.text);
        if (Array.isArray(b.items)) b.items = b.items.map((it: string) => fixMath(String(it)));
        if (Array.isArray(b.rows)) b.rows = b.rows.map((r: any) => Array.isArray(r) ? r.map((c: string) => fixMath(String(c))) : [fixMath(String(r))] as any);
        return b;
      })
      .filter((b: any) => {
        const t = (b.text ?? "") as string;
        const items = Array.isArray(b.items) ? b.items.join(" ") : "";
        const check = `${t} ${items}`.trim();
        if (!check) return false;
        if (isHallucinated(check)) return false;
        if (looksLikeJsonFragment(check)) return false;
        if (check.includes('"type":') || check.includes('"blocks"')) return false;
        if (check.length < 5 && /^[\{\}\[\]:",\s]+$/.test(check)) return false;
        return true;
      });
    if (blocks.length) {
      // rebuild text from blocks if text was hallucinated or empty
      if (!text.trim()) {
        text = blocks.map((b: any) => b.text ?? (b.items ? b.items.join(" ") : "")).join("\n\n");
      }
      return { text, blocks };
    }
    if (text.trim() && !isHallucinated(text)) {
      const paragraphs = text
        .split(/\n+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .filter((t) => !isHallucinated(t))
        .map((t) => ({ type: "paragraph", text: t }));
      return { text, blocks: paragraphs };
    }
    return { text: "", blocks: [] };
  }

  const cleaned = sanitizeText(raw);
  if (isHallucinated(cleaned)) return { text: "", blocks: [] };
  // if raw looks like a JSON dump, don't keep it as paragraph
  if (cleaned.includes('"type":') && cleaned.includes('"blocks"')) return { text: "", blocks: [] };
  return { text: cleaned || "", blocks: cleaned ? [{ type: "paragraph", text: cleaned }] : [] };
}

async function geminiGenerate(parts: unknown[], schema?: unknown): Promise<string> {
  if (!geminiApiKey) throw new Error("Gemini is not configured (missing GEMINI_API_KEY)");

  const generationConfig: Record<string, unknown> = {
    temperature: 0.15,
    maxOutputTokens: 16384,
  };
  if (schema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = schema;
  }

  const doFetch = async (model: string): Promise<Response> => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      return await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiApiKey,
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig,
        }),
        signal: controller.signal,
      });
    } catch (e: any) {
      if (e?.name === "AbortError") throw new Error(`Gemini request timed out after 90s for model ${model} — try a smaller/clearer image or retry`);
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  };
  let res = await doFetch(MODEL);
  // Fallback if primary model is not available (404) — try lightweight variants
  // gemini-1.5-flash-8b was retired (404 for v1beta) so we chain through current Flash models
  if (res.status === 404) {
    for (const fallback of MODEL_FALLBACKS) {
      if (fallback === MODEL) continue;
      console.warn(`Primary model ${MODEL} 404, retrying with ${fallback}`);
      res = await doFetch(fallback);
      if (res.status !== 404) break;
    }
  }

  let payload: any;
  try {
    payload = await res.json();
  } catch {
    const txt = await res.text().catch(() => "");
    throw new Error(`Gemini returned non-JSON (${res.status}): ${txt.slice(0, 400)}`);
  }
  if (!res.ok) {
    const detail = payload?.error?.message ?? JSON.stringify(payload);
    throw new Error(detail);
  }
  if (!payload?.candidates || payload.candidates.length === 0) {
    const blockReason = payload?.promptFeedback?.blockReason ?? "unknown";
    const safety = payload?.promptFeedback ? JSON.stringify(payload.promptFeedback) : "";
    throw new Error(`Gemini returned no candidates (blocked: ${blockReason}) ${safety}`.trim());
  }
  const text = payload?.candidates?.[0]?.content?.parts
      ?.map((p: any) => (typeof p?.text === "string" ? p.text : ""))
      .join("") ?? "";
  if (!text.trim()) throw new Error("Gemini returned empty text");
  return text;
}

async function runOcr(base64: string, mimeType: string) {
  const raw = await geminiGenerate(
    [
      { inlineData: { mimeType, data: base64 } },
      { text: LAYOUT_PROMPT },
    ],
    LAYOUT_SCHEMA,
  );
  console.log(`[ocr] raw length ${raw.length}, preview: ${raw.slice(0, 400)}`);
  let parsed = normalizeLayout(raw);
  console.log(`[ocr] parsed blocks ${parsed.blocks.length}, text length ${parsed.text.length}`);
  // Fallback: if structured parsing yields empty (truncated JSON / hallucination filter),
  // retry once without schema as plain text, then wrap as paragraphs
  if (parsed.blocks.length === 0 && !parsed.text.trim()) {
    console.warn(`[ocr] empty structured result, retrying plain-text OCR`);
    const fallbackRaw = await geminiGenerate([
      { inlineData: { mimeType, data: base64 } },
      { text: `Extract ALL text from this document image verbatim. Preserve reading order, paragraphs, headings, lists, and tables. Keep original language (Bangla and/or English). Return plain text only, no JSON, no markdown.` },
    ]);
    const cleaned = sanitizeText(fallbackRaw);
    console.log(`[ocr] fallback raw length ${fallbackRaw.length}, cleaned ${cleaned.length}`);
    if (cleaned.trim() && !isHallucinated(cleaned)) {
      const paragraphs = cleaned.split(/\n+/).map((t) => t.trim()).filter(Boolean).filter((t) => !isHallucinated(t)).map((t) => ({ type: "paragraph" as const, text: t }));
      if (paragraphs.length) return { text: cleaned, blocks: paragraphs };
    }
    // if still empty, throw so caller can surface error instead of charging credit for empty
    throw new Error("OCR returned empty result (model returned no parsable text). Try a clearer image or Re-analyze layout.");
  }
  return parsed;
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
