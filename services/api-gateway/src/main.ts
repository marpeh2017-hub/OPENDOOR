import { NestFactory } from '@nestjs/core'
import { ValidationPipe, VersioningType } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import helmet from 'helmet'
import compression from 'compression'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  })

  // Security
  app.use(helmet())
  app.use(compression())

  // CORS – allow CRM and Portal origins
  app.enableCors({
    origin: [
      process.env['CRM_URL'] ?? 'http://localhost:3001',
      process.env['PORTAL_URL'] ?? 'http://localhost:3002',
      process.env['WEB_URL'] ?? 'http://localhost:3000',
    ],
    credentials: true,
  })

  // Global prefix + versioning
  app.setGlobalPrefix('api')
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })

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
    .setDescription('OpenDoor התחדשות עירונית – Enterprise API')
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

  const port = process.env['PORT'] ?? 4000
  await app.listen(port)
  console.log(`🚀 API Gateway running on http://localhost:${port}/api`)
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`)
}

bootstrap()
