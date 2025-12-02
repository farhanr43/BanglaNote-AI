import { GoogleGenAI } from "@google/genai";
import { PROMPTS } from "../constants";
import { AIActionType } from "../types";

// Initialize Gemini Client
// In a real production app, you might proxy this through a backend to hide the key,
// but for this specific request (SPA), we use the environment variable directly.
const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Converts a File object to a Base64 string usable by Gemini
 */
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64," or "data:application/pdf;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Main function to handle Image/PDF OCR
 */
export const processImage = async (base64Data: string, mimeType: string): Promise<string> => {
  try {
    const ai = getClient();
    // Using gemini-2.5-flash for speed and efficiency with vision/document tasks
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            },
          },
          {
            text: PROMPTS.OCR,
          },
        ],
      },
    });

    return response.text || "";
  } catch (error) {
    console.error("Gemini OCR Error:", error);
    throw error;
  }
};

/**
 * Handles text-to-text transformations (Summary, Translate, etc.)
 */
export const transformText = async (text: string, action: AIActionType): Promise<string> => {
  try {
    const ai = getClient();
    let prompt = "";

    switch (action) {
      case AIActionType.GRAMMAR:
        prompt = PROMPTS.GRAMMAR;
        break;
      case AIActionType.FORMAT:
        prompt = PROMPTS.FORMAT;
        break;
      case AIActionType.SUMMARY:
        prompt = PROMPTS.SUMMARY;
        break;
      case AIActionType.TRANSLATE:
        prompt = PROMPTS.TRANSLATE;
        break;
      case AIActionType.BULLETS:
        prompt = PROMPTS.BULLETS;
        break;
      default:
        return text;
    }

    // Using gemini-2.5-flash for text processing as well
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${prompt}\n\n---\n\n${text}`,
    });

    return response.text || "";
  } catch (error) {
    console.error("Gemini Text Transformation Error:", error);
    throw error;
  }
};