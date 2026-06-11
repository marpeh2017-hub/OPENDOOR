import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export interface CurrentUserPayload {
  userId:    string
  email:     string
  role:      string
  tenantId:  string
  sessionId: string
}

/** Injects the current authenticated user from the request.
 *  @example login(@CurrentUser() user: CurrentUserPayload) {}
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: CurrentUserPayload }>()
    return request.user
  },
)
