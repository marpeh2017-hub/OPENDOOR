import { IsString, Matches } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class SendOtpDto {
  @ApiProperty({ example: '0501234567', description: 'Israeli mobile number' })
  @IsString()
  @Matches(/^05\d{8}$/, { message: 'Invalid Israeli mobile number' })
  phone!: string
}
