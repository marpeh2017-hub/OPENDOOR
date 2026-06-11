import { SetMetadata } from '@nestjs/common'

export const ROLES_KEY = 'roles'

/** Restrict route to users with specified roles.
 *  @example @Roles('ADMIN', 'PROJECT_MANAGER')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)
