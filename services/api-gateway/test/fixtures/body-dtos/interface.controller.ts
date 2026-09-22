/* eslint-disable */
// An interface looks like a DTO and validates like nothing: `class-validator`
// has no class to hang metadata on, so this must be rejected too.
import { Body, Controller, Post } from '@nestjs/common'

export interface LooksLikeADto {
  name: string
}

@Controller('fixture-interface')
export class InterfaceBodyController {
  @Post()
  create(@Body() body: LooksLikeADto) {
    return body
  }
}
