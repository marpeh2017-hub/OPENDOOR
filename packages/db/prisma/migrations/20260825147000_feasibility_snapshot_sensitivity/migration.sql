-- Optional, immutable sensitivity matrix captured only when the analyst
-- explicitly includes it in a calculation snapshot.
ALTER TABLE "feasibility_calculation_snapshots" ADD COLUMN "sensitivitySnapshot" JSONB;
