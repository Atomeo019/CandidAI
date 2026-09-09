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
