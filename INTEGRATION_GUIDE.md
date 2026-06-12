# Integration Guide: Agent 3 Work with Existing Code

**Issue:** There are existing utility files in `lib/` that may conflict with Agent 3's deliverables.

**Status:** Both implementations serve the same purpose but have different levels of sophistication.

---

## File Comparison

### Existing Files (in `lib/`)
- `lib/normalize.ts` — Basic normalization and validation
- `lib/api.ts` — API client utilities
- `lib/types.ts` — TypeScript types
- `lib/mock-data.ts` — Mock data for development

### Agent 3 Files (in `lib/utils/` and `lib/constants/`)
- `lib/utils/normalization.ts` — **Enhanced** normalization with detailed error types
- `lib/utils/synonyms.ts` — Synonym linking utilities (NEW)
- `lib/utils/recent-words.ts` — Recently-added words utilities (NEW)
- `lib/constants/blocklist.ts` — Blocklist management (NEW)
- `lib/types/index.ts` — **Comprehensive** shared contract types (NEW)
- `lib/index.ts` — Barrel export for all utilities (NEW)

---

## Recommendation: Use Agent 3's Implementation

### Why?

1. **Better Error Handling**
   - Agent 3 uses typed `ValidationError` with error codes
   - Existing code returns string error messages
   - Typed errors are better for proper error handling

2. **More Comprehensive Validation**
   - Checks for SQL injection patterns
   - Checks for XSS patterns
   - Validates character sets more explicitly
   - Supports apostrophes in contractions

3. **Better Documentation**
   - Full JSDoc comments
   - Usage examples
   - Clear validation rules

4. **Organized Structure**
   - `lib/utils/` for utilities
   - `lib/constants/` for constants
   - Single barrel export at `lib/index.ts`
   - Cleaner imports: `import { ... } from '@/lib'`

5. **More Features**
   - `looksLikeWord()` heuristic function
   - Synonym linking utilities
   - Recently-added words utilities
   - Blocklist management

---

## Migration Path

### Option 1: Complete Replacement (Recommended)

1. Delete or archive the existing simple files:
   - `lib/normalize.ts`
   - `lib/types.ts`

2. Keep and migrate if needed:
   - `lib/api.ts` — Move to `lib/utils/api.ts` and update imports
   - `lib/mock-data.ts` — Keep as-is or move to `lib/constants/mock-data.ts`

3. Update all imports to use the new barrel export:
   ```typescript
   // Old
   import { normalizeSearchTerm } from '@/lib/normalize';
   import { WordEntry } from '@/lib/types';

   // New
   import { normalizeSearchTerm, type WordEntry } from '@/lib';
   ```

4. Consolidate types:
   - Keep Agent 3's `lib/types/index.ts` (more comprehensive)
   - Add any custom types from existing `lib/types.ts` if needed

### Option 2: Coexistence (If Existing Code Cannot Be Changed)

If existing code depends on the old structure:

1. Keep existing files as-is
2. Prefer Agent 3's utilities for new code
3. Create a deprecation notice in old files pointing to new location
4. Plan migration for future refactor

**Example deprecation notice:**
```typescript
/**
 * @deprecated Use lib/utils/normalization.ts instead
 * Import: import { normalizeSearchTerm } from '@/lib'
 */
export function normalizeSearchTerm(input: string): string {
  // ...
}
```

---

## Updated Import Statements

Once migration is complete, all code should import from `@/lib`:

```typescript
// Types
import type {
  WordEntry,
  WordSense,
  ValidationError,
} from '@/lib';

// Validation
import {
  normalizeSearchTerm,
  validateSearchTerm,
  slugify,
  looksLikeWord,
} from '@/lib';

// Blocklist
import {
  isBlocklisted,
  blockTerm,
  getBlocklistSize,
} from '@/lib';

// Synonyms
import {
  generateSynonymLinks,
  getSynonymHref,
} from '@/lib';

// Recently-added
import {
  getRecentlyAddedWords,
  formatRecentWord,
} from '@/lib';
```

---

## Files to Delete After Migration

```
lib/normalize.ts              ← Replaced by lib/utils/normalization.ts
lib/types.ts                  ← Replaced by lib/types/index.ts
```

**Keep:**
```
lib/api.ts                    ← Migrate to lib/utils/api.ts (if needed)
lib/mock-data.ts              ← Keep or migrate to lib/constants/
```

---

## Testing Compatibility

All Agent 3 tests use the new structured format:

```typescript
import {
  normalizeSearchTerm,
  validateSearchTerm,
  type ValidationError,
} from '@/lib';
```

Tests will pass once imports are consolidated.

---

## Recommended Action Plan

1. **Review existing code** in `lib/api.ts` and `lib/mock-data.ts` to understand current usage
2. **Create a migration branch** if working with version control
3. **Update imports** in any components/pages using old structure
4. **Run tests** to ensure nothing breaks: `pnpm test`
5. **Delete old files** (`lib/normalize.ts`, `lib/types.ts`)
6. **Verify all imports** work with new barrel export
7. **Commit** migration changes

---

## Questions?

- If existing code is heavily dependent on old structure, keep both and deprecate gradually
- If you have custom types, add them to `lib/types/index.ts` instead of `lib/types.ts`
- Agent 3 is available to help with refactoring if needed

---

**Next Steps:** Proceed with Option 1 (Complete Replacement) for cleanest codebase.
