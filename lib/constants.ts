// Single source of truth for the free-tier allowance.
//
// Before this existed, prisma/schema.prisma defaulted parseLimit to 5 while
// every piece of user-facing copy promised 3 — we were giving away 67% more
// inference than the pricing assumed. Both sides now read this constant.
// The schema default is kept in sync manually (Prisma cannot import TS).

export const FREE_PARSE_LIMIT = 3;

// Copy fragment reused across the landing page, sign-in page and API errors so
// the number can never drift between them again.
export const FREE_PARSE_COPY = `${FREE_PARSE_LIMIT} free analyses`;

// ── Groq models ───────────────────────────────────────────────────────────────
// Groq RETIRES models with no in-app warning. In September 2026 every model this
// app used — llama-3.3-70b-versatile, llama-3.1-8b-instant, gemma2-9b-it — began
// returning 404 model_not_found, and the entire product silently stopped
// working. The model id lived in five separate files at the time.
//
// It lives here now. When analyses start failing with 404, check what your key
// can actually reach and change this one line:
//
//   curl -s https://api.groq.com/openai/v1/models //     -H "Authorization: Bearer $GROQ_API_KEY" | grep '"id"'
//
// /api/analyze keeps its own ordered fallback chain (a retirement should degrade,
// not break); these constants cover the single-model text-generation calls.
export const GROQ_TEXT_MODEL = 'openai/gpt-oss-120b';

// gpt-oss models emit reasoning tokens that count against max_tokens. 'low'
// keeps them from eating the whole budget and returning an empty completion.
export const GROQ_TEXT_MODEL_PARAMS: Record<string, unknown> = { reasoning_effort: 'low' };
