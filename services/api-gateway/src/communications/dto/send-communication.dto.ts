import {
  IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * Mirrors the Prisma `MessageChannel` enum. Only the three channels the CRM can
 * actually originate are accepted — PUSH / IN_APP / PORTAL are produced by the
 * system, not typed by a user, so allowing them here would let a staff member
 * forge a system notification.
 */
export const SENDABLE_CHANNELS = ['WHATSAPP', 'SMS', 'EMAIL'] as const
export type SendableChannel = (typeof SENDABLE_CHANNELS)[number]

/** See the report — this is a placeholder pending a product decision. */
export const MAX_MESSAGE_BODY_LENGTH = 4000

/**
 * Explicit allow-list for POST /communications.
 *
 * SECURITY: replaces a `{ ...body }` spread which let a client set `status`,
 * `direction`, `sentAt`, `deliveredAt`, `readAt`, `externalId`, `campaignId`,
 * `templateId` and arbitrary `metadata` — i.e. fabricate an INBOUND message
 * from a resident, or mark an unsent message DELIVERED. `direction` and
 * `status` remain server-assigned.
 */
export class SendCommunicationDto {
  @ApiProperty({ enum: SENDABLE_CHANNELS })
  @IsEnum(SENDABLE_CHANNELS, {
    message: `channel must be one of: ${SENDABLE_CHANNELS.join(', ')}`,
  })
  channel!: SendableChannel

  @ApiProperty({ example: 'שלום, נקבעה אסיפת דיירים ליום ג׳.' })
  @IsString() @IsNotEmpty() @MaxLength(MAX_MESSAGE_BODY_LENGTH)
  body!: string

  @ApiPropertyOptional({ description: 'Email subject (EMAIL channel only)' })
  @IsOptional() @IsString() @MaxLength(300)
  subject?: string

  /** Recipient. Verified to exist inside the caller's tenant by the controller. */
  @ApiPropertyOptional()
  @IsOptional() @IsString() @IsNotEmpty()
  residentId?: string

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(32)
  toPhone?: string

  @ApiPropertyOptional()
  @IsOptional() @IsEmail({}, { message: 'toEmail must be a valid email address' })
  toEmail?: string
}
