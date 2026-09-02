import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator'

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
