import {
  IsString, IsOptional, IsIn, IsBoolean, IsObject, MaxLength, MinLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { MAX_TEMPLATE_BODY } from '../template-render'

export const MESSAGE_CHANNELS = ['WHATSAPP', 'SMS', 'EMAIL', 'PUSH', 'IN_APP', 'PORTAL'] as const
export const TEMPLATE_LANGUAGES = ['he', 'en', 'ru', 'ar'] as const
export const WA_CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'] as const

export type MessageChannelName = (typeof MESSAGE_CHANNELS)[number]
export type TemplateLanguage = (typeof TEMPLATE_LANGUAGES)[number]

/**
 * Explicit DTOs, matching the convention established by the meetings module.
 *
 * Note what a caller CANNOT set:
 *   `tenantId`   — taken from the JWT, never the body.
 *   `variables`  — DERIVED from the body/subject text (see `extractVariables`).
 *                  Accepting it would create a second source of truth that
 *                  drifts from the actual placeholders.
 *   `isApproved` — a claim about WhatsApp's external review state. It has its
 *                  own admin-only endpoint, mirroring how `cancelledAt` is
 *                  reachable only through the meetings cancel route.
 */
export class CreateTemplateDto {
  @ApiProperty({ description: 'Unique per tenant + channel + language' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string

  @ApiProperty({ enum: MESSAGE_CHANNELS })
  @IsIn(MESSAGE_CHANNELS as unknown as string[])
  channel!: MessageChannelName

  @ApiPropertyOptional({ enum: TEMPLATE_LANGUAGES, default: 'he' })
  @IsOptional()
  @IsIn(TEMPLATE_LANGUAGES as unknown as string[])
  language?: TemplateLanguage

  @ApiPropertyOptional({ description: 'Email subject. Rejected for non-email channels.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  subject?: string

  @ApiProperty({ description: 'Body text; supports {{variable}} placeholders' })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_TEMPLATE_BODY)
  body!: string

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @ApiPropertyOptional({ description: 'Name registered with the WhatsApp provider' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  waTemplateName?: string

  @ApiPropertyOptional({ enum: WA_CATEGORIES })
  @IsOptional()
  @IsIn(WA_CATEGORIES as unknown as string[])
  waCategory?: string
}

/** Same field set, all optional. `channel`/`language` are immutable — see service. */
export class UpdateTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  subject?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_TEMPLATE_BODY)
  body?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  waTemplateName?: string

  @ApiPropertyOptional({ enum: WA_CATEGORIES })
  @IsOptional()
  @IsIn(WA_CATEGORIES as unknown as string[])
  waCategory?: string
}

export class PreviewTemplateDto {
  @ApiProperty({
    description: 'Values keyed by variable name. Every variable the template uses must be present.',
    type: Object,
  })
  @IsObject()
  values!: Record<string, string | number>
}

export class SetApprovalDto {
  @ApiProperty({ description: 'Whether the WhatsApp provider has approved this template' })
  @IsBoolean()
  isApproved!: boolean
}
