import { Plan } from './types';

// Prompts specifically tuned for Gemini models (text transforms run server-side)
export const PROMPTS = {
  OCR: `Extract all text (Bangla and English) from this document. 
  - Maintain paragraph structure, titles, bullets, numbering, and mathematical symbols exactly as they appear.
  - Do not add any introductory or concluding remarks.
  - Return ONLY the extracted text.`,

  GRAMMAR: `Fix spacing, punctuation, and format the following text (Bangla/English) into clean writing without changing the meaning. 
  - Correct any obvious OCR errors.
  - Ensure proper sentence termination.
  - Return ONLY the corrected text.`,

  FORMAT: `Reformat the following text into a clean, structured note format.
  - Use appropriate headers and paragraph breaks.
  - Fix indentation.
  - Return ONLY the formatted text.`,

  SUMMARY: `Summarize the following text into simple, easy-to-read study notes.
  - Use bullet points for key concepts.
  - Keep the language simple and clear.`,

  TRANSLATE: `Translate the following text into clear, professional English.`,

  BULLETS: `Convert the following text into a concise bullet-point list.`,
};

export const MOCK_HISTORY_KEY = 'banglanote_history';

// ---------------------------------------------------------------------------
// Auth, plans & credits
// ---------------------------------------------------------------------------
export const GUEST_OCR_LIMIT = 3;

export const SUPABASE_PROJECT_URL = 'https://qfuzcgdkzcjwfrkfdsvx.supabase.co';
export const AI_PROXY_URL =
  (import.meta.env.VITE_EDGE_FUNCTION_URL as string) ||
  `${SUPABASE_PROJECT_URL}/functions/v1/ai-proxy`;
export const ADMIN_GRANT_URL = `${SUPABASE_PROJECT_URL}/functions/v1/admin-grant`;
export const ADMIN_TOKEN = (import.meta.env.VITE_ADMIN_TOKEN as string) || '';

// Mirrors the seeded `plans` table; used for pricing UI only.
// The backend (plans table) remains the source of truth for limits.
export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    priceBdt: 0,
    dailyOcrLimit: 10,
    benefits: ['10 OCR credits per day', 'Text / TXT export', 'PDF & image upload'],
  },
  {
    id: 'standard',
    name: 'Standard',
    priceBdt: 50,
    dailyOcrLimit: 50,
    benefits: ['50 OCR credits per day', 'Editable DOCX export', 'Layout-aware preview', 'Priority support'],
  },
  {
    id: 'premium',
    name: 'Premium',
    priceBdt: 100,
    dailyOcrLimit: 100,
    benefits: ['100 OCR credits per day', 'Editable DOCX export', 'Layout-aware preview', 'Priority support'],
  },
];

export const MESSAGES = {
  GUEST_LIMIT_REACHED:
    "You've used your 3 free OCR attempts. Please log in or create a free account to continue.",
  USER_LIMIT_REACHED:
    "You've used all your OCR credits for today. Your limit resets daily. Please log in or upgrade your plan to continue.",
  OCR_FAILED: 'Failed to process file. Please try again.',
  AI_FAILED: 'AI Processing failed.',
  SIGNIN_REQUIRED: 'Please log in or create a free account to continue.',
};
