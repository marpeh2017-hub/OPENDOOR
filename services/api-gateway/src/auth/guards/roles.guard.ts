import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from '../decorators/roles.decorator'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // @Public() routes carry no authenticated user (the signature portal is
    // token-authenticated instead). They must bypass the role check entirely,
    // otherwise a class-level @Roles() default would lock them out.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!requiredRoles || requiredRoles.length === 0) return true

    const { user } = context.switchToHttp().getRequest<{ user: { role: string } }>()

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(`נדרשת הרשאה: ${requiredRoles.join(' או ')}`)
    }

    return true
  }
}
