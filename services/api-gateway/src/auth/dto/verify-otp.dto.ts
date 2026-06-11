import { IsString, Length, Matches } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class VerifyOtpDto {
  @ApiProperty({ example: '0501234567' })
  @IsString()
  @Matches(/^05\d{8}$/)
  phone!: string

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  code!: string
}
