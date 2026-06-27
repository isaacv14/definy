/**
 * Shared TypeScript types for the Definy project.
 * These match the contract defined in agent-division.md
 */

export type WordSense = {
  part_of_speech: string; // "noun", "verb", "adjective", etc.
  meaning: string;
  synonyms: string[]; // 3-5 items
  examples: string[]; // 1-2 items
};

export type WordEntry = {
  slug: string; // normalized lowercase, used in URL
  word: string; // display form
  source: "ai_generated" | "verified";
  created_at: string;
  senses: WordSense[];
};

export type WordEntryInput = Omit<WordEntry, "created_at" | "source">;

export type AIGenerationError = {
  error: "not_found" | "invalid_format" | "server_error";
  suggestion?: string | null;
};

export type ValidationError = {
  code:
    | "empty_input"
    | "too_short"
    | "too_long"
    | "invalid_characters"
    | "blocklisted";
  message: string;
};

export type ApiError = {
  error: "not_found" | "validation_error" | "rate_limited" | "blocklisted";
  suggestion?: string | null;
  message?: string;
  retryAfter?: number;
};

export type ApiResponse = WordEntry | ApiError;
