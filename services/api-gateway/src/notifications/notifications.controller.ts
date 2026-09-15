import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, Request,
  HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { STAFF_ROLES } from '../auth/roles.constants'
import { NotificationsService } from './notifications.service'
import {
  CreateNotificationDto, ListNotificationsQueryDto, MarkReadDto,
} from './dto/notification.dto'
import { actorFrom } from '../common/actor'
import { mapDomainErrors } from '../common/errors/domain-error'

/**
 * Notifications API.
 *
 * RBAC HERE IS UNUSUAL, AND DELIBERATELY SO
 * -----------------------------------------
 * Every other module gates by role because the question is "may this role touch
 * this kind of record". Notifications are addressed to a PERSON, so the real
 * question is "is this row yours", and that is enforced in the service by
 * filtering on the JWT's `userId` — not by a role list and not by any path
 * parameter. There is no id a caller can pass to read someone else's
 * notifications, so there is nothing for a role check to protect on the read
 * paths beyond "is this a staff account at all".
 *
 * `@Roles(...STAFF_ROLES)` therefore appears on the class as the outer fence:
 * RESIDENT accounts (portal users) get 403 from every route here, because the
 * resident portal has its own surfaces and must not acquire a staff inbox by
 * discovering this path.
 *
 * POST is the one route where the caller acts on someone ELSE's row. It is
 * still STAFF_ROLES rather than MANAGER_ROLES — a field agent flagging
 * something to a project manager is the ordinary case — but the recipient must
 * be in the caller's tenant, and a recipient outside it answers 404 rather than
 * 403 so the endpoint cannot be used to test whether a user id exists.
 */
@ApiTags('notifications')
@ApiBearerAuth()
@Roles(...STAFF_ROLES)
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "List the CALLER'S OWN notifications (never anyone else's)" })
  findMine(@Request() req: any, @Query() query: ListNotificationsQueryDto) {
    return mapDomainErrors(() => this.notifications.findMine(actorFrom(req), query))
  }

  /**
   * Bell badge. Kept separate from GET / because the CRM polls this on an
   * interval and it must stay one indexed COUNT.
   */
  @Get('unread-count')
  @ApiOperation({ summary: 'Unread count for the caller' })
  unreadCount(@Request() req: any) {
    return mapDomainErrors(() => this.notifications.unreadCount(actorFrom(req)))
  }

  @Post()
  @ApiOperation({ summary: 'Send a notification to another user in the same tenant' })
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: any, @Body() dto: CreateNotificationDto) {
    return mapDomainErrors(() => this.notifications.createAsActor(actorFrom(req), dto))
  }

  /**
   * NOTE the route order: `read-all` is declared BEFORE `:id/read` would be
   * ambiguous with it. It is a distinct path segment so there is no conflict
   * today, but keeping the literal route above the parameterised ones is the
   * habit that prevents `/notifications/read-all` being parsed as an id.
   */
  @Patch('read-all')
  @ApiOperation({ summary: 'Mark every unread notification of the caller as read' })
  markAllRead(@Request() req: any) {
    return mapDomainErrors(() => this.notifications.markAllRead(actorFrom(req)))
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification read or unread (404 if not the caller’s)' })
  setRead(@Request() req: any, @Param('id') id: string, @Body() dto: MarkReadDto) {
    return mapDomainErrors(() =>
      this.notifications.setRead(actorFrom(req), id, dto.isRead ?? true),
    )
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Dismiss one of the caller’s own notifications' })
  remove(@Request() req: any, @Param('id') id: string) {
    return mapDomainErrors(() => this.notifications.remove(actorFrom(req), id))
  }
}
