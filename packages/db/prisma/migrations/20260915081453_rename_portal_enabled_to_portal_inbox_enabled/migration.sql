-- `residents.portalEnabled` read as "can this resident use the portal at
-- all," which is actually gated by `residents.portalUserId`. This column only
-- controls whether the PORTAL message channel (the in-portal inbox) is
-- reachable as a delivery target. Renaming rather than adding a new column: a
-- rename is a metadata-only change in Postgres and keeps existing data intact
-- with no backfill.
ALTER TABLE "residents" RENAME COLUMN "portalEnabled" TO "portalInboxEnabled";
