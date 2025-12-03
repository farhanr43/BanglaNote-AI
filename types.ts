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