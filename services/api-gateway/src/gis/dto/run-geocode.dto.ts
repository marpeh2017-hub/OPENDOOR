import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { GEO_ENTITY_KINDS, MAX_SWEEP_BATCH, type GeoEntityKind } from '../gis-geocode.service'

/**
 * Body for the admin-triggered geocode sweep.
 *
 * Explicit DTO, allow-list only. `ValidationPipe` runs with
 * `forbidNonWhitelisted`, so anything not declared here is a 400 rather than
 * something that quietly reaches the service.
 */
export class RunGeocodeDto {
  @ApiPropertyOptional({
    enum: GEO_ENTITY_KINDS,
    isArray: true,
    description: 'Entity kinds to sweep. Omit for all three.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsEnum(GEO_ENTITY_KINDS, { each: true })
  kinds?: GeoEntityKind[]

  @ApiPropertyOptional({ description: 'Restrict the sweep to one project.' })
  @IsOptional()
  @IsString()
  projectId?: string

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_SWEEP_BATCH,
    description:
      `Maximum entities to resolve in this run (hard cap ${MAX_SWEEP_BATCH}). ` +
      'The provider is limited to 1 request/second, so a run of N takes at least N seconds.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SWEEP_BATCH)
  limit?: number

  @ApiPropertyOptional({
    description:
      'Re-ask the provider for entities that already have coordinates, bypassing the cache. ' +
      'Overwrites geocoded values; use with care.',
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean
}
