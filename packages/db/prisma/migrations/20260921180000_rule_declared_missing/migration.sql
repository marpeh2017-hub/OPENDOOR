-- "Nobody has established this number yet" as a state, not a sentence.
--
-- RULE_VALUE_REQUIRED forced every rule to carry a numeric or textual value,
-- so recording a known gap meant typing "not yet determined" into a text field
-- — which cannot be queried, and which reads as a rule that states something.
--
-- DECLARED_MISSING makes the gap the record: the rule exists, it applies to
-- its project types, and its value is openly absent. STATED is the default, so
-- every existing row keeps its meaning exactly.
CREATE TYPE "FeasibilityRuleValueStatus" AS ENUM ('STATED', 'DECLARED_MISSING');

ALTER TABLE "feasibility_rules"
  ADD COLUMN "valueStatus" "FeasibilityRuleValueStatus" NOT NULL DEFAULT 'STATED';
