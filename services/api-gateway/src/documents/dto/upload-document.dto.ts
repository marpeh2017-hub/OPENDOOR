import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  DOCUMENT_CATEGORIES, DOCUMENT_STATUSES,
  type DocumentCategoryValue, type DocumentStatusValue,
} from './create-document.dto'

/**
 * Text fields accompanying the file part of POST /documents/upload.
 *
 * Every multipart text field arrives as a `string`, so this DTO contains no
 * numeric or boolean members — `fileName`, `fileSize` and `mimeType` are read
 * from the uploaded file itself and are never client-assertable.
 *
 * `projectId` is REQUIRED here (unlike the metadata-only POST /documents):
 * an uploaded file must be scoped to a parent project so it can never land in
 * an unattributed corner of the tenant bucket.
 */
export class UploadDocumentDto {
  @ApiProperty({ example: 'נסח טאבו — רחוב הרצל 12' })
  @IsString() @IsNotEmpty() @MaxLength(300)
  title!: string

  @ApiProperty({ enum: DOCUMENT_CATEGORIES })
  @IsEnum(DOCUMENT_CATEGORIES, {
    message: `category must be one of: ${DOCUMENT_CATEGORIES.join(', ')}`,
  })
  category!: DocumentCategoryValue

  @ApiProperty({ description: 'Project the document is filed under (required)' })
  @IsString() @IsNotEmpty()
  projectId!: string

  @ApiPropertyOptional({ enum: DOCUMENT_STATUSES, default: 'DRAFT' })
  @IsOptional()
  @IsEnum(DOCUMENT_STATUSES, {
    message: `status must be one of: ${DOCUMENT_STATUSES.join(', ')}`,
  })
  status?: DocumentStatusValue

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(2000)
  description?: string
}
