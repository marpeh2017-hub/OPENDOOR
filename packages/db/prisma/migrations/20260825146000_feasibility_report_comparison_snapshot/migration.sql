-- Freeze the scenario-comparison evidence together with a report version.
-- Existing versions remain valid and simply have no comparison section.
ALTER TABLE "feasibility_report_versions" ADD COLUMN "comparisonSnapshot" JSONB;
