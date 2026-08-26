import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { APP_GUARD } from '@nestjs/core'
import { AuthService }    from './auth.service'
import { AuthController } from './auth.controller'
import { JwtStrategy }    from './strategies/jwt.strategy'
import { JwtAuthGuard }   from './guards/jwt-auth.guard'
import { RolesGuard }     from './guards/roles.guard'
import { RedisModule }    from '../redis/redis.module'

@Module({
  imports: [
    RedisModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: (() => {
        if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required')
        return process.env.JWT_SECRET
      })(),
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
