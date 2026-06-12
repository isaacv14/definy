import { GoogleGenerativeAI } from "@google/generative-ai";

let _client: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing Gemini API key. Set GEMINI_API_KEY environment variable."
      );
    }
    _client = new GoogleGenerativeAI(apiKey);
  }
  return _client;
}
