import {
  IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * Mirrors the Prisma `DocumentCategory` / `DocumentStatus` enums exactly.
 * Declared as literals rather than imported from `@prisma/client` so a schema
 * change surfaces as a test failure instead of silently widening the contract
 * (same convention as `UpdateLeadStatusDto`).
 */
export const DOCUMENT_CATEGORIES = [
  'CONTRACT', 'ID_DOCUMENT', 'LAND_REGISTRY', 'POWER_OF_ATTORNEY', 'PLANNING',
  'ENGINEERING', 'FINANCIAL', 'MUNICIPALITY', 'MARKETING', 'MEETING_MINUTES',
  'LEGAL', 'PERMIT', 'OTHER',
] as const

export const DOCUMENT_STATUSES = [
  'DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED', 'ARCHIVED',
] as const

export type DocumentCategoryValue = (typeof DOCUMENT_CATEGORIES)[number]
export type DocumentStatusValue   = (typeof DOCUMENT_STATUSES)[number]

/**
 * Explicit allow-list for POST /documents.
 *
 * SECURITY: this replaces a `{ ...body }` spread. Fields deliberately NOT
 * accepted from the client — `s3Key`, `s3Bucket`, `tenantId`, `createdById`,
 * `isPublic`, `version`, `parentId`, `ocrText`, `ocrStatus` — are all either
 * server-derived or privilege-relevant. Combined with the global
 * `forbidNonWhitelisted` ValidationPipe, sending any of them is now a 400.
 */
export class CreateDocumentDto {
  @ApiProperty({ example: 'הסכם פינוי-בינוי — בניין א׳' })
  @IsString() @IsNotEmpty() @MaxLength(300)
  title!: string

  @ApiProperty({ enum: DOCUMENT_CATEGORIES })
  @IsEnum(DOCUMENT_CATEGORIES, {
    message: `category must be one of: ${DOCUMENT_CATEGORIES.join(', ')}`,
  })
  category!: DocumentCategoryValue

  @ApiPropertyOptional({ enum: DOCUMENT_STATUSES, default: 'DRAFT' })
  @IsOptional()
  @IsEnum(DOCUMENT_STATUSES, {
    message: `status must be one of: ${DOCUMENT_STATUSES.join(', ')}`,
  })
  status?: DocumentStatusValue

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(2000)
  description?: string

  /** Parent scoping. Verified to exist inside the caller's tenant. */
  @ApiPropertyOptional({ description: 'Project this document belongs to' })
  @IsOptional() @IsString() @IsNotEmpty()
  projectId?: string

  @ApiProperty({ example: 'contract.pdf' })
  @IsString() @IsNotEmpty() @MaxLength(255)
  fileName!: string

  @ApiProperty({ example: 102400, description: 'bytes' })
  @IsInt() @Min(0)
  fileSize!: number

  @ApiProperty({ example: 'application/pdf' })
  @IsString() @IsNotEmpty() @MaxLength(150)
  mimeType!: string

  /**
   * Required by the schema (`Document.s3Key` / `s3Bucket` are non-nullable) but
   * NOT accepted from the client — a caller must not be able to point a record
   * at an arbitrary object. Callers that have a real file should use
   * POST /documents/upload instead; this endpoint records a placeholder.
   */
}
