import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsInt, IsOptional, IsString, Length, Min } from 'class-validator'

/**
 * A signer added to a DRAFT signature package.
 *
 * `tenantId` is absent on purpose: the service takes it from the authenticated
 * token and writes it itself, so no request body can place a signature record
 * in another tenant. `status` and `method` are absent for the same reason —
 * they are decided by the service, not by the caller.
 */
export class AddSignerDto {
  @ApiProperty()
  @IsString()
  @Length(1, 64)
  ownerId!: string

  @ApiProperty()
  @IsString()
  @Length(1, 64)
  apartmentId!: string

  @ApiPropertyOptional({ example: 'OWNER', description: 'Defaults to OWNER when omitted' })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  signerRole?: string

  @ApiPropertyOptional({ description: 'Whether the package can complete without this signature. Defaults to true.' })
  @IsOptional()
  @IsBoolean()
  required?: boolean

  @ApiPropertyOptional({ minimum: 0, description: 'Position in a sequential signing order. Defaults to 0.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  signingOrder?: number
}
