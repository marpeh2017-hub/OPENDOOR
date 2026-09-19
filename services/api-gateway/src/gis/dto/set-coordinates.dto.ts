import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator'

/**
 * Manual coordinate override.
 *
 * The human correction path for addresses a provider gets wrong — which, for
 * Hebrew street names against public OSM data, is most of them. Deliberately
 * accepts nothing but a coordinate pair and a note: the caller may not set
 * provenance, `source`, or a provider id, because those are assertions the
 * SERVER makes about where a value came from.
 */
export class SetCoordinatesDto {
  @ApiProperty({ example: 32.05916, description: 'Latitude, WGS84 decimal degrees.' })
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  lat!: number

  @ApiProperty({ example: 34.77083, description: 'Longitude, WGS84 decimal degrees.' })
  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  lng!: number

  @ApiPropertyOptional({
    maxLength: 500,
    description: 'Why this coordinate was set by hand — recorded as provenance.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string
}
