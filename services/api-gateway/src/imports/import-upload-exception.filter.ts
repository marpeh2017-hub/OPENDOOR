import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, Logger } from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'
import { Prisma } from '@prisma/client'
import { Response } from 'express'
import { PrismaExceptionFilter } from '../filters/prisma-exception.filter'
import { MAX_IMPORT_BYTES, IMPORT_ERRORS } from './excel-import.constants'

/**
 * The import twin of `MulterExceptionFilter`.
 *
 * It exists rather than reusing that filter because that one reports
 * `MAX_DOCUMENT_BYTES` and the document module's Hebrew strings. The two limits
 * are independently configurable (`MAX_IMPORT_BYTES` vs `MAX_DOCUMENT_BYTES`),
 * so sharing the filter would tell a user rejected at the import limit the
 * wrong number the moment the two diverge.
 *
 * The delegation discipline is copied verbatim and matters just as much here: a
 * catch-all filter's `catch()` is the END of the chain, so re-throwing produces
 * an unhandled rejection and NO response. Anything that is not a MulterError is
 * therefore handed on explicitly — Prisma errors to `PrismaExceptionFilter`
 * (which is registered globally and would otherwise be shadowed by this
 * controller-scoped filter), everything else to `BaseExceptionFilter`, which
 * preserves each HttpException's own status. Without that, this filter would
 * silently swallow the RBAC 403s and tenant-isolation 404s the import endpoints
 * depend on.
 */
@Catch()
export class ImportUploadExceptionFilter extends BaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ImportUploadExceptionFilter.name)
  private readonly prismaFilter = new PrismaExceptionFilter()

  catch(exception: any, host: ArgumentsHost) {
    if (exception?.name !== 'MulterError') {
      if (
        exception instanceof Prisma.PrismaClientKnownRequestError ||
        exception instanceof Prisma.PrismaClientValidationError
      ) {
        return this.prismaFilter.catch(exception, host)
      }
      return super.catch(exception, host)
    }

    const res = host.switchToHttp().getResponse<Response>()
    // The code only — never the filename, and certainly never file content.
    this.logger.warn(`Import upload rejected by multer: ${exception.code}`)

    const message =
      exception.code === 'LIMIT_FILE_SIZE' ? IMPORT_ERRORS.tooLarge
      : exception.code === 'LIMIT_UNEXPECTED_FILE' ? IMPORT_ERRORS.missingFile
      : 'העלאת הקובץ נכשלה'

    const statusCode =
      exception.code === 'LIMIT_FILE_SIZE'
        ? HttpStatus.PAYLOAD_TOO_LARGE
        : HttpStatus.BAD_REQUEST

    return res.status(statusCode).json({
      statusCode,
      message,
      error: exception.code,
      maxBytes: MAX_IMPORT_BYTES,
    })
  }
}
