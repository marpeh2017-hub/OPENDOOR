import { ApiProperty } from '@nestjs/swagger'
import { IsString, Length } from 'class-validator'

/**
 * An activity logged against a lead.
 *
 * `type` is deliberately a bounded string rather than an enum: the activity
 * vocabulary lives in the service and is not modelled as a Prisma enum, so
 * declaring one here would create a second list to keep in sync. The length
 * bound is what a validated body can honestly promise.
 */
export class AddLeadActivityDto {
  @ApiProperty({ example: 'CALL', maxLength: 64 })
  @IsString()
  @Length(1, 64)
  type!: string

  @ApiProperty({ example: 'שיחה עם הדייר, מעוניין בפגישה', maxLength: 4000 })
  @IsString()
  @Length(1, 4000)
  note!: string
}
