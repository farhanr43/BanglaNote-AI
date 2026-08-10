import { AI_PROXY_URL, MESSAGES, PROMPTS } from '../constants';
import { AIActionType, LayoutResult, OcrResult, UsageSummary } from '../types';
import { authService } from './auth';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
export class CreditLimitError extends Error {
  isGuest: boolean;
  summary: UsageSummary | null;

  constructor(message: string, isGuest: boolean, summary: UsageSummary | null = null) {
    super(message);
    this.name = 'CreditLimitError';
    this.isGuest = isGuest;
    this.summary = summary;
  }
}

// ---------------------------------------------------------------------------
// Edge-function transport
// ---------------------------------------------------------------------------
const normalizeSummary = (summary: any): UsageSummary => {
  if (!summary || typeof summary !== 'object') {
    return { used: 0, limit: 0, remaining: 0, planId: '', planName: '', isGuest: true };
  }
  return {
    used: summary.used ?? 0,
    limit: summary.limit ?? 0,
    remaining: summary.remaining ?? 0,
    planId: summary.plan_id ?? summary.planId ?? '',
    planName: summary.plan_name ?? summary.planName ?? '',
    isGuest: summary.is_guest ?? summary.isGuest ?? false,
  };
};

async function edgeRequest(body: Record<string, unknown>): Promise<any> {
  const token = await authService.getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(AI_PROXY_URL, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch {
    throw new Error('Network error. Please check your internet connection.');
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (data && data.summary) data.summary = normalizeSummary(data.summary);

  if (!res.ok || data?.ok === false) {
    const code = data?.error?.code ?? 'UNKNOWN';
    if (code === 'LIMIT_REACHED') {
      const isGuest = !!data?.summary?.isGuest;
      throw new CreditLimitError(
        data?.error?.message ?? MESSAGES.SIGNIN_REQUIRED,
        isGuest,
        data?.summary ?? null,
      );
    }
    throw new Error(data?.error?.message ?? `Request failed (${res.status}).`);
  }

  return data;
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// ---------------------------------------------------------------------------
// OCR (charges 1 credit, backend-enforced)
// ---------------------------------------------------------------------------
export const processImage = async (base64Image: string, mimeType: string): Promise<OcrResult> => {
  const requestId = crypto.randomUUID();
  const data = await edgeRequest({
    mode: 'ocr',
    base64: base64Image,
    mimeType,
    requestId,
  });

  const layout: LayoutResult = data.layout ?? { text: data.text ?? '', blocks: [] };
  return {
    text: data.text ?? '',
    layout,
    summary: data.summary ?? { used: 0, limit: 0, remaining: 0, planId: '', planName: '', isGuest: true },
  };
};

// ---------------------------------------------------------------------------
// Text transforms (free, no credit)
// ---------------------------------------------------------------------------
export const promptForAction = (action: AIActionType): string => {
  switch (action) {
    case AIActionType.GRAMMAR:
      return PROMPTS.GRAMMAR;
    case AIActionType.FORMAT:
      return PROMPTS.FORMAT;
    case AIActionType.SUMMARY:
      return PROMPTS.SUMMARY;
    case AIActionType.TRANSLATE:
      return PROMPTS.TRANSLATE;
    case AIActionType.BULLETS:
      return PROMPTS.BULLETS;
    default:
      return PROMPTS.GRAMMAR;
  }
};

export const transformText = async (text: string, action: AIActionType): Promise<string> => {
  const prompt = promptForAction(action);
  const data = await edgeRequest({ mode: 'transform', text, prompt });
  return data.text ?? '';
};

// ---------------------------------------------------------------------------
// Usage peek (no deduction)
// ---------------------------------------------------------------------------
export const fetchUsage = async (): Promise<UsageSummary | null> => {
  try {
    const data = await edgeRequest({ mode: 'usage' });
    return data.summary ?? null;
  } catch (err) {
    if (err instanceof CreditLimitError) return err.summary;
    console.error('Failed to fetch usage:', err);
    return null;
  }
};
