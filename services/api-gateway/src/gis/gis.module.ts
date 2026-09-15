import { Module } from '@nestjs/common'
import { GisController } from './gis.controller'
import { GisService } from './gis.service'
import { GisGeocodeService } from './gis-geocode.service'
import { GeocodingService } from './geocoding/geocoding.service'
import { GEOCODING_PROVIDER } from './geocoding/geocoding.types'
import { NominatimGeocodingProvider } from './geocoding/nominatim.provider'

/**
 * The concrete geocoding provider is bound in exactly ONE place — here.
 *
 * Everything downstream depends on the `GeocodingProvider` interface via the
 * `GEOCODING_PROVIDER` token, so replacing Nominatim with govmap, a commercial
 * geocoder, or a self-hosted Nominatim (which would fix the Hebrew-indexing
 * limitation documented on the provider) is a change to this binding and
 * nothing else.
 */
@Module({
  controllers: [GisController],
  providers: [
    GisService,
    GisGeocodeService,
    GeocodingService,
    { provide: GEOCODING_PROVIDER, useClass: NominatimGeocodingProvider },
  ],
  exports: [GisService, GisGeocodeService, GeocodingService],
})
export class GisModule {}
