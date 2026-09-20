/**
 * ════════════════════════════════════════════════════════════════════════════
 * ROADMAP — replace buffered uploads with presigned direct-to-S3 uploads
 * ════════════════════════════════════════════════════════════════════════════
 *
 * STATUS: NOT IMPLEMENTED. This file is a specification and a tracking anchor,
 * not an implementation. It is deliberately code rather than a wiki page so it
 * shows up in `grep`, travels with the branch, and cannot rot in a tool nobody
 * opens. Nothing imports `PRESIGNED_UPLOAD_ROADMAP` — it exists so the constant
 * is greppable and so this file is not dead weight the linter strips.
 *
 * ── THE PROBLEM ────────────────────────────────────────────────────────────
 *
 * A document upload is buffered TWICE, entirely in memory, at two points that
 * already carry the analysis in comments:
 *
 *   1. `apps/crm/src/app/api/proxy/[...path]/route.ts` — the BFF proxy calls
 *      `req.arrayBuffer()`, materialising the whole body in the Next.js
 *      process. (See the comment block around "buffering point 2".)
 *   2. `services/api-gateway/src/documents/documents.controller.ts` — the two
 *      `FileInterceptor` routes use multer's MEMORY storage, so `file.buffer`
 *      is the whole file again in the Nest process. Limits set from
 *      `MAX_DOCUMENT_BYTES` in `document-upload.constants.ts`, whose doc block
 *      spells out the memory arithmetic.
 *
 * With `MAX_DOCUMENT_BYTES` at 100 MB — raised for CAD, and STAYING at 100 MB;
 * this roadmap does not reduce it — one in-flight upload costs roughly 200 MB
 * resident across the two processes. Concurrency multiplies it linearly, and
 * there is no admission control, so N simultaneous CAD uploads is an OOM with
 * no backpressure and no useful error.
 *
 * This is survivable today because uploads are staff-initiated, low-frequency,
 * and the deployment has headroom. It stops being survivable the moment
 * residents upload documents themselves at scale (portal document collection,
 * bulk owner-sheet intake) — which is why this is a PREREQUISITE, not a
 * nice-to-have.
 *
 * ── THE TARGET DESIGN ──────────────────────────────────────────────────────
 *
 *   Browser → presigned PUT URL → S3/MinIO → finalize-metadata → Document row
 *
 * The bytes never touch the BFF proxy or the API process. Both buffering points
 * disappear rather than being tuned.
 *
 *   STEP 1  POST /api/v1/documents/upload-intent
 *           Authenticated, RBAC'd (DOCUMENT_WRITE_ROLES), tenant-scoped.
 *           Body: filename, declared MIME type, declared byte size, and the
 *           parent (projectId / residentId / apartmentId), validated exactly as
 *           the current create path validates them.
 *           Server: rejects on size/type before issuing anything; generates the
 *           storage key ITSELF (never accepts a client-supplied key — a
 *           client-chosen key is a path-traversal and cross-tenant-overwrite
 *           hole); returns a short-TTL presigned PUT URL (5 minutes) plus an
 *           opaque `uploadId`.
 *           The presigned URL MUST pin `Content-Length` and `Content-Type` in
 *           the signature, or the size cap is advisory only.
 *
 *   STEP 2  Browser PUTs the bytes directly to S3/MinIO. No proxy involved.
 *           Requires CORS on the bucket, which MinIO needs configuring for.
 *
 *   STEP 3  POST /api/v1/documents/finalize
 *           Body: the `uploadId` from step 1, plus the metadata that today
 *           accompanies the multipart request.
 *           Server: `HeadObject` to confirm the object EXISTS and to read its
 *           REAL size (the declared size in step 1 is a client claim); reads
 *           the first bytes with a ranged GET to run the existing magic-number
 *           validation from `document-upload.constants.ts` — the signature
 *           check must survive this migration, it is the actual content
 *           control; then creates the `Document` row and audits it.
 *           If validation fails, the object is deleted before answering.
 *
 * ── WHAT MUST NOT BE LOST ──────────────────────────────────────────────────
 *
 *   • Magic-number/type validation. Today it runs on the buffer. In the new
 *     flow it runs on a ranged read AFTER upload, and the object is deleted on
 *     failure. Trusting the declared Content-Type instead would be a real
 *     regression — that is the whole point of the signature table.
 *   • The size cap, enforced in the signature (step 1) AND re-checked against
 *     `HeadObject` (step 3).
 *   • Tenant scoping of the storage key, generated server-side.
 *   • The audit row, written at finalize.
 *   • Document versioning semantics (`documents.controller.ts` version routes).
 *
 * ── NEW FAILURE MODE THIS INTRODUCES ───────────────────────────────────────
 *
 * ORPHANED OBJECTS. A client that completes step 2 and never calls step 3
 * leaves a paid-for object with no `Document` row. This is not hypothetical —
 * a closed laptop lid causes it. Mitigation is a lifecycle rule on the upload
 * prefix (expire unfinalised objects after 24h) plus a reconciliation sweep,
 * and it MUST be designed in from the start, because retrofitting it means
 * first identifying which of the existing orphans were legitimate.
 *
 * Note the related known issue in `test/signature-workflow.e2e-spec.ts`, which
 * leaks MinIO objects because its `afterAll` never calls `storage.delete` —
 * same class of problem, already scheduled for cleanup.
 *
 * ── SCOPE / SEQUENCING ─────────────────────────────────────────────────────
 *
 * REQUIRED BEFORE: any large-scale or resident-facing external upload.
 * NOT REQUIRED FOR: current staff upload volumes.
 * Touches: documents controller + service, the CRM BFF proxy, the CRM upload
 * component, MinIO/S3 CORS and lifecycle configuration.
 * `@aws-sdk/s3-request-presigner` is already a dependency — presigned GET is
 * in use for downloads — so no new package is needed.
 *
 * ── UNTIL THEN ─────────────────────────────────────────────────────────────
 *
 * `MAX_DOCUMENT_BYTES` stays at 100 MB and is a MEMORY dial as much as a policy
 * dial. Deployments without ~200 MB of headroom per concurrent upload should
 * lower it. See the doc block on that constant.
 */

export const PRESIGNED_UPLOAD_ROADMAP = {
  status: 'PLANNED',
  requiredBefore: 'large-scale or resident-facing external uploads',
  currentMaxBytes: 100 * 1024 * 1024,
  bufferingPoints: [
    'apps/crm/src/app/api/proxy/[...path]/route.ts (req.arrayBuffer)',
    'services/api-gateway/src/documents/documents.controller.ts (multer memory storage)',
  ],
} as const
