# Definy

**A web-based English dictionary for intermediate learners (A2-B1 level) that generates word definitions on-demand using Claude AI and caches them in Postgres.**

---

## Quick Start

### Prerequisites
- Node.js 18+ and pnpm
- Supabase project (for database)
- Google Gemini API key

### Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repo-url>
   cd definy-dictionary
   pnpm install
   ```

2. **Set up environment variables** (`.env.local`):
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   GEMINI_API_KEY=your-gemini-api-key
   SITE_URL=http://localhost:3000
   ```
   See [`.env.example`](.env.example) for the full list.

3. **Initialize the database:**
   Run the migration script in `supabase/migrations/001_create_words.sql` against your Supabase project via the SQL editor or Supabase CLI.

4. **Run development server:**
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
lib/
├── types/
│   └── index.ts              # Shared TypeScript types (WordEntry, WordSense, etc.)
├── utils/
│   ├── normalization.ts      # Input validation & slugification
│   ├── synonyms.ts           # Synonym link generation
│   ├── recent-words.ts       # Recently-added words utilities
│   └── ...
├── constants/
│   └── blocklist.ts          # Prohibited terms
└── index.ts                  # Barrel exports

app/
├── api/
│   ├── word/[slug]
│   │   └── route.ts          # Main API endpoint (Agent 1)
│   └── words/
│       └── recent.ts         # Recently-added words endpoint
├── word/[slug]
│   └── page.tsx              # Word detail page (Agent 2)
├── page.tsx                  # Home page (Agent 2)
└── layout.tsx

__tests__/
├── lib/
│   ├── normalization.test.ts # Input validation tests
│   └── blocklist.test.ts     # Blocklist & synonym tests
└── api/
    └── word.test.ts          # API contract & edge cases

jest.config.js               # Test configuration
```

---

## Architecture & Data Flow

### Shared Contract (All Agents)

All three agents build against this contract — if you need to change it, coordinate with the team.

#### TypeScript Types
```typescript
type WordSense = {
  part_of_speech: string;   // "noun", "verb", "adjective", etc.
  meaning: string;          // Single sentence, A2-B1 level
  synonyms: string[];       // 3-5 items
  examples: string[];       // 1-2 natural sentences
};

type WordEntry = {
  slug: string;             // normalized lowercase, used in URL
  word: string;             // display form
  source: "ai_generated" | "verified";
  created_at: string;
  senses: WordSense[];
};
```

#### Database Schema (Postgres / Supabase)

**Table: `words`**
```sql
CREATE TABLE words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  word TEXT NOT NULL,
  source TEXT CHECK (source IN ('ai_generated', 'verified')),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Table: `word_senses`**
```sql
CREATE TABLE word_senses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word_id UUID NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  part_of_speech TEXT NOT NULL,
  meaning TEXT NOT NULL,
  synonyms JSONB,
  examples JSONB,
  order_index INT DEFAULT 0
);
```

#### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/word/[slug]` | GET/POST | Lookup or generate definition |
| `/api/words/recent` | GET | Fetch recently-added words |
| `/sitemap.xml` | GET | Dynamic sitemap for SEO |

---

## Page Template (Word Page UI)

Each word page must follow this exact structure, based on the template below:

```
[Word] [part of speech]
Meaning: [clear, learner-friendly definition]
Synonyms: [synonym1], [synonym2], [synonym3], [synonym4]
Example:
- "[Example sentence using the word naturally]"
```

Example output:

```
Discoverable adjective
Meaning: Able to be found or noticed, especially when searching for information.
Synonyms: findable, searchable, accessible, traceable
Example:
- "Make sure your project is discoverable by adding good keywords and tags."
```

