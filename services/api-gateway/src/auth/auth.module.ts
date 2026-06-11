import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { APP_GUARD } from '@nestjs/core'
import { AuthService }    from './auth.service'
import { AuthController } from './auth.controller'
import { JwtStrategy }    from './strategies/jwt.strategy'
import { JwtAuthGuard }   from './guards/jwt-auth.guard'
import { RolesGuard }     from './guards/roles.guard'

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    // Register JwtAuthGuard globally — all routes protected unless @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  controllers: [AuthController],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
