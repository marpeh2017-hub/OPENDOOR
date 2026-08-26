import { IsEnum } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/**
 * The set of lead statuses the API accepts. Mirrors the Prisma `LeadStatus`
 * enum exactly — declared here as a literal rather than imported so that a
 * schema change surfaces as a compile/test failure instead of silently
 * widening what callers may send.
 */
export const LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'MEETING_SCHEDULED',
  'INTERESTED',
  'NEGOTIATION',
  'SIGNED',
  'LOST',
] as const

export type LeadStatusValue = (typeof LEAD_STATUSES)[number]

export class UpdateLeadStatusDto {
  @ApiProperty({ enum: LEAD_STATUSES, example: 'CONTACTED' })
  @IsEnum(LEAD_STATUSES, {
    message: `status must be one of: ${LEAD_STATUSES.join(', ')}`,
  })
  status!: LeadStatusValue
}
