/**
 * @urban-renewal/api-contracts
 *
 * Shared type vocabulary for the OpenDoor website, resident portal and — in
 * time — the CRM. Types, plus a single runtime constant (`PROJECT_STAGE_ORDER`)
 * whose reason for existing is documented in `./common`. No third-party
 * dependencies.
 *
 * Phase 1 status: these describe the shape the frontend needs. Several describe
 * data `services/api-gateway` does not expose yet; those carry `@phase2`.
 * Nothing here obliges a schema change, and nothing here is authorisation —
 * see the note on `Visibility` in `./common`.
 */
export * from './common'
export * from './public'
export * from './auth'
export * from './resident'
export * from './representative'
export * from './cms'
export * from './verification'
/* Type-level only: the four-layer project separation. Contains no runtime
   value, so exporting it adds nothing to any bundle. See the file header for
   why internal, provenance and feasibility data must never be fields on
   `PublicProject`. */
export * from './project-internal'
/* Site Manager. Types only, nothing persisted: the localisation policy, the
   stored verification record and the CMS domain vocabulary. */
export * from './localization'
export * from './cms.verification'
export * from './cms-admin'
export * from './media-slots'
