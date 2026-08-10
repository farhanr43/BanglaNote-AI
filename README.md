## ✍️ BanglaNote AI

BanglaNote AI is a web application that converts Bangla handwritten notes into clean, editable digital text — making note digitization fast and effortless.

🌐 Live Demo: https://bangla-note-ai.vercel.app/

## 🚀 Features

📤 Upload Bangla handwritten notes (image-based)

⚡ Instantly convert handwriting to Bangla text

🧹 Automatic formatting & paragraph correction

✏️ Edit extracted text easily

📄 Export output as PDF, DOCX, or TXT

## 🎯 Who Is It For?

🎓 Students

👩‍🏫 Teachers

📝 Researchers

📚 Anyone who wants to digitize Bangla handwritten notes


## 📸 How It Works

Upload a handwritten Bangla note

AI processes and extracts the text

Auto-formatting improves readability

Edit if needed

Export in your preferred format

---

## 🔐 Accounts, Credits & Plans

- **Guest** — up to **3 OCR requests per IP/day** without an account. The 4th attempt asks you to log in.
- **Free** (automatic on signup) — **10 OCR credits/day**, resets daily.
- **Standard** — ৳50/month → **50 OCR credits/day**.
- **Premium** — ৳100/month → **100 OCR credits/day**.

Limits are enforced **server-side** (Supabase Edge Functions + Postgres RPCs), never just in the browser. One credit is deducted only when an OCR request succeeds, and a unique `request_id` prevents duplicate deductions. Subscriptions are currently **granted by the admin** (via the Admin panel); a payment gateway can be wired in later.

## 🧾 Editable DOCX Export

Before extraction, Gemini analyzes the image's layout (headings, paragraphs, bullets, numbering, tables, equations, bold/italic, alignment). The **Formatted Preview** mirrors that structure, and **Export as Word (.docx)** produces a real, editable `.docx` built from proper Word elements — not a flattened image.

## 🛠️ Local Setup & Deployment

### 1. Database + Edge Functions (Supabase)

Requires the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref qfuzcgdkzcjwfrkfdsvx
supabase db push                 # applies supabase/migrations/0001_auth_credits.sql
supabase secrets set SUPABASE_URL=https://qfuzcgdkzcjwfrkfdsvx.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=<service_role key> \
  GEMINI_API_KEY=<Google AI Studio key> \
  ADMIN_TOKEN=<a strong admin secret>
supabase functions deploy ai-proxy --no-verify-jwt
supabase functions deploy admin-grant --no-verify-jwt
```

### 2. Frontend (Vercel)

Set build env vars (no Gemini key is ever exposed to the browser):

```
VITE_EDGE_FUNCTION_URL=https://qfuzcgdkzcjwfrkfdsvx.functions.supabase.co/ai-proxy
VITE_ADMIN_TOKEN=<same strong admin secret as ADMIN_TOKEN>
```

### Google sign-in (optional)

The app uses **Supabase Google OAuth** (redirect flow — no client secrets in the browser):

1. In Google Cloud Console create an OAuth 2.0 Client ID (Web application) with these Authorized redirect URIs:
   - `https://qfuzcgdkzcjwfrkfdsvx.supabase.co/auth/v1/callback`
   - `https://bangla-note-ai.vercel.app/auth/v1/callback` (plus any local/dev URL)
2. In Supabase Dashboard → **Authentication → Providers** → enable **Google** and paste the Client ID + Secret.
3. In Supabase Dashboard → **Authentication → URL Configuration**, add your site URL and the same redirect URLs under **Redirect URLs**.
4. No frontend code changes needed — the `Continue with Google` button in the auth modal already uses `signInWithOAuth` and picks up the session automatically on return.


### 3. Admin access

- Admin panel login is at the footer → **Admin** (default demo credentials).
- To make a user an admin: `supabase db push` first, then
  `update public.profiles set is_admin = true where id = '<auth.users id>';` (not currently used by the demo login, reserved for future hardening).

> **Security note:** the client-side admin login and `VITE_ADMIN_TOKEN` are demo-grade. For production, gate `admin-grant` behind real admin authentication and protect it from public exposure.

## ⚠️ Known limits

- Edge-function request bodies are capped (~10 MB); very large files should be split or the upload limit lowered in `UploadZone.tsx`.
- Very large notes may hit Gemini output-length limits; the preview/editor shows what was extracted.

