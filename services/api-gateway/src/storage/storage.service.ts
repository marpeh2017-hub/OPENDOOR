import { Injectable, Logger, ForbiddenException } from '@nestjs/common'
import { randomBytes } from 'crypto'
import { FieldEncryptionService } from '../crypto/field-encryption.service'

/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports */

/**
 * Per-call storage options.
 *
 * `encrypt` is OPT-IN and defaults to false. `upload`/`download` are shared by
 * the document library and the Excel import, and encrypting every object would
 * silently break the document library's signed-URL download: a signed URL is
 * served by MinIO/S3 directly, so the browser would receive ciphertext with no
 * opportunity for us to decrypt it. Import workbooks are the one path that
 * always round-trips through the API process (`StorageService.download`), which
 * is exactly why they can be encrypted and documents currently cannot.
 */
export interface StorageOptions {
  /** Encrypt at rest with the service key. Default false. */
  encrypt?: boolean
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)
  private s3: any = null
  private readonly bucket = process.env.S3_BUCKET ?? ''

  constructor(private readonly encryption: FieldEncryptionService) {
    if (process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY) {
      this.initS3().catch(err => {
        this.logger.error('Failed to initialize S3 client', err)
      })
    } else {
      this.logger.warn('S3 storage not configured — document upload/download will fail in production')
    }
  }

  private async initS3() {
    try {
      const { S3Client } = require('@aws-sdk/client-s3') as any
      this.s3 = new S3Client({
        endpoint:    process.env.S3_ENDPOINT,
        region:      process.env.S3_REGION ?? 'auto',
        credentials: {
          accessKeyId:     process.env.S3_ACCESS_KEY!,
          secretAccessKey: process.env.S3_SECRET_KEY!,
        },
        forcePathStyle: true,
      })
    } catch {
      this.logger.error(
        'Failed to load @aws-sdk/client-s3 — run: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner',
      )
    }
  }

  private requireS3() {
    if (!this.s3) {
      throw new Error(
        'Storage not configured (S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY required) or @aws-sdk/client-s3 not installed',
      )
    }
  }

  /** Upload a file. Returns the storage key. */
  async upload(
    tenantId: string,
    folder: string,
    filename: string,
    buffer: Buffer,
    contentType: string,
    opts: StorageOptions = {},
  ): Promise<string> {
    this.requireS3()
    const { PutObjectCommand } = require('@aws-sdk/client-s3') as any
    const key = `${tenantId}/${folder}/${randomBytes(8).toString('hex')}-${filename}`

    const body = opts.encrypt ? this.encryption.encryptBuffer(buffer) : buffer

    await this.s3.send(new PutObjectCommand({
      Bucket:      this.bucket,
      Key:         key,
      Body:        body,
      // An encrypted object is opaque bytes. Declaring it as a spreadsheet
      // would invite anything that fetched it directly to try to parse it.
      ContentType: opts.encrypt ? 'application/octet-stream' : contentType,
      Metadata:    opts.encrypt ? { tenantId, encrypted: 'v1' } : { tenantId },
      // ServerSideEncryption requires KMS — disabled for MinIO dev compatibility
      // In production with AWS S3, add: ServerSideEncryption: 'AES256'
    }))
    return key
  }

  /**
   * Generate a short-lived signed URL (default 15 min). Verifies the key
   * belongs to the tenant.
   *
   * NOT VALID FOR ENCRYPTED OBJECTS. The bytes are served by the object store
   * directly, so this process never sees them and cannot decrypt them; the
   * caller would download ciphertext. Objects uploaded with `{ encrypt: true }`
   * must be read via `download()` and streamed by us instead. Today only the
   * Excel import encrypts, and it never mints a signed URL.
   */
  async getSignedUrl(tenantId: string, key: string, expiresIn = 900): Promise<string> {
    this.requireS3()
    if (!key.startsWith(`${tenantId}/`)) {
      throw new ForbiddenException('Access denied to document')
    }
    const { GetObjectCommand } = require('@aws-sdk/client-s3') as any
    const { getSignedUrl }     = require('@aws-sdk/s3-request-presigner') as any
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    )
  }

  /**
   * Read an object back into memory.
   *
   * Added for Excel import, which stores the uploaded workbook and then
   * re-reads it at each step (mapping → preview → commit) so that the commit
   * parses the SAME bytes the user previewed, and so that a preview minutes old
   * is re-validated against current database state rather than a cached
   * decision.
   *
   * The same tenant-prefix check as `getSignedUrl`/`delete` applies: a key that
   * does not begin with the caller's tenant id is refused outright, so a
   * `storageKey` leaked or guessed from another tenant cannot be read.
   */
  async download(tenantId: string, key: string): Promise<Buffer> {
    this.requireS3()
    if (!key.startsWith(`${tenantId}/`)) {
      throw new ForbiddenException('Access denied to object')
    }
    const { GetObjectCommand } = require('@aws-sdk/client-s3') as any
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
    const chunks: Buffer[] = []
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk))
    }
    const raw = Buffer.concat(chunks)

    // Decryption is driven by the object's own header, NOT by a caller flag or
    // a database column. That is what makes the legacy path correct: an object
    // written before at-rest encryption existed has no header and is returned
    // as-is, while a new object is decrypted, with no migration needed and no
    // way for the two to be confused.
    return this.encryption.decryptBuffer(raw)
  }

  async delete(tenantId: string, key: string): Promise<void> {
    this.requireS3()
    if (!key.startsWith(`${tenantId}/`)) {
      throw new ForbiddenException('Access denied to document')
    }
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3') as any
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }
}
