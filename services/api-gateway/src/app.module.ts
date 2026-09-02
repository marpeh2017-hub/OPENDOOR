import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { HealthController } from './health.controller'
import { PrismaModule } from './prisma.module'
import { CryptoModule } from './crypto/crypto.module'
import { CommonModule } from './common/common.module'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { RedisModule }          from './redis/redis.module'
import { SmsModule }            from './sms/sms.module'
import { StorageModule }        from './storage/storage.module'
import { AuthModule }           from './auth/auth.module'
import { ProjectsModule }       from './projects/projects.module'
import { ResidentsModule }      from './residents/residents.module'
import { OwnersModule }         from './owners/owners.module'
import { BuildingsModule }      from './buildings/buildings.module'
import { LeadsModule }          from './leads/leads.module'
import { DocumentsModule }      from './documents/documents.module'
import { ImportsModule }        from './imports/imports.module'
import { TasksModule }          from './tasks/tasks.module'
import { CommunicationsModule } from './communications/communications.module'
import { ReportsModule }        from './reports/reports.module'
import { TenantsModule }        from './tenants/tenants.module'
import { UsersModule }          from './users/users.module'
import { DashboardModule }      from './dashboard/dashboard.module'
import { SignaturesModule }     from './signatures/signatures.module'
import { DataQualityModule }    from './data-quality/data-quality.module'
import { ProjectHealthModule }  from './health/health.module'
import { GisModule }            from './gis/gis.module'
import { NotificationsModule }  from './notifications/notifications.module'
import { MeetingsModule }       from './meetings/meetings.module'
import { CmsModule } from './cms/cms.module'
import { MessagingModule }      from './messaging/messaging.module'
import { FeasibilityModule }    from './feasibility/feasibility.module'
import { TemplatesModule }      from './templates/templates.module'
import { AutomationsModule }    from './automations/automations.module'

@Module({
  imports: [
    PrismaModule,
    CryptoModule,
    CommonModule,
    RedisModule,
    SmsModule,
    StorageModule,
    ThrottlerModule.forRoot([
      { name: 'short',  ttl: 1000,  limit: 20  },
      { name: 'medium', ttl: 10000, limit: 100 },
      { name: 'long',   ttl: 60000, limit: 300 },
    ]),
    AuthModule,
    TenantsModule,
    UsersModule,
    DashboardModule,
    LeadsModule,
    ProjectsModule,
    ResidentsModule,
    OwnersModule,
    BuildingsModule,
    GisModule,
    SignaturesModule,
    DataQualityModule,
    ProjectHealthModule,
    DocumentsModule,
    ImportsModule,
    TasksModule,
    NotificationsModule,
    // Messaging must be imported before the modules that emit through it, so a
    // DI failure in the dispatcher surfaces at boot rather than at first send.
    MessagingModule,
    TemplatesModule,
    AutomationsModule,
    FeasibilityModule,
    MeetingsModule,
    CmsModule,
    CommunicationsModule,
    ReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
