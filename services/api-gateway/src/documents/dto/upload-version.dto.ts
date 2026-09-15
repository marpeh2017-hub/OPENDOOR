import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { DOCUMENT_STATUSES, type DocumentStatusValue } from './create-document.dto'

/**
 * Text fields accompanying POST /documents/:id/versions.
 *
 * Everything is OPTIONAL, and everything absent is INHERITED from the version
 * chain's root. That is the point of the endpoint: a corrected נסח טאבו is the
 * same document filed under the same project and category, so re-stating them
 * would be an invitation to file version 2 somewhere version 1 is not.
 *
 * `projectId` and `category` are deliberately NOT accepted at all — allowing
 * either would let a "new version" silently move a document to another project
 * (a tenant-boundary-adjacent move) or change what kind of document it is,
 * neither of which is a version. Those need a new document.
 */
export class UploadDocumentVersionDto {
  @ApiPropertyOptional({ description: 'Override the title. Inherited from the root if omitted.' })
  @IsOptional() @IsString() @MaxLength(300)
  title?: string

  @ApiPropertyOptional({ enum: DOCUMENT_STATUSES })
  @IsOptional()
  @IsEnum(DOCUMENT_STATUSES, {
    message: `status must be one of: ${DOCUMENT_STATUSES.join(', ')}`,
  })
  status?: DocumentStatusValue

  @ApiPropertyOptional({ description: 'What changed in this version.' })
  @IsOptional() @IsString() @MaxLength(2000)
  description?: string
}
