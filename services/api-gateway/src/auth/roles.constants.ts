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
 * Roles allowed to issue and withdraw a resident's PORTAL LOGIN LINK.
 *
 * An invitation is a credential, not a message. Redeemed on the right handset
 * it opens that resident's file — their documents, their signature status,
 * their correspondence — so issuing one is an access-granting act and belongs
 * with the people who own the resident relationship.
 *
 * FIELD_AGENT is included for the same reason they can run an import: they are
 * the ones standing at the door when a resident says the app does not work,
 * and routing that through a manager makes the fix take a day. The risk is
 * bounded by what the link can actually do — it grants access to ONE resident
 * they can already see, only after an OTP to the number already on that
 * resident's record, and every issuance is logged with the actor.
 *
 * The professional roles are deliberately absent. LAWYER, ARCHITECT, ENGINEER,
 * DEVELOPER_REP, MUNICIPALITY_USER and EXTERNAL_CONSULTANT read a project;
 * none of them administers residents' access to it.
 */
export const RESIDENT_INVITE_ROLES = [
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'PROJECT_MANAGER',
  'RESIDENT_RELATIONS_MANAGER',
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

/**
 * Roles allowed to SHARE a document with an individual resident.
 *
 * ── WHY THIS IS NARROWER THAN `DOCUMENT_WRITE_ROLES` ───────────────────────
 *
 * Uploading a document and handing it to a named resident are different acts.
 * The first puts a file in the company's own library; the second gives a person
 * outside the company the ability to read it, and there is no un-reading it
 * afterwards. Sharing is an access grant wearing the clothes of a metadata
 * edit, which is exactly the kind of thing that gets the broader list by
 * default and should not.
 *
 * Three roles that may upload are absent here:
 *
 *   - DEVELOPER_REP is the COUNTERPARTY. The developer negotiates with these
 *     residents, and letting their representative put documents directly in
 *     front of them — outside the promoter's channel, on the promoter's
 *     letterhead — hands one side of a negotiation a private line to the other
 *     side's clients. This is the load-bearing exclusion.
 *   - ARCHITECT and ENGINEER upload plans for the project. Deciding that ONE
 *     resident should receive a particular drawing is a resident-relationship
 *     decision, not a technical one, and they are not the people holding that
 *     relationship.
 *
 * LAWYER stays: the agreements and powers of attorney are theirs, and sending
 * them to the resident who must sign is the job. FIELD_AGENT stays for the same
 * reason they may run an import — they are the ones at the door when a resident
 * says they never received something.
 *
 * Revoking a share uses this same list. If you may not grant, you may not
 * decide to withdraw either.
 */
export const RESIDENT_SHARE_ROLES = [
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'PROJECT_MANAGER',
  'RESIDENT_RELATIONS_MANAGER',
  'FIELD_AGENT',
  'LAWYER',
] as const

/**
 * ════════════════════════════════════════════════════════════════════════════
 *  SITE MANAGER (CMS) — who may read, edit, verify and publish the WEBSITE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * These are scoped capabilities expressed through the existing global role
 * model, exactly like FEASIBILITY_* above. There is deliberately no second
 * user table, no CMS-specific login and no parallel role enum: the people who
 * edit the website are the people who already have CRM accounts, and a second
 * authentication system would be a second place for access to be revoked
 * incompletely.
 *
 * `CmsRole` / `CmsCapability` in @urban-renewal/api-contracts describe the
 * CMS's own capability vocabulary, which is what the UI reasons about. THESE
 * lists are the enforcement, and the E2E suite asserts the endpoints refuse
 * independently of what the UI chooses to render.
 *
 * ── WHY THE TIERS NARROW THE WAY THEY DO ───────────────────────────────────
 *
 * The CRM manages a renewal process; the Site Manager manages what the company
 * says in public. Those have different blast radii. A mistake in the CRM is
 * visible to a project team; a mistake here is visible to every resident,
 * every competitor and Google, and stays quotable after it is corrected.
 *
 * So the tiers narrow faster than they do elsewhere in this file, and none of
 * them includes the read-only external roles. MUNICIPALITY_USER,
 * EXTERNAL_CONSULTANT and DEVELOPER_REP are observers of a PROJECT; they have
 * no standing over the company's own website, so they do not appear even at
 * view level. RESIDENT is not staff and is nowhere near any of these.
 */

/**
 * See the Site Manager at all.
 *
 * Includes CEO, who appears in none of the operational lists above: the website
 * is company voice, and the person accountable for it should be able to read
 * what it currently says without being able to change it.
 */
export const CMS_VIEW_ROLES = [
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'CEO',
  'PROJECT_MANAGER',
  'RESIDENT_RELATIONS_MANAGER',
] as const

/**
 * Edit drafts and submit them for review.
 *
 * Narrower than VIEW by exactly one role: CEO reads, and does not edit. That is
 * not a technical constraint but an editorial one — the drafting queue belongs
 * to the people who maintain it daily, and an unreviewed edit from outside that
 * queue is the kind that reaches the public unnoticed.
 *
 * Editing NEVER reaches the public on its own. Publishing is a separate
 * capability below, and the resolver serves publications rather than drafts.
 */
export const CMS_EDIT_ROLES = [
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'PROJECT_MANAGER',
  'RESIDENT_RELATIONS_MANAGER',
] as const

/**
 * Sign for a factual claim: unit counts, approvals, dates, areas.
 *
 * RESIDENT_RELATIONS_MANAGER is deliberately absent though they may EDIT.
 * Verification is not "I typed this correctly", it is "I checked this against
 * the source and I stand behind it", and the people who hold those sources are
 * the project managers and the administrators.
 *
 * Self-verification IS permitted and is recorded as SELF_VERIFIED rather than
 * VERIFIED — see `deriveVerificationStatus` in api-contracts. A promoter of
 * this size does not have two people for every figure, and a rule that cannot
 * be followed gets worked around rather than obeyed. What the record must never
 * do is CLAIM independent review that did not happen.
 */
export const CMS_VERIFY_ROLES = [
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'PROJECT_MANAGER',
] as const

/**
 * Make content live, withdraw it, and restore a previous revision.
 *
 * The narrowest tier, and the only one that changes what the public can read.
 * Restoring is here rather than with EDIT for the same reason publishing is: a
 * restore of a PUBLISHED item changes the live site, so it is a publishing act
 * wearing a different name.
 */
export const CMS_PUBLISH_ROLES = [
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
] as const

/**
 * Attach, replace and classify images.
 *
 * Same list as EDIT. Classification is the load-bearing part: publishing an
 * editorial photograph as though it depicted an OpenDoor project is the
 * specific failure the `CmsImageClaim` column exists to prevent, and whoever
 * places an image is the person who knows which it is.
 */
export const CMS_MEDIA_ROLES = CMS_EDIT_ROLES

/**
 * Read and edit a project's private feasibility workspace.
 *
 * ── WHY THIS IS NOT `CMS_EDIT_ROLES` ───────────────────────────────────────
 *
 * Editing the sentence that describes a project to the public and editing the
 * scenario that says the project sells for 825 million shekels are not the
 * same act, and the second is not implied by the first.
 * RESIDENT_RELATIONS_MANAGER edits public copy for a living and has no reason
 * to hold the economics, so this list is EDIT minus that role — the same
 * narrowing, and for the same reason, as CMS_VERIFY_ROLES.
 *
 * The enforcement is not only this decorator. `CmsService.save` preserves the
 * server's `feasibility` subtree and ignores whatever the browser sent for it,
 * so the ordinary project save cannot reach these figures even if someone
 * posts a document containing them. This tier is the only way in.
 */
export const CMS_FEASIBILITY_ROLES = [
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'PROJECT_MANAGER',
] as const

/** Site-wide settings: contact details, site name, sharing defaults. */
export const CMS_SETTINGS_ROLES = [
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
] as const
