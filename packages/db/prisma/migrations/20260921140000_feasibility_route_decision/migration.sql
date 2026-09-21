-- How a project type was arrived at.
--
-- The type on the profile is the conclusion; this is the argument. A
-- conclusion with no argument cannot be revisited, only overwritten — and
-- somebody opening the file in two months has to be able to see which answers
-- led there, and whether one of those facts has since changed.
--
-- UNKNOWN is a stored answer rather than a null: "asked and could not say" and
-- "never asked" are different facts, and only the first means the question was
-- actually put to somebody.
CREATE TYPE "FeasibilityRouteLandHolder" AS ENUM ('SELLER_EXITS', 'LANDOWNER_PARTNER', 'EXISTING_OWNERS', 'UNKNOWN');
CREATE TYPE "FeasibilityRouteBuildIntent" AS ENUM ('BUILD', 'RESELL', 'UNKNOWN');
CREATE TYPE "FeasibilityRouteDemolition" AS ENUM ('YES', 'NO', 'UNKNOWN');
CREATE TYPE "FeasibilityRouteBuildingCount" AS ENUM ('SINGLE', 'MULTIPLE', 'UNKNOWN');
CREATE TYPE "FeasibilityRouteDeclaration" AS ENUM ('DECLARED_OR_IN_PROGRESS', 'NOT_DECLARED', 'UNKNOWN');
CREATE TYPE "FeasibilityRouteStatus" AS ENUM ('RESOLVED', 'UNDECIDED');

CREATE TABLE "feasibility_route_decisions" (
  "id" TEXT NOT NULL,
  "feasibilityProfileId" TEXT NOT NULL,
  "landHolder" "FeasibilityRouteLandHolder",
  "buildIntent" "FeasibilityRouteBuildIntent",
  "demolition" "FeasibilityRouteDemolition",
  "buildingCount" "FeasibilityRouteBuildingCount",
  "declaration" "FeasibilityRouteDeclaration",
  "status" "FeasibilityRouteStatus" NOT NULL,
  "resolvedProjectType" "FeasibilityProjectType",
  "appliedToProfile" BOOLEAN NOT NULL DEFAULT false,
  "reasoning" TEXT[],
  "warnings" TEXT[],
  "decidedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feasibility_route_decisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "feasibility_route_decisions_feasibilityProfileId_createdAt_idx"
  ON "feasibility_route_decisions" ("feasibilityProfileId", "createdAt");

ALTER TABLE "feasibility_route_decisions"
  ADD CONSTRAINT "feasibility_route_decisions_feasibilityProfileId_fkey"
  FOREIGN KEY ("feasibilityProfileId") REFERENCES "feasibility_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
