-- Unit disposition: what a unit-mix line is for.
--
-- ADDITIVE AND NON-BREAKING. The column arrives with DEFAULT 'UNCLASSIFIED',
-- so every existing row keeps its meaning and no revenue changes on apply.
--
-- Why the default is UNCLASSIFIED and not DEVELOPER_SALE: the engine books
-- sale revenue only for DEVELOPER_SALE lines. Defaulting to "sellable" would
-- silently credit owner-replacement flats as income the day this ships, which
-- is exactly the class of quiet error this column exists to prevent. An
-- unreviewed line earns nothing until a human classifies it.
--
-- WRITTEN IDEMPOTENTLY ON PURPOSE. A parallel branch introduced the same type
-- and column under a different migration name, and some development databases
-- already carry it. Guarding here means this migration is correct on a fresh
-- database and a no-op on one that already has it, instead of failing half the
-- team's machines.
DO $$ BEGIN
  CREATE TYPE "FeasibilityUnitDisposition" AS ENUM ('UNCLASSIFIED', 'DEVELOPER_SALE', 'OWNER_REPLACEMENT', 'RETAINED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "feasibility_unit_mix_lines"
  ADD COLUMN IF NOT EXISTS "disposition" "FeasibilityUnitDisposition" NOT NULL DEFAULT 'UNCLASSIFIED';
