import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { HealthController } from './health.controller'
import { PrismaModule } from './prisma.module'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { AuthModule }           from './auth/auth.module'
import { ProjectsModule }       from './projects/projects.module'
import { ResidentsModule }      from './residents/residents.module'
import { LeadsModule }          from './leads/leads.module'
import { DocumentsModule }      from './documents/documents.module'
import { TasksModule }          from './tasks/tasks.module'
import { CommunicationsModule } from './communications/communications.module'
import { ReportsModule }        from './reports/reports.module'
import { TenantsModule }        from './tenants/tenants.module'
import { UsersModule }          from './users/users.module'
import { DashboardModule }      from './dashboard/dashboard.module'

@Module({
  imports: [
    PrismaModule,
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
    DocumentsModule,
    TasksModule,
    CommunicationsModule,
    ReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
