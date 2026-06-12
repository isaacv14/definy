# AI Dictionary Project — Parallel Work Division (3 Agents)

This splits the project so 3 AI dev agents can work simultaneously with minimal blocking. **Read the "Shared Contract" section first and send it to ALL THREE agents** — it's the glue that lets them work independently and merge cleanly later.

---

## Shared Contract (send to all 3 agents)

All agents must agree on this before starting, so their pieces fit together without rework.

### Data shapes (TypeScript types)

```typescript
type WordSense = {
  part_of_speech: string; // "noun", "verb", "adjective", etc.
  meaning: string;
  synonyms: string[];     // 3-5 items
  examples: string[];     // 1-2 items
};

type WordEntry = {
  slug: string;           // normalized lowercase, used in URL
  word: string;           // display form
  source: "ai_generated" | "verified";
  created_at: string;
  senses: WordSense[];
};
```

### Database tables (Postgres / Supabase)

- `words(id, slug UNIQUE, word, source, created_at)`
- `word_senses(id, word_id FK, part_of_speech, meaning, synonyms jsonb, examples jsonb, order_index)`

### Route structure

- `/word/[slug]` — word detail page
- `/api/word/[slug]` — backend endpoint: returns `WordEntry` JSON if found, triggers AI generation + save if not found, returns `{error: "not_found", suggestion?: string}` if AI says it's not a real word
- `/sitemap.xml` — dynamic sitemap

### AI generation contract

Input: `{ term: string }`
Output: either a `WordEntry`-shaped object (without `created_at`/`source`, which the backend fills in) or `{ error: "not_found", suggestion: string | null }`

As long as everyone builds against these shapes, the pieces can be developed against mocks and integrated later without major rewrites.

---

## Agent 1 (Senior) — Backend, Database & AI Integration

**Owns**: everything server-side related to data and AI generation. This is the "engine" of the project.

### Scope
- Set up Supabase project, create `words` and `word_senses` tables per the shared schema.
- Build `/api/word/[slug]` endpoint:
  - Normalize incoming term (lowercase, trim, strip punctuation, basic format validation).
  - Look up `slug` in `words` table.
  - If found → return `WordEntry` JSON (joining `words` + `word_senses`).
  - If not found → call Anthropic API with the generation prompt (provided separately), validate/parse the JSON response, insert into both tables, return the new `WordEntry`.
  - If AI returns `{error: "not_found"}` → return that to the client without writing to DB.
- Implement rate limiting (e.g., per-IP, 20 requests/hour) on the generation path specifically (lookups of existing words should NOT be rate-limited).
- Implement input validation/blocklist for spam or offensive terms before calling the AI.
- Write the dynamic sitemap generator (`/sitemap.xml`) pulling all slugs from `words`.

### Deliverables
- Working Supabase schema + migration scripts.
- `/api/word/[slug]` endpoint, fully functional end-to-end (lookup → generate → save → return).
- Sitemap endpoint.
- Brief README documenting env vars (Supabase keys, Anthropic API key) and how to run locally.

### Dependencies
- None to start — can build against the shared contract using mock AI responses while waiting on the exact generation prompt finalization.

---

## Agent 2 (Senior) — Frontend UI & Page Templates

**Owns**: everything the user sees and interacts with.

### Scope
- Next.js App Router setup (if not already scaffolded by Agent 1 — coordinate on repo structure early).
- Build the `/word/[slug]` page component matching the template:
  - Word as large heading + part-of-speech tag.
  - One block per "sense" (meaning, synonyms, examples) if multiple senses exist.
  - Synonyms rendered as clickable tags linking to `/word/[synonym-slug]`.
  - Example sentences as styled quote/bullet blocks.
  - Loading state for when a page is being generated for the first time ("Generating definition for '[word]'...").
  - "Not found" state with optional "Did you mean [suggestion]?" link.
- Build the search bar component (present on every page) that navigates to `/word/[slug]` on submit.
- Home page: simple landing with the search bar as the focal point, plus maybe a "word of the day" or recently-added words list (nice-to-have).
- Wire pages to call `/api/word/[slug]` (Agent 1's endpoint) for data — while Agent 1 finishes the backend, build against a mock JSON matching the `WordEntry` type.
- Implement SEO metadata: dynamic `<title>` and `<meta description>` per word page using `generateMetadata`.
- Apply ISR (`revalidate` config or `generateStaticParams`) so generated pages get cached.

### Deliverables
- Fully styled, responsive `/word/[slug]` page and home page.
- Search bar component, reusable across pages.
- Mock data file matching `WordEntry` type for development before backend is ready.
- SEO metadata wired up.

### Dependencies
- Needs the shared contract (data shapes) — provided above, can start immediately with mocks.
- Final integration point: swapping mock data fetch for real call to `/api/word/[slug]` once Agent 1's endpoint is live.

---

## Agent 3 (Semi-Senior) — Supporting Features, Validation & Polish

**Owns**: the smaller, well-scoped pieces that support the other two agents without being on the critical path.

### Scope
- **Input normalization/validation utility**: a shared function (used by both frontend and backend) that takes raw search input and returns either a normalized slug or a validation error (e.g., "too short", "contains invalid characters"). Should be written so both Agent 1 and Agent 2 can import it.
- **Blocklist**: compile and maintain a list of terms that should never trigger AI generation (offensive terms, spam patterns), exposed as a simple array/JSON file Agent 1's endpoint can check against.
- **Synonym-linking logic**: given a `WordEntry`'s synonyms array, generate the correct `/word/[slug]` links (handle multi-word synonyms, special characters, etc.) — a small utility function used by Agent 2's page component.
- **Recently-added words feature**: simple query/component showing the last N words added to the database (for the home page nice-to-have Agent 2 mentioned).
- **Testing**: write basic tests for the normalization utility, the API endpoint's edge cases (empty input, very long input, special characters, word not found), and a few snapshot/render tests for the word page component.
- **Documentation polish**: consolidate setup instructions from Agents 1 & 2 into a single top-level README once both are stable.

### Deliverables
- Shared `normalizeSearchTerm()` and `slugify()` utilities (small package or shared `/lib` file).
- Blocklist file + integration point documented for Agent 1.
- Synonym-link utility integrated into Agent 2's component.
- Recently-added words component.
- Test suite covering the above.
- Final consolidated README.

### Dependencies
- The normalization utility should be written FIRST and shared early — both other agents depend on it, so this agent should prioritize that piece in the first work session.
- Everything else (blocklist, synonym links, recently-added, tests) can proceed in parallel once the data shapes are confirmed.

---

## Suggested Coordination Points (sync checkpoints)

1. **Kickoff**: all three agents confirm the shared contract (data shapes, routes, schema) — adjust now if anyone sees a problem, since changing it later is costly.
2. **Checkpoint 1**: Agent 3 delivers `normalizeSearchTerm()`/`slugify()` — Agents 1 & 2 integrate it.
3. **Checkpoint 2**: Agent 1's `/api/word/[slug]` is live — Agent 2 swaps mocks for real calls.
4. **Final integration**: merge all branches, run Agent 3's test suite against the integrated app, fix any contract mismatches.
