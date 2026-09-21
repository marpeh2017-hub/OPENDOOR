-- Derived equity: the equity schedule answers to the debt schedule.
--
-- Equity contributions were hand-entered cash-flow allocations, sized as the
-- residual "total cost minus debt" and dropped on one month. The result was an
-- equityIrr that did not move when the debt schedule moved, and scenarios
-- carrying a months-long unfunded hole that no validation could see.
--
-- DERIVED is the default because a silent manual default is what produced
-- those numbers. A scenario that genuinely wants typed equity allocations now
-- has to say so.
CREATE TYPE "FeasibilityEquitySource" AS ENUM ('DERIVED', 'EXPLICIT_ALLOCATIONS');

ALTER TABLE "feasibility_financing_assumptions"
  ADD COLUMN "equitySource" "FeasibilityEquitySource" NOT NULL DEFAULT 'DERIVED',
  ADD COLUMN "equityBalanceFloor" DECIMAL(18,2);
