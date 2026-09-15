import { PartialType, OmitType } from '@nestjs/swagger'
import { CreateResidentDto } from './create-resident.dto'

/**
 * `apartmentId` is omitted deliberately: moving a resident to another apartment
 * changes which project's threshold they belong to, so it is a separate,
 * separately-audited endpoint (`PATCH /residents/:id/apartment`) rather than a
 * field on a general update.
 */
export class UpdateResidentDto extends PartialType(
  OmitType(CreateResidentDto, ['apartmentId'] as const),
) {}
