-- The engine has reconciled replacement allocations since 0cbdefb
-- (REPLACEMENT_ALLOCATION_INCOMPLETE, REPLACEMENT_REFERENCE_DUPLICATE,
-- REPLACEMENT_ALLOCATION_ON_SALE_UNITS) against a relation that did not exist
-- in this schema. It read them through a helper that returned an empty list, so
-- every one of those checks passed vacuously. This is the table they were
-- written against.
--
-- Purely additive: a new table, no column added to or removed from an existing
-- one. A scenario with no rows here behaves exactly as it did before, because
-- an empty list is what the engine was already receiving.
--
-- The share is an integer fraction rather than a decimal, matching
-- owner_apartments: three equal heirs are 1/3 each, and 0.333 x 3 is not one
-- flat. `replacementAllocationSummary` sums these in BigInt precisely so a
-- fully allocated unit cannot round above or below 100%.
CREATE TABLE "feasibility_replacement_allocations" (
    "id" TEXT NOT NULL,
    "unitMixLineId" TEXT NOT NULL,
    "unitReference" TEXT NOT NULL,
    "ownerApartmentId" TEXT NOT NULL,
    "shareNumerator" INTEGER NOT NULL DEFAULT 1,
    "shareDenominator" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feasibility_replacement_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "feasibility_replacement_allocations_unitMixLineId_idx"
    ON "feasibility_replacement_allocations"("unitMixLineId");

CREATE INDEX "feasibility_replacement_allocations_ownerApartmentId_idx"
    ON "feasibility_replacement_allocations"("ownerApartmentId");

-- One holding cannot be allocated the same replacement flat twice. The engine
-- reports that as `invalid`; this stops it being stored in the first place.
CREATE UNIQUE INDEX "feasibility_replacement_allocations_line_reference_holding_key"
    ON "feasibility_replacement_allocations"("unitMixLineId", "unitReference", "ownerApartmentId");

-- CASCADE from the unit-mix line: deleting the line deletes its allocations,
-- which is what "this row no longer exists" means for them.
ALTER TABLE "feasibility_replacement_allocations"
    ADD CONSTRAINT "feasibility_replacement_allocations_unitMixLineId_fkey"
    FOREIGN KEY ("unitMixLineId") REFERENCES "feasibility_unit_mix_lines"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- RESTRICT from the owner holding: an owner holding that a scenario has already
-- allocated a replacement flat to must not vanish from underneath it. Removing
-- the holding is a decision someone has to make explicitly.
ALTER TABLE "feasibility_replacement_allocations"
    ADD CONSTRAINT "feasibility_replacement_allocations_ownerApartmentId_fkey"
    FOREIGN KEY ("ownerApartmentId") REFERENCES "owner_apartments"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
