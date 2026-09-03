import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Allow, IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator'

/**
 * DTOs for the Site Manager.
 *
 * NOTE WHAT IS ABSENT: none of these carries `tenantId`, `createdById`,
 * `updatedById`, `publishedById` or a publication state that could be set to
 * PUBLISHED. Those are all server-decided. A DTO field is a field the browser
 * can choose, so the absence is the enforcement — a `@IsString() tenantId`
 * here would undo the tenancy model no matter what the service did with it.
 */

export const CMS_KINDS = ['PAGE', 'PROJECT', 'ARTICLE', 'FAQ_ITEM', 'NAVIGATION', 'SETTINGS'] as const

export class SaveContentDto {
  @ApiProperty({ description: 'The full block tree as the editor now has it' })
  @IsObject()
  draft!: Record<string, unknown>

  @ApiPropertyOptional({ description: 'Per-locale SEO metadata' })
  @IsOptional()
  @IsObject()
  seo?: Record<string, unknown>

  @ApiPropertyOptional({ description: 'One-line note describing the change' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  summary?: string

  /**
   * The revision the editor loaded. When supplied and stale, the save is
   * refused with 409 rather than overwriting a colleague's work.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expectedRevisionId?: string
}

export class SetStateDto {
  @ApiProperty({ enum: ['DRAFT', 'IN_REVIEW'] })
  @IsIn(['DRAFT', 'IN_REVIEW'])
  state!: 'DRAFT' | 'IN_REVIEW'
}

export class ListContentQueryDto {
  @ApiPropertyOptional({ enum: CMS_KINDS })
  @IsOptional()
  @IsIn(CMS_KINDS as unknown as string[])
  kind?: string

  @ApiPropertyOptional({ enum: ['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED'])
  state?: string
}

/**
 * Setting a material fact's value.
 *
 * `value` is deliberately untyped: a fact may be a number, a string, a boolean
 * or a localised object, and the shape is governed by which field it is rather
 * than by this DTO. What matters here is what is ABSENT — no `status`, no
 * `verifiedBy`, no `verifiedAt`. A caller cannot declare its own edit verified;
 * only `POST .../verify` can, and only with the VERIFY capability.
 */
export class SetFactDto {
  /*
   * `@Allow()` is load-bearing, not decoration.
   *
   * The global ValidationPipe runs with `whitelist: true`, which STRIPS every
   * property that carries no class-validator decorator. `@ApiProperty` is a
   * Swagger decorator and does not count, so without this the value silently
   * never arrived and every fact edit wrote `undefined` — a 200 response that
   * erased the field it was meant to set.
   *
   * `@Allow` permits the property through without constraining its type, which
   * is what is wanted here: a fact may be a number, a string, a boolean or a
   * localised object, and which one is governed by the field rather than by
   * this DTO.
   */
  @ApiProperty({ description: 'The new value. Type depends on the field.' })
  @Allow()
  value!: unknown

  @ApiPropertyOptional({ description: 'Which source in the project backs this' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceId?: string

  @ApiPropertyOptional({ description: 'Where inside the source, e.g. a sheet or page' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  sourceReference?: string

  @ApiPropertyOptional({ description: 'Note for the audit trail' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string
}

/** Signing for a fact. Again: no `status` — the server derives it. */
export class VerifyFactDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  sourceReference?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string

  /**
   * Ask for a second pair of eyes on this field. Produces
   * SECOND_REVIEW_REQUIRED, which is deliberately NOT publishable.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresSecondReview?: boolean
}
