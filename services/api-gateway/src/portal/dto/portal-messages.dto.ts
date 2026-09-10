import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

/**
 * Paging for the resident's message list.
 *
 * ── THE FIRST PORTAL QUERY PARAMETERS, AND WHY THEY ARE ALLOWED ─────────────
 *
 * The rule these endpoints follow is that a resident-facing route never takes a
 * parameter that decides WHOSE data is returned — the session decides that, and
 * anything else is an IDOR waiting to be written. These two do not select an
 * owner; they select how much of the caller's own list to return. That is a
 * different kind of parameter and it is safe.
 *
 * The distinction is enforced rather than merely stated: the global
 * ValidationPipe runs with `forbidNonWhitelisted`, so a request that adds
 * `?residentId=…` is REJECTED with 400 rather than quietly ignored. An
 * ownership parameter cannot be smuggled in beside a paging one.
 */
export class PortalMessagesQueryDto {
  @ApiPropertyOptional({ description: 'How many to return (default 30, max 100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number

  @ApiPropertyOptional({
    description: 'Id of the last message from the previous page — returns the ones after it',
  })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  cursor?: string
}
