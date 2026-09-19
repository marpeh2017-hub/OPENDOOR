import { IsString, Length } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/**
 * Sharing a document with a resident.
 *
 * Only the resident is named. The document comes from the path and the tenant
 * from the authenticated session, so there is no field here through which a
 * caller could redirect the grant somewhere else.
 */
export class ShareDocumentDto {
  @ApiProperty({ description: 'The resident to share this document with' })
  @IsString()
  @Length(1, 64)
  residentId!: string
}
