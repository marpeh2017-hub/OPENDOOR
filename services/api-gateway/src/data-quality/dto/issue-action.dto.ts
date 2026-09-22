import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, Length } from 'class-validator'

/**
 * The note a manager may attach when resolving, ignoring, reopening or starting
 * a data-quality issue.
 *
 * One class for all four transitions because the body is the same in each: the
 * transition itself is in the route, never in the body, so no request can pick
 * a status it was not routed to.
 *
 * Optional throughout — acting without a note is legitimate, and an absent note
 * stays absent rather than becoming an empty string.
 */
export class IssueActionDto {
  @ApiPropertyOptional({ maxLength: 2000, description: 'Free-text note recorded on the resolution history' })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  note?: string
}
