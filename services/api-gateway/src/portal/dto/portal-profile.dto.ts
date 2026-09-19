import { IsBoolean, IsEnum, IsOptional, IsString, Length } from 'class-validator'
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger'

/**
 * The only five things a resident may change about themselves.
 *
 * ── WHAT IS ABSENT, AND WHY ─────────────────────────────────────────────────
 *
 * This DTO is an allow-list, and `forbidNonWhitelisted` turns everything left
 * out of it into a 400 rather than a silently dropped field. So the absences
 * are enforcement, not documentation:
 *
 *   `phone`               — it is the LOGIN CREDENTIAL. Changing it changes who
 *                           can sign in, which turns a stolen session into
 *                           permanent ownership of the account. A real change
 *                           flow has to verify the NEW number by OTP; until
 *                           that exists, the request route below puts a human
 *                           in the loop instead.
 *   `email`               — not a credential today, but it is where things get
 *                           sent. Adjacent enough to wait for the same flow.
 *   `firstName`/`lastName`
 *   `nationalId`          — identity on a signed agreement. Not a form field.
 *   `ownershipPercentage` — determines the pinuy-binuy signature threshold.
 *                           Legally consequential; staff record it from title
 *                           documents, not from a toggle.
 *   `signatureStatus`
 *   `isObjecting`         — the resident's legal position, recorded from an
 *                           actual act rather than asserted in an app.
 *   `notes`               — staff's internal notes ABOUT this resident. They do
 *                           not appear in the profile at all, let alone here.
 *   `doNotContact`        — a statutory right, but it silences important
 *                           project notices too, and in a pinuy-binuy process
 *                           failing to inform a resident is an exposure for the
 *                           project. A product and legal decision, not a
 *                           toggle to add in passing.
 *
 * What IS here is the resident's own consent and their own preferences.
 * `ResidentContactService` already treats consent as belonging to the person —
 * under חוק הספאם it does — so these are the fields where self-service is not
 * merely safe but more correct than making them phone the office.
 */
export class UpdatePortalProfileDto {
  @ApiPropertyOptional({ enum: ['he', 'en', 'ru', 'ar'] })
  @IsOptional()
  @IsEnum(['he', 'en', 'ru', 'ar'])
  language?: string

  @ApiPropertyOptional({ enum: ['WHATSAPP', 'SMS', 'EMAIL'] })
  @IsOptional()
  // PUSH and PORTAL are absent on purpose: no push provider exists, and the
  // portal inbox is a staff-side routing decision, not a resident preference.
  @IsEnum(['WHATSAPP', 'SMS', 'EMAIL'])
  preferredChannel?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  whatsappOptIn?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  smsOptIn?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailOptIn?: boolean
}

/**
 * Asking staff to change something the resident may not change themselves.
 *
 * Free text on purpose. A structured `requestedPhone` field would invite an
 * "apply" button in the CRM, and a one-click apply is the account-takeover path
 * this whole arrangement exists to avoid — the human reading the request and
 * satisfying themselves about who is asking IS the control.
 */
export class ContactUpdateRequestDto {
  @ApiProperty({ example: 'המספר החדש שלי הוא 05x-xxxxxxx, נא לעדכן' })
  @IsString()
  @Length(5, 1000)
  message!: string
}