### UI requirements
- Word displayed prominently (large heading), part of speech as a small tag/label next to it.
- "Meaning" section: one clear sentence, written in simple English suitable for A2-B1 learners (avoid circular definitions — don't define a word using harder vocabulary than the word itself).
- "Synonyms": 3-5 synonyms, displayed as a list or comma-separated tags. Each synonym should ideally link to its own word page (if it exists, or trigger generation on click).
- "Example": at least one natural example sentence in a real-world context, formatted as a quote/bullet.
- If a word has multiple senses/parts of speech (e.g., "run" as a verb and as a noun), display each sense as its own block, all on the same page.
- Include a search bar at the top of every page so users can immediately look up another word.

---

## Data Flow / Architecture

1. **Search input** → normalize the input:
   - Trim whitespace, lowercase, strip punctuation.
   - Validate it looks like a real word/phrase (basic regex check — letters, hyphens, spaces only, reasonable length).
2. **Database lookup**: query the `words` table for a matching `slug` (normalized term).
3. **If found**: render the page from stored data.
4. **If not found**:
   - Show a loading/generating state ("Generating definition for '[word]'...").
   - Call the AI generation function (see prompt below) to get structured JSON.
   - Validate the JSON response (check required fields are present and non-empty).
   - Insert the new record into the `words` table.
   - Render the new page.
5. **Rate limiting / abuse prevention**:
   - Limit generation requests per IP per time window (e.g., 20/hour) to control API costs.
   - Reject inputs that fail the word-format validation before calling the AI.
   - Optionally: maintain a blocklist for offensive/spam terms.

---

## Database Schema (suggested)

Table: `words`

| Column | Type | Notes |
|---|---|---|
| id | uuid / serial | primary key |
| slug | text, unique, indexed | normalized lowercase term, used in URL |
| word | text | display form (proper casing) |
| created_at | timestamp | |
| source | text | "ai_generated" or "verified" — useful for later quality flags |

Table: `word_senses` (one word can have multiple senses/parts of speech)

| Column | Type | Notes |
|---|---|---|
| id | uuid / serial | primary key |
| word_id | foreign key → words.id | |
| part_of_speech | text | e.g., "noun", "verb", "adjective" |
| meaning | text | the definition |
| synonyms | text[] or jsonb | array of synonym strings |
| examples | text[] or jsonb | array of example sentences |
| order_index | int | display order if multiple senses |

This separation allows a word page to render multiple senses cleanly and lets synonyms/examples be queried or edited independently.

---

## AI Definition Generation Sub-Prompt

This is the prompt the backend sends to the Anthropic API when a word is not found in the database. It must return **strict JSON only** (no preamble, no markdown fences) so it can be parsed directly and inserted into the database.

### System prompt for the generation call:

```
You are a dictionary content generator for an English-learning website aimed at learners around A2-B1 level (intermediate beginners). 

Given a single English word or short phrase, return a JSON object with this exact structure and nothing else (no markdown, no commentary, no code fences):

{
  "word": "string - the term, properly capitalized if it's a proper noun, otherwise lowercase",
  "senses": [
    {
      "part_of_speech": "string - e.g. noun, verb, adjective, adverb, phrasal verb, idiom",
      "meaning": "string - one clear sentence, using simple vocabulary appropriate for A2-B1 English learners. Avoid defining the word using more advanced vocabulary than the word itself.",
      "synonyms": ["array", "of", "3 to 5 synonym strings", "appropriate for the same level"],
      "examples": ["array of 1 to 2 natural example sentences showing the word used in realistic, everyday context"]
    }
  ]
}

Rules:
- If the term has multiple common senses or parts of speech, include each as a separate object in the "senses" array (most common/frequent sense first).
- If the term is not a real English word, a misspelling, or nonsensical, return: {"error": "not_found", "suggestion": "closest real word if applicable, otherwise null"}
- Do not invent obscure or archaic meanings unless they are the primary meaning of the term.
- Keep "meaning" to a single sentence.
- Example sentences must be natural, modern, and useful for someone learning practical English.
- Return valid JSON only. Do not wrap the response in backticks or add any explanatory text.
```

### User message for the generation call:
```
Word: "{normalized_input_term}"
```

### Backend handling of the response:
1. Parse the JSON. Strip any accidental markdown code fences before parsing (defensive coding).
2. If the response contains `"error": "not_found"`:
   - Show the user a "Word not found" page.
   - If `suggestion` is non-null, offer a "Did you mean [suggestion]?" link.
   - Do NOT save anything to the database.
3. If valid, insert one row into `words` and one row per item in `senses` into `word_senses`.
4. Render the new page using the same template as existing pages.

---

## Utilities & Support Features (Agent 3)

### Input Validation & Normalization

All search inputs are normalized and validated before processing. Use the shared utilities:

```typescript
import { normalizeSearchTerm, validateSearchTerm, slugify } from '@/lib';

// Normalize input (throws ValidationError if invalid)
const slug = normalizeSearchTerm("Hello World!");  // → "hello-world"

// Validate without throwing
const result = validateSearchTerm("test@invalid");
if (!result.valid) {
  console.error(result.error.code);  // → "invalid_characters"
}

// Slugify is an alias for normalizeSearchTerm
const slug2 = slugify("Well-Known");  // → "well-known"
```

**Validation Rules:**
- Length: 1–100 characters
- Valid characters: `[a-zA-Z0-9 \-']` (letters, numbers, spaces, hyphens, apostrophes)
- Special characters, punctuation, and symbols are rejected
- SQL/XSS injection attempts are blocked at the input stage

### Blocklist

Terms that should never trigger AI generation are blocked before any API call:

```typescript
import { isBlocklisted, blockTerm, unblockTerm } from '@/lib';

if (isBlocklisted(userInput)) {
  return { status: 403, error: "This term cannot be looked up" };
}

// Dynamically manage the blocklist if needed
blockTerm("myoffensiveterm");
unblockTerm("myoffensiveterm");
```

**Current blocklist includes:**
- Explicit/offensive language
- Adult/NSFW keywords
- Common spam patterns (e.g., "aaaa", "test123")
- Basic SQL/command injection markers (defensive)

### Synonym Linking

Convert synonyms into clickable word links:

```typescript
import { generateSynonymLinks } from '@/lib';

const links = generateSynonymLinks(["findable", "searchable", "accessible"]);
// →
// [
//   { text: "findable", slug: "findable", href: "/word/findable" },
//   { text: "searchable", slug: "searchable", href: "/word/searchable" },
//   { text: "accessible", slug: "accessible", href: "/word/accessible" }
// ]
```

### Recently-Added Words

Fetch and display the N most recently added words on the home page:

```typescript
import { getRecentlyAddedWords, formatRecentWord } from '@/lib';

const recent = await getRecentlyAddedWords(10);
recent.forEach(word => {
  const formatted = formatRecentWord(word);
  console.log(`${formatted.title}: ${formatted.description}`);
});
```

---

## Testing

Tests are located in `__tests__/` and cover utilities, API contracts, and edge cases.

### Running Tests

```bash
# Install test dependencies (one-time)
pnpm install

# Run all tests
pnpm test

# Run in watch mode
pnpm test:watch

# Run specific test file
pnpm test normalization.test.ts

# Run with coverage
pnpm test --coverage
```

### Test Suites

| File | Coverage | Purpose |
|------|----------|---------|
| `__tests__/lib/normalization.test.ts` | Input validation, normalization, edge cases | Validates all search input handling |
| `__tests__/lib/blocklist.test.ts` | Blocklist management, synonym linking | Tests prohibited terms and link generation |
| `__tests__/api/word.test.ts` | API contract, error scenarios, response formats | Documents expected API behavior |

### What Tests Cover

- ✅ Valid and invalid search inputs
- ✅ Whitespace handling, special characters
- ✅ Rate limiting scenarios (conceptual)
- ✅ Database lookup vs. generation flows
- ✅ AI response validation (JSON parsing, error handling)
- ✅ Blocklisted terms
- ✅ Multi-sense word handling
- ✅ Synonym link generation
- ✅ API response formats (200, 201, 400, 403, 404, 429, 500)

---

## Development Workflow

### For Agent 1 (Backend & Database) ✅ Complete
- `/api/word/[slug]` endpoint → `app/api/word/[slug]/route.ts`
- Supabase schema → `supabase/migrations/001_create_words.sql`
- Gemini AI integration → `lib/gemini.ts`, `lib/ai-prompt.ts`
- Rate limiting (per-IP, 20 req/h) → `lib/rate-limit.ts`
- Input validation via shared `lib/utils/normalization.ts`
- Blocklist check via `lib/constants/blocklist.ts`
- Dynamic sitemap → `app/sitemap.ts`
- DB query layer → `lib/supabase-queries.ts`

### For Agent 2 (Frontend & UI)
- Build `/word/[slug]` page component
- Implement home page with search bar
- Create synonym tag components (use `generateSynonymLinks`)
- Fetch data from `/api/word/[slug]` (mock initially, real calls once Agent 1 is ready)
- Add SEO metadata and ISR caching

### For Agent 3 (Supporting Features)
- ✅ Provided `normalizeSearchTerm()` and `slugify()`
- ✅ Provided `isBlocklisted()` and blocklist management
- ✅ Provided `generateSynonymLinks()`
- ✅ Created test suite with edge cases
- ⏳ **Next steps:** Help debug integration issues, add more tests as needed, polish documentation

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL (server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-only) |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `SITE_URL` | No | Base URL for sitemap generation (default: `http://localhost:3000`) |

---

## Deployment

### To Vercel
```bash
vercel
```

Vercel will auto-detect Next.js and deploy. Ensure all env vars are set in Vercel project settings.

### To Other Platforms
- Ensure Node.js runtime supports 18+
- Build: `pnpm build`
- Start: `pnpm start`
- Database must be accessible from your hosting environment

---

## Resources & References

- **Next.js Docs:** [nextjs.org](https://nextjs.org)
- **Supabase Docs:** [supabase.com/docs](https://supabase.com/docs)
- **Gemini API:** [ai.google.dev](https://ai.google.dev)
- **Project Brief:** See [agent-division.md](agent-division.md) for the original parallel work division

---

## License

This project is provided as-is for educational purposes.

## Support

For questions or issues:
1. Check the test files for usage examples
2. Review the shared contract in [agent-division.md](agent-division.md)
3. Consult individual agent documentation (when available)

---

**Last Updated:** June 2026  
**Agent 1 Contribution:** Backend API, Supabase integration, AI generation pipeline, rate limiting, sitemap  
**Agent 3 Contribution:** Input validation utilities, blocklist, synonym linking, comprehensive test suite

- Each word page should have dynamic `<title>` and `<meta description>` tags generated from the word and its primary meaning (e.g., "Discoverable - Meaning, Synonyms & Examples | [SiteName]").
- Implement a dynamic sitemap (`/sitemap.xml`) that includes all words currently in the database, updated as new words are added.
- Use `generateStaticParams` or ISR (Incremental Static Regeneration) in Next.js so AI-generated pages become statically cached after first generation — this avoids repeated AI calls for the same word and improves load speed for future visitors.

---

## Suggested Build Order

1. Set up Next.js project + Supabase project, create `words` and `word_senses` tables.
2. Build the static word page UI component using hardcoded mock data matching the template above.
3. Build the search bar + routing to `/word/[term]`.
4. Implement database lookup logic (found → render; not found → placeholder).
5. Integrate the Anthropic API call with the generation prompt above; parse and validate JSON.
6. Wire up the "not found → generate → save → render" flow end-to-end.
7. Add rate limiting and input validation.
8. Add SEO metadata and sitemap generation.
9. Polish UI (loading states, synonym linking, responsive design).
