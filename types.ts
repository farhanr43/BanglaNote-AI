export interface Note {
  id: string;
  originalImage: string; // Base64 string
  extractedText: string;
  createdAt: number;
  fileName: string;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export enum AIActionType {
  OCR = 'OCR',
  GRAMMAR = 'GRAMMAR',
  FORMAT = 'FORMAT',
  SUMMARY = 'SUMMARY',
  TRANSLATE = 'TRANSLATE',
  BULLETS = 'BULLETS',
}

export interface ProcessingState {
  status: ProcessingStatus;
  message?: string;
}

export interface HistoryItem {
  id: string;
  previewText: string;
  date: string;
  fullText: string;
}

export interface FeedbackItem {
  id: string;
  name: string;
  message: string;
  date: string;
}

// ---------------------------------------------------------------------------
// Auth, plans & credits
// ---------------------------------------------------------------------------
export interface AuthUser {
  id: string;
  email: string;
}

export interface Plan {
  id: string;
  name: string;
  priceBdt: number;
  dailyOcrLimit: number;
  benefits: string[];
}

export interface UsageSummary {
  used: number;
  limit: number;
  remaining: number;
  planId: string;
  planName: string;
  isGuest: boolean;
}

// ---------------------------------------------------------------------------
// Layout-aware OCR
// ---------------------------------------------------------------------------
export type LayoutBlockType =
  | 'heading'
  | 'paragraph'
  | 'bullet'
  | 'numbered'
  | 'table'
  | 'equation';

export type AlignmentType = 'left' | 'center' | 'right' | 'justify';

export interface LayoutBlock {
  type: LayoutBlockType;
  text?: string;
  level?: number;             // 1..3 for headings
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  alignment?: AlignmentType;
  items?: string[];           // bullet / numbered
  rows?: string[][];          // table
}

export interface LayoutResult {
  text: string;
  blocks: LayoutBlock[];
}

export interface OcrResult {
  text: string;
  layout: LayoutResult;
  summary: UsageSummary;
}

export interface SubscriptionRequest {
  id: string;
  userEmail?: string;
  planId: string;
  createdAt: string;
}
