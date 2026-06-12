import { NextRequest } from "next/server";
import { getGeminiClient } from "@/lib/gemini";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/ai-prompt";
import { normalizeSearchTerm, validateSearchTerm } from "@/lib/utils/normalization";
import { isBlocklisted } from "@/lib/constants/blocklist";
import { checkRateLimit } from "@/lib/rate-limit";
import { getWordBySlug, insertWord } from "@/lib/supabase-queries";

const MODEL = "gemini-2.5-flash";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<Response> {
  const { slug } = await params;

  const validation = validateSearchTerm(slug);
  if (!validation.valid) {
    return Response.json(
      { error: "validation_error", message: validation.error.message },
      { status: 400 }
    );
  }

  let normalizedSlug: string;
  try {
    normalizedSlug = normalizeSearchTerm(slug);
  } catch {
    return Response.json(
      { error: "validation_error", message: "Invalid search term." },
      { status: 400 }
    );
  }

  const found = await getWordBySlug(normalizedSlug);
  if (found) {
    return Response.json(found);
  }

  const ip =
    _request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    _request.headers.get("x-real-ip") ??
    "127.0.0.1";

  const { allowed, retryAfter } = await checkRateLimit(ip);
  if (!allowed) {
    return Response.json(
      { error: "rate_limited", message: "Too many requests. Please try again later.", retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  if (isBlocklisted(normalizedSlug)) {
    return Response.json(
      { error: "blocklisted", message: "This term cannot be looked up." },
      { status: 403 }
    );
  }

  let rawResponse: string;
  try {
    rawResponse = await generateDefinition(normalizedSlug);
  } catch (err) {
    console.error("AI generation failed:", err);
    return Response.json(
      { error: "ai_error", message: "Failed to generate definition. Please try again." },
      { status: 502 }
    );
  }

  const cleanJson = rawResponse
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleanJson);
  } catch {
    return Response.json(
      { error: "validation_error", message: "Failed to parse AI response." },
      { status: 500 }
    );
  }

  if (parsed.error === "not_found") {
    return Response.json(parsed);
  }

  if (
    !Array.isArray(parsed.senses) ||
    parsed.senses.length === 0 ||
    typeof parsed.word !== "string"
  ) {
    return Response.json(
      { error: "validation_error", message: "AI returned invalid data." },
      { status: 500 }
    );
  }

  const entry = await insertWord(
    normalizedSlug,
    parsed.word as string,
    "ai_generated",
    (parsed.senses as Array<{
      part_of_speech: string;
      meaning: string;
      synonyms: string[];
      examples: string[];
    }>).map((s) => ({
      part_of_speech: s.part_of_speech,
      meaning: s.meaning,
      synonyms: s.synonyms,
      examples: s.examples,
    }))
  );

  if (!entry) {
    return Response.json(
      { error: "validation_error", message: "Failed to save to database." },
      { status: 500 }
    );
  }

  return Response.json(entry);
}

async function generateDefinition(term: string): Promise<string> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: MODEL });

  const result = await model.generateContent({
    systemInstruction: SYSTEM_PROMPT,
    contents: [{ role: "user", parts: [{ text: buildUserPrompt(term) }] }],
  });

  const text = result.response.text();
  return text;
}
