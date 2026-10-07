import { IsString, MaxLength, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'יש להזין את הסיסמה הנוכחית.' })
  @MaxLength(200)
  currentPassword!: string

  /** Checked in full by `passwordProblem` (../password-policy.ts). */
  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12, { message: 'הסיסמה צריכה לכלול לפחות 12 תווים.' })
  @MaxLength(200)
  newPassword!: string
}
