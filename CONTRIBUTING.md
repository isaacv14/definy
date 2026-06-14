# Contributing to AI English Dictionary

This document helps developers understand the project structure and how to use the shared utilities.

---

## Importing Utilities

All utilities are exported from `@/lib` for easy importing:

```typescript
import {
  normalizeSearchTerm,
  slugify,
  validateSearchTerm,
  isBlocklisted,
  generateSynonymLinks,
  getRecentlyAddedWords,
  // Types
  WordEntry,
  WordSense,
  ValidationError,
} from "@/lib";
```

---

## Adding New Utilities

If you need to add a new shared utility:

1. **Create the utility file** in `lib/utils/` or `lib/constants/`
2. **Export it** from `lib/index.ts` (the barrel export)
3. **Add TypeScript types** to `lib/types/` if needed
4. **Write tests** in `__tests__/lib/` and `__tests__/api/`
5. **Document usage** in README.md

---

## Input Validation Flow

When a user submits a search:

```
User Input
    ↓
validateSearchTerm(input)  ← Returns {valid, error}
    ↓ If invalid → Return 400 error to client
    ↓ If valid → Continue
normalizeSearchTerm(input)  ← Returns slug
    ↓
isBlocklisted(slug)         ← Blocks offensive terms
    ↓ If blocked → Return 403 error, don't call AI
    ↓ If OK → Continue
Database lookup by slug
    ↓ If found → Return existing definition
    ↓ If not found → Call Anthropic API (subject to rate limit)
```

---

## Implementing the API Endpoint

The `/api/word/[slug]` endpoint should follow this pseudocode:

```typescript
import {
  normalizeSearchTerm,
  isBlocklisted,
  validateSearchTerm,
} from "@/lib";

export async function POST(request: Request) {
  const body = await request.json();
  const userInput = body.term;

  // Step 1: Validate input
  const validation = validateSearchTerm(userInput);
  if (!validation.valid) {
    return Response.json(
      { error: validation.error },
      { status: 400 }
    );
  }

  // Step 2: Normalize to slug
  const slug = normalizeSearchTerm(userInput);

  // Step 3: Check blocklist
  if (isBlocklisted(slug)) {
    return Response.json(
      { error: "Blocklisted term" },
      { status: 403 }
    );
  }

  // Step 4: Check rate limit
  const clientIP = getClientIP(request);
  if (exceedsRateLimit(clientIP)) {
    return Response.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  // Step 5: Lookup in database
  const existing = await db.words.findBySlug(slug);
  if (existing) {
    return Response.json(existing, { status: 200 });
  }

  // Step 6: Call AI to generate
  const aiResponse = await generateDefinition(slug);

  // Step 7: Validate AI response
  const parsed = JSON.parse(aiResponse);
  if (parsed.error === "not_found") {
    return Response.json(parsed, { status: 404 });
  }

  // Step 8: Save to database
  await db.words.insert({
    slug,
    word: parsed.word,
    senses: parsed.senses,
    source: "ai_generated",
  });

  return Response.json(parsed, { status: 201 });
}
```

---

## Building the Word Page

The `/word/[slug]` page should:

1. Fetch from `/api/word/[slug]`
2. Use `generateSynonymLinks()` to create clickable synonym tags
3. Render each sense separately if multiple exist
4. Include a search bar (reusable component) at the top

Example component structure:

```typescript
import { generateSynonymLinks, type WordEntry } from "@/lib";

export default function WordPage({ wordEntry }: { wordEntry: WordEntry }) {
  return (
    <div>
      <SearchBar />
      {wordEntry.senses.map((sense) => (
        <SenseBlock
          key={sense.part_of_speech}
          sense={sense}
          synonymLinks={generateSynonymLinks(sense.synonyms)}
        />
      ))}
    </div>
  );
}

function SenseBlock({ sense, synonymLinks }: any) {
  return (
    <div className="sense-card">
      <h2>{sense.part_of_speech}</h2>
      <p>{sense.meaning}</p>
      <div className="synonyms">
        {synonymLinks.map((link) => (
          <Link key={link.slug} href={link.href}>
            {link.text}
          </Link>
        ))}
      </div>
      <ul>
        {sense.examples.map((ex) => (
          <li key={ex}>{ex}</li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Running and Debugging Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test normalization.test.ts

# Run in watch mode (reruns on file change)
pnpm test:watch

# Debug a test (opens debugger)
node --inspect-brk node_modules/.bin/jest --runInBand
```

---

## Common Issues & Solutions

### Issue: Tests failing with "cannot find module"
**Solution:** Make sure you're importing from `@/lib`, not relative paths. The `@/` alias is configured in `tsconfig.json`.

### Issue: Validation error not throwing for invalid input
**Solution:** Check that you're calling `normalizeSearchTerm()` not `validateSearchTerm()`. The former throws, the latter returns an error object.

### Issue: Synonym links have wrong URLs
**Solution:** Ensure `generateSynonymLinks()` is being called on the raw synonym strings, not already-slugified versions.

### Issue: Tests pass locally but fail in CI/CD
**Solution:** Ensure all dependencies are installed. Run `pnpm install` before running tests in CI.

---

## Code Style & Conventions

- **TypeScript strict mode:** All code must pass TypeScript strict type checking
- **Naming:** Use camelCase for functions/variables, PascalCase for types/components
- **Exports:** Always use named exports (easier refactoring than default exports)
- **Comments:** JSDoc comments for public functions
- **Tests:** One describe block per function, multiple test cases inside

Example:

```typescript
/**
 * Converts a raw search term into a URL-friendly slug.
 * Handles spaces, punctuation, and case normalization.
 *
 * @param input - Raw search input from user
 * @returns Normalized slug (e.g., "hello-world")
 * @throws ValidationError if input is invalid
 *
 * @example
 * normalizeSearchTerm("Hello World") // → "hello-world"
 */
export function normalizeSearchTerm(input: string): string {
  // implementation
}
```

---

## Checklist for New Code

Before submitting:

- [ ] TypeScript passes (`pnpm tsc`)
- [ ] Tests pass (`pnpm test`)
- [ ] ESLint passes (`pnpm lint`)
- [ ] Code follows conventions above
- [ ] Documentation is updated
- [ ] Barrel exports (`lib/index.ts`) are updated if adding new files

---

## Questions?

1. Check the test files — they often have usage examples
2. Review `lib/types/index.ts` for the shared contract
3. See `agent-division.md` for architecture decisions
4. Check the README for high-level flow

