/* eslint-disable */
// Fixtures for check-body-dtos.spec.ts. Never imported by the application —
// each handler here is one of the shapes the build-time check must reject.
import { Body, Controller, Patch, Post } from '@nestjs/common'
import { IsString } from 'class-validator'

export class GoodDto {
  @IsString()
  name!: string
}

@Controller('fixture')
export class OffendingController {
  @Post('extracted')
  extracted(@Body('code') code: string) {
    return code
  }

  @Post('any')
  anyBody(@Body() body: any) {
    return body
  }

  @Patch('inline')
  inline(@Body() body: { note?: string }) {
    return body
  }

  @Patch('record')
  record(@Body() body: Record<string, unknown>) {
    return body
  }

  @Post('interface')
  iface(@Body() body: { a: string } & { b: string }) {
    return body
  }

  @Post('ok')
  ok(@Body() body: GoodDto) {
    return body
  }
}
