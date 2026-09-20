import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { ArrayMaxSize, ArrayMinSize, IsIn, IsString, MaxLength, ValidateNested } from 'class-validator'

export class ChatMessageDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant'

  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @MaxLength(4000)
  content!: string
}

/**
 * The whole conversation, resent on every turn — same shape as the website's
 * /api/faq-chat client. `ArrayMaxSize` bounds how much of it this endpoint
 * will read (and therefore how many tokens one request can cost), same
 * purpose as the website route's `MAX_HISTORY_MESSAGES` slice.
 */
export class PortalChatDto {
  @ApiProperty({ type: [ChatMessageDto] })
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  messages!: ChatMessageDto[]
}
