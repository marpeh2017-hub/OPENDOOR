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
