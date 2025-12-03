// Prompts specifically tuned for Gemini models
export const PROMPTS = {
  OCR: `Extract all Bangla and English handwritten text from this document. 
  - Maintain paragraph structure, titles, bullets, numbering, and mathematical symbols exactly as they appear.
  - Do not add any introductory or concluding remarks.
  - Return ONLY the extracted text.`,

  GRAMMAR: `Fix spacing, punctuation, and format the following Bangla text into clean writing without changing the meaning. 
  - Correct any obvious OCR errors.
  - Ensure proper sentence termination.
  - Return ONLY the corrected text.`,

  FORMAT: `Reformat the following Bangla text into a clean, structured note format.
  - Use appropriate headers and paragraph breaks.
  - Fix indentation.
  - Return ONLY the formatted text.`,

  SUMMARY: `Summarize the following Bangla text into simple, easy-to-read study notes.
  - Use bullet points for key concepts.
  - Keep the language simple and clear.`,

  TRANSLATE: `Translate the following Bangla text into clear, professional English.`,

  BULLETS: `Convert the following text into a concise bullet-point list.`,
};

export const MOCK_HISTORY_KEY = 'banglanote_history';
export const FEEDBACK_STORAGE_KEY = 'banglanote_feedback';