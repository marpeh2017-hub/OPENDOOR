import { IsEmail, IsString, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class LoginDto {
  @ApiProperty({ example: 'admin@opendoor.co.il' })
  @IsEmail()
  email!: string

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password!: string
}
