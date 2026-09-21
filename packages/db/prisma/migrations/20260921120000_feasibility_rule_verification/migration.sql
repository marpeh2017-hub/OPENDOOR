-- Whether a rule's VALUE has been read back off the source it cites.
--
-- authority says what kind of source is claimed and sourceReference names it,
-- but neither says whether anyone checked the number against it. A register
-- whose answer to "what is unverified" is a free-text note has no answer.
--
-- NEEDS_VERIFICATION is the default because a value that was typed is not a
-- value that was checked, and every row already in the table was typed.
CREATE TYPE "FeasibilityRuleVerification" AS ENUM ('VERIFIED_AGAINST_SOURCE', 'NEEDS_VERIFICATION', 'DISPUTED');

ALTER TABLE "feasibility_rules"
  ADD COLUMN "verification" "FeasibilityRuleVerification" NOT NULL DEFAULT 'NEEDS_VERIFICATION',
  ADD COLUMN "verificationNote" TEXT;
