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
import { SignaturesModule }     from './signatures/signatures.module'

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
    SignaturesModule,
    DocumentsModule,
    TasksModule,
    CommunicationsModule,
    ReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    // OPEN ITEM — the API is currently unauthenticated.
    //
    // JwtAuthGuard exists (src/auth/guards/jwt-auth.guard.ts) and already
    // honours @Public(), but it is NOT registered here. ThrottlerGuard is the
    // only global guard, so every controller — leads, projects, residents,
    // documents, signatures — serves requests without a token, despite the
    // @ApiBearerAuth() decorators that suggest otherwise.
    //
    // Registering it is a one-line change:
    //     { provide: APP_GUARD, useClass: JwtAuthGuard },
    // but doing so blind would break every caller that does not yet send a
    // bearer token. Before enabling it:
    //   1. Confirm the CRM (apps/crm) and portal (apps/portal) attach a token
    //      to every API call, and fix the ones that do not.
    //   2. Mark the genuinely public endpoints with @Public() — at minimum the
    //      health controller and the auth login/OTP routes.
    //   3. Decide how the marketing site submits leads. It posts through its
    //      own server-side route (apps/web/src/app/api/leads/route.ts), so it
    //      needs either a service credential or an explicitly @Public()
    //      write-only endpoint — not a blanket exemption on LeadsController.
    //   4. Replace the `req.user?.tenantId ?? 'tnt_01'` fallbacks, which
    //      silently default to a hardcoded tenant when no user is present.
  ],
})
export class AppModule {}
