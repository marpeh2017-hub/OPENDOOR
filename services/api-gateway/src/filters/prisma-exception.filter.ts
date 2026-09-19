import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { Response } from 'express'

@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name)

  catch(
    exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const { code, meta } = exception
      // Log internally without leaking PII
      this.logger.error(`Prisma error ${code}`, { code, target: meta?.target })

      const statusMap: Record<string, number> = {
        P2002: HttpStatus.CONFLICT,
        P2025: HttpStatus.NOT_FOUND,
        P2003: HttpStatus.BAD_REQUEST,
        P2011: HttpStatus.BAD_REQUEST,
      }
      const messageMap: Record<string, string> = {
        P2002: 'רשומה כבר קיימת',
        P2025: 'רשומה לא נמצאה',
        P2003: 'עקב תלות במידע אחר לא ניתן לבצע פעולה זו',
        P2011: 'שדה חובה חסר',
      }
      return res.status(statusMap[code] ?? 400).json({
        statusCode: statusMap[code] ?? 400,
        message:    messageMap[code] ?? 'שגיאת מסד נתונים',
        error:      code,
      })
    }

    // PrismaClientValidationError — bad input shape
    this.logger.warn('Prisma validation error', { message: exception.message.slice(0, 200) })
    return res.status(400).json({
      statusCode: 400,
      message:    'בקשה לא תקינה',
      error:      'VALIDATION_ERROR',
    })
  }
}
