import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsNumberString, IsOptional } from 'class-validator'

/**
 * The inputs a goal seek can solve for.
 *
 * Deliberately the same five that the sensitivity grid moves, because they are
 * the ones `applySensitivityFactors` knows how to scale coherently across unit
 * mix, revenue lines, cost lines and the cash-flow allocations that depend on
 * them. Adding a sixth here without teaching that function about it would
 * produce a solve that silently moved nothing.
 */
export const GOAL_SEEK_VARIABLES = [
  'SALE_PRICE',
  'CONSTRUCTION_COST',
  'LAND_COST',
  'INTEREST_RATE',
  'DISCOUNT_RATE',
] as const

export type GoalSeekVariable = (typeof GOAL_SEEK_VARIABLES)[number]

/** The outputs a goal seek can target. Mirrored by `GOAL_SEEK_METRICS`. */
export const GOAL_SEEK_METRIC_NAMES = [
  'PROFIT_MARGIN',
  'PROFIT_ON_COST',
  'PROFIT',
  'PROJECT_IRR_ANNUAL',
  'PROJECT_NPV',
  'RESIDUAL_LAND_VALUE',
] as const

export type GoalSeekMetric = (typeof GOAL_SEEK_METRIC_NAMES)[number]

export class CreateGoalSeekDto {
  @ApiProperty({ enum: GOAL_SEEK_VARIABLES, description: 'The input to solve for' })
  @IsIn(GOAL_SEEK_VARIABLES as unknown as string[])
  variable!: GoalSeekVariable

  @ApiProperty({ enum: GOAL_SEEK_METRIC_NAMES, description: 'The output to hit' })
  @IsIn(GOAL_SEEK_METRIC_NAMES as unknown as string[])
  metric!: GoalSeekMetric

  /**
   * Ratios, not percentages — 0.2 for a 20% margin, matching how the engine
   * reports `profitMargin`. A string so a decimal target survives the trip
   * without a float rounding it first.
   */
  @ApiProperty({ example: '0.2', description: 'Ratios for rate metrics, shekels for amounts' })
  @IsNumberString()
  targetValue!: string

  @ApiPropertyOptional({ default: '0.25', description: 'Lowest multiplier on the input to search' })
  @IsOptional() @IsNumberString()
  lowerFactor?: string

  @ApiPropertyOptional({ default: '4', description: 'Highest multiplier on the input to search' })
  @IsOptional() @IsNumberString()
  upperFactor?: string

  @ApiPropertyOptional({ default: '1e-7', description: 'How close to the target counts as solved' })
  @IsOptional() @IsNumberString()
  tolerance?: string
}
