/**
 * RBAC role groups — import these in controllers and guards.
 * Do not hard-code role strings elsewhere in the codebase.
 */

export const STAFF_ROLES = [
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'PROJECT_MANAGER',
  'RESIDENT_RELATIONS_MANAGER',
  'FIELD_AGENT',
  'LAWYER',
  'ARCHITECT',
  'ENGINEER',
  'DEVELOPER_REP',
  'MUNICIPALITY_USER',
  'EXTERNAL_CONSULTANT',
] as const

export const MANAGER_ROLES = [
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'PROJECT_MANAGER',
] as const

export const ADMIN_ROLES = [
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
] as const

export const SUPER_ADMIN_ONLY = ['SUPER_ADMIN'] as const

export const SIGNATURE_ROLES = [
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'PROJECT_MANAGER',
  'LAWYER',
] as const

/**
 * Roles allowed to run an Excel import.
 *
 * FIELD_AGENT is included by product decision: field agents are the people who
 * actually collect the owner sheets door to door, and routing every upload
 * through a manager made them the bottleneck on the one task they own. The
 * safety argument that originally excluded them — that an import writes
 * ownership shares in bulk, and ownership shares determine the legally
 * consequential pinuy-binuy signature threshold — is answered by the workflow
 * rather than by the role list: an import cannot write until a human confirms
 * the column mapping and reviews a per-row preview, `OwnershipService.applyPlans`
 * re-validates every apartment's full share set exactly and rolls the whole
 * transaction back on any violation, and every write is audited to the actor.
 *
 * Still deliberately NARROWER than STAFF_ROLES. MUNICIPALITY_USER,
 * EXTERNAL_CONSULTANT, LAWYER, ARCHITECT, ENGINEER and DEVELOPER_REP are not
 * here: they read the project, they do not maintain its owner roster. Reading
 * the import HISTORY stays open to all staff (STAFF_ROLES) so anyone can audit
 * what was loaded; running one is not.
 *
 * Mirrored on the CRM by `useCanImport()`. That hook only hides the button —
 * THIS list is the enforcement, and the E2E suite asserts both that a field
 * agent CAN run an import and that a role outside this list gets 403 from the
 * endpoint itself.
 */
export const IMPORT_ROLES = [
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'PROJECT_MANAGER',
  'FIELD_AGENT',
] as const

/**
 * Roles allowed to CREATE documents (metadata record or file upload).
 *
 * Deliberately narrower than STAFF_ROLES: MUNICIPALITY_USER and
 * EXTERNAL_CONSULTANT are read-only observers who may view the document
 * library but must not add to it. CEO and RESIDENT are not staff at all.
 * Mirrored on the CRM by `useCanWriteDocuments()` — the hook only hides the
 * button; THIS list is the enforcement.
 */
export const DOCUMENT_WRITE_ROLES = [
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'PROJECT_MANAGER',
  'RESIDENT_RELATIONS_MANAGER',
  'FIELD_AGENT',
  'LAWYER',
  'ARCHITECT',
  'ENGINEER',
  'DEVELOPER_REP',
] as const


/**
 * Roles allowed to SCHEDULE, edit, cancel, manage the roster of, and record
 * attendance for a meeting.
 *
 * Same shape as DOCUMENT_WRITE_ROLES and for the same reason: MUNICIPALITY_USER
 * and EXTERNAL_CONSULTANT are read-only observers. They attend meetings — they
 * can see the calendar (STAFF_ROLES on the read routes) and can answer their
 * OWN invitation (STAFF_ROLES on the RSVP route, where the service matches on
 * the caller's user id) — but they do not convene them, move them, or decide
 * who else is invited.
 *
 * RESIDENT is not staff and is nowhere near this list.
 *
 * Mirrored on the CRM by `useCanWriteMeetings()`. The hook only hides the
 * button; THIS list is the enforcement, and the E2E suite asserts the endpoint
 * refuses an observer with 403 independently of the UI.
 */
export const MEETING_WRITE_ROLES = [
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'PROJECT_MANAGER',
  'RESIDENT_RELATIONS_MANAGER',
  'FIELD_AGENT',
  'LAWYER',
  'ARCHITECT',
  'ENGINEER',
  'DEVELOPER_REP',
] as const

/**
 * Digital Zero Report / feasibility foundation.
 *
 * These are scoped capabilities expressed through the established global role
 * model, not new global roles. The mapping is deliberately conservative until
 * project-specific permission grants exist: technical and legal professionals
 * can maintain evidence-backed inputs, while approval/locking is introduced
 * only together with the report-version workflow.
 */
export const FEASIBILITY_VIEW_ROLES = STAFF_ROLES

export const FEASIBILITY_EDIT_ROLES = [
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'PROJECT_MANAGER',
  'LAWYER',
  'ARCHITECT',
  'ENGINEER',
] as const

/**
 * Roles allowed to AUTHOR, edit and delete communication templates.
 *
 * Narrower than the roles allowed to SEND a message, and deliberately so: a
 * template is the wording that goes to every resident in a project at once, so
 * authoring it is a broadcast-editorial act rather than a per-resident one.
 * FIELD_AGENT is excluded for exactly that reason — field agents send messages
 * from templates door to door, they do not decide what the project says to
 * everybody. LAWYER is excluded too: legal review of the wording happens before
 * it is entered, and giving every professional role write access to the shared
 * text makes ownership of it unclear.
 *
 * Reading templates stays open to all staff (STAFF_ROLES) so anyone who sends
 * can see the approved wording.
 *
 * Recording WhatsApp provider approval is narrower still (ADMIN_ROLES) and has
 * its own endpoint — see `TemplatesController`.
 *
 * Mirrored on the CRM by `useCanWriteTemplates()`. The hook only hides the
 * button; THIS list is the enforcement, and the E2E suite asserts the endpoint
 * refuses a field agent with 403 independently of the UI.
 */
export const TEMPLATE_WRITE_ROLES = [
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'PROJECT_MANAGER',
  'RESIDENT_RELATIONS_MANAGER',
] as const
