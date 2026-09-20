-- Non-cash consideration: the market value of apartments handed to a seller
-- in a combination deal, as distinct from the cash paid.
--
-- The engine could express only cash. `landCost` is a cost line, the cost
-- lines reconcile to the cash flow, and a flat given to a seller moves no
-- cash — so the value simply had nowhere to live. The consequence was not a
-- missing feature but a wrong number: profit-on-cost divided by a cost base
-- that omitted the flats, and reported 32.63% where the real figure was
-- 20.00% on a live negotiation.
--
-- Purely additive and nullable. Every existing scenario reads NULL, and every
-- derived figure reduces exactly to the cash-only form it has today.
ALTER TABLE "feasibility_scenarios"
    ADD COLUMN "considerationInKind" DECIMAL(18,2);
