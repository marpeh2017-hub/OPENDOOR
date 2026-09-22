import 'dotenv/config'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { ValidationPipe, VersioningType } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import helmet from 'helmet'
import compression from 'compression'
import { AppModule } from './app.module'
import { PrismaExceptionFilter } from './filters/prisma-exception.filter'
import { validateSignatureConfig } from './config/signature-config.validator'
import { validateAllowlistConfiguration } from './automations/webhook-allowlist'
import { validatePrismaEngine } from './config/prisma-engine.validator'
import { MessagingConfig } from './messaging/messaging.config'

async function bootstrap() {
  /**
   * Checked BEFORE Nest boots, so the failure is one clear message instead of a
   * DI stack trace from PrismaService.onModuleInit. More than one tool works in
   * this repository, and any `prisma generate` run with Accelerate flags
   * silently rewrites the shared generated client under node_modules.
   */
  validatePrismaEngine()

  /**
   * Whether real people receive real messages must be a stated decision, not an
   * inherited default. In production `MESSAGING_SIMULATE` is mandatory, and
   * this throws here — before Nest boots — so a misconfigured deployment fails
   * immediately with one clear message rather than at the first reminder.
   */
  MessagingConfig.assertConfigured()

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger:  ['error', 'warn', 'log', 'debug'],
    rawBody: true, // enables req.rawBody for webhook HMAC verification
  })

  /**
   * Proxy trust — required for per-IP rate limiting to mean anything.
   *
   * `ThrottlerGuard` buckets on `req.ips[0] ?? req.ip`. Express only populates
   * `req.ips` from `X-Forwarded-For` when `trust proxy` is set, so BEHIND A
   * LOAD BALANCER with this disabled every visitor shares the load balancer's
   * single IP — the public lead form's limiter would then throttle all of the
   * internet as one client.
   *
   * It is opt-in rather than always-on because the opposite failure is just as
   * bad: with no proxy in front, trusting `X-Forwarded-For` lets any client
   * spoof its own identity and bypass the limiter entirely. Set TRUST_PROXY to
   * the number of proxy hops in front of this service (usually `1`), or to
   * `true` only if the platform guarantees the header.
   */
  const trustProxy = process.env['TRUST_PROXY']?.trim()
  if (trustProxy) {
    const hops = Number(trustProxy)
    app.set('trust proxy', Number.isFinite(hops) ? hops : trustProxy)
  }

  // Security
  // Helmet's defaults are already right for an API — CSP `default-src 'self'`,
  // HSTS at a year, nosniff, COOP/CORP same-origin. Two things it does not do:
  //
  //   frameguard defaults to SAMEORIGIN. Nothing here is ever meant to render in
  //   a frame, not even our own, so DENY is the accurate statement.
  //
  //   Permissions-Policy is not set at all. An API has no use for a camera or a
  //   microphone, and saying so costs one header.
  app.use(helmet({ frameguard: { action: 'deny' } }))
  app.use((_req: any, res: any, next: any) => {
    res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), payment=()')
    next()
  })
  app.use(compression())

  // CORS ג€“ allow CRM and Portal origins
  app.enableCors({
    origin: [
      process.env['CRM_URL'] ?? 'http://localhost:3001',
      process.env['PORTAL_URL'] ?? 'http://localhost:3002',
      process.env['WEB_URL'] ?? 'http://localhost:3000',
      process.env['WEBSITE_URL'] ?? 'http://localhost:3003',
    ],
    credentials: true,
  })

  // Global prefix + versioning
  app.setGlobalPrefix('api')
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })

  // Global exception filters
  app.useGlobalFilters(new PrismaExceptionFilter())

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  // OpenAPI / Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Urban Renewal OS API')
    .setDescription('OpenDoor ׳”׳×׳—׳“׳©׳•׳× ׳¢׳™׳¨׳•׳ ׳™׳× ג€“ Enterprise API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth',          'Authentication & Sessions')
    .addTag('tenants',       'Multi-tenant management')
    .addTag('users',         'User management')
    .addTag('leads',         'Lead management')
    .addTag('projects',      'Project lifecycle')
    .addTag('residents',     'Resident management')
    .addTag('buildings',     'Building & apartment management')
    .addTag('documents',     'Document management')
    .addTag('signatures',    'Digital signature workflows')
    .addTag('communications','Messaging & campaigns')
    .addTag('tasks',         'Task management')
    .addTag('meetings',      'Meeting management')
    .addTag('automations',   'Automation engine')
    .addTag('reports',       'Reporting & analytics')
    .addTag('gis',           'GIS & mapping')
    .addTag('ai',            'AI features')
    .build()

  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  })

  // Validate production configuration (throws if misconfigured in production)
  validateSignatureConfig()

  /**
   * Refuse to boot with an internal address in the webhook allowlist.
   *
   * An operator who put 169.254.169.254 or a 10.x host there has made a mistake
   * that turns automation webhooks into an SSRF tool. Failing at startup is the
   * only point at which that is cheap to notice.
   */
  validateAllowlistConfiguration()

  const port = process.env['PORT'] ?? 4000
  await app.listen(port)
  console.log(`API Gateway running on http://localhost:${port}/api`)
  console.log(`Swagger docs: http://localhost:${port}/api/docs`)
}

/**
 * Top-level entrypoint. The rejection handler is not decoration: without it a
 * failure inside `bootstrap()` (a bad JWT_SECRET, an unreachable database, an
 * invalid webhook allowlist) surfaces as an unhandled rejection, which Node
 * reports without the exit code a supervisor needs to restart or fail a deploy.
 */
bootstrap().catch((err) => {
   
  console.error('Fatal: API Gateway failed to start:', err)
  process.exit(1)
})


