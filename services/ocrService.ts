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

  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 45000);
  let res: Response;
  try {
    res = await fetch(AI_PROXY_URL, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('OCR timed out. Please try a smaller or clearer image.');
    throw new Error('Network error. Please check your internet connection.');
  } finally {
    clearTimeout(to);
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
// File helpers — with client-side compression for speed
// ---------------------------------------------------------------------------
export const fileToGenerativePart = async (file: File): Promise<string> => {
  const { base64 } = await prepareFileForOCR(file);
  return base64;
};

// Compress images to ~1600px / JPEG 0.82 to cut upload + Gemini latency by ~60%
// Falls back to original file on any canvas error
export const prepareFileForOCR = async (file: File): Promise<{ base64: string; mimeType: string }> => {
  const readOriginal = async (): Promise<{ base64: string; mimeType: string }> => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve((r.result as string).split(',')[1]);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    return { base64, mimeType: file.type };
  };
  if (file.type === 'application/pdf' || !file.type.startsWith('image/')) return readOriginal();
  if (file.size < 700 * 1024) return readOriginal();
  try {
    const objectUrl = URL.createObjectURL(file);
    const bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image load failed'));
      img.src = objectUrl;
    });
    const maxSide = 1600;
    let { width, height } = bitmap;
    if (width > maxSide || height > maxSide) {
      const scale = Math.min(maxSide / width, maxSide / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      URL.revokeObjectURL(objectUrl);
      return readOriginal();
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    URL.revokeObjectURL(objectUrl);
    if (!dataUrl || dataUrl.length < 100) return readOriginal();
    return { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' };
  } catch {
    return readOriginal();
  }
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
