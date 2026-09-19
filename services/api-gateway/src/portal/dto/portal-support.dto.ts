import { IsIn, IsOptional, IsString, Length } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * Categories a resident may choose when opening a ticket.
 *
 * `SupportTicket.category` is a free-form `String?` in the schema, which is
 * exactly the kind of column that fills up with forty spellings of the same
 * thing. This list is the portal's contribution to keeping it usable — and it
 * deliberately does NOT include `CONTACT_UPDATE`, which has its own flow on the
 * profile page precisely because it needs the "already one open" rule and a
 * notification to the project manager.
 */
export const RESIDENT_TICKET_CATEGORIES = [
  'GENERAL',
  'SIGNATURE',
  'DOCUMENTS',
  'MEETING',
  'CONSTRUCTION',
  'COMPENSATION',
  'OTHER',
] as const

export class CreateSupportTicketDto {
  @ApiProperty({ example: 'שאלה על לוח הזמנים' })
  @IsString()
  @Length(3, 200)
  subject!: string

  @ApiProperty({ example: 'רציתי לברר מתי צפוי להתחיל הפינוי בבניין שלי' })
  @IsString()
  @Length(10, 5000)
  description!: string

  @ApiPropertyOptional({ enum: RESIDENT_TICKET_CATEGORIES })
  @IsOptional()
  @IsIn(RESIDENT_TICKET_CATEGORIES as unknown as string[])
  category?: string
}

/**
 * A reply from the resident.
 *
 * `isInternal` is absent and unreachable: it is the flag that separates staff's
 * private notes from the conversation, and a resident able to set it could
 * write into the channel meant to be hidden from them. It is server-assigned
 * `false` on every reply this endpoint creates.
 */
export class CreateTicketReplyDto {
  @ApiProperty({ example: 'תודה, זה עונה על השאלה' })
  @IsString()
  @Length(1, 5000)
  body!: string
}
