-- One-time backfill: lowercase every stored email.
--
-- WHY: three separate code paths used to write User.email with whatever casing
-- Clerk's OAuth provider returned. Postgres string equality is case-sensitive,
-- so the Whop webhook's lowercased lookup silently matched zero rows for any
-- account stored with an uppercase character — the customer paid, nothing
-- unlocked, and they landed on the claim form or in your inbox.
--
-- All write sites now lowercase before storing. This fixes the rows written
-- before that change. It is idempotent: running it twice changes nothing.
--
-- RUN IT LIKE THIS (from the project root):
--
--   npx prisma db execute --schema prisma/schema.prisma --file prisma/backfill-lowercase-emails.sql
--
-- Read the two SELECTs first. The second one matters: if it returns any rows,
-- STOP — you have accounts that differ only by casing, and lowercasing them
-- would create true duplicates in a column that has no unique constraint. Decide
-- which account is real before running the UPDATE.

-- 1. How many rows will change?
SELECT count(*) AS rows_to_lowercase
FROM "User"
WHERE "email" <> lower("email");

-- 2. SAFETY CHECK — would lowercasing collide two accounts into one address?
--    Expected result: zero rows. Anything else needs a human decision first.
SELECT lower("email") AS collides_on, count(*) AS account_count
FROM "User"
GROUP BY lower("email")
HAVING count(*) > 1;

-- 3. The backfill itself.
UPDATE "User"
SET "email" = lower("email")
WHERE "email" <> lower("email");

-- 4. Purchase.buyerEmail is written lowercased by the Whop webhook, but rows
--    predating that are normalised here too so the claim flow keeps matching.
UPDATE "Purchase"
SET "buyerEmail" = lower("buyerEmail")
WHERE "buyerEmail" IS NOT NULL
  AND "buyerEmail" <> lower("buyerEmail");

-- 5. Confirm: both should return zero.
SELECT count(*) AS users_still_mixed_case
FROM "User"
WHERE "email" <> lower("email");

SELECT count(*) AS purchases_still_mixed_case
FROM "Purchase"
WHERE "buyerEmail" IS NOT NULL
  AND "buyerEmail" <> lower("buyerEmail");
