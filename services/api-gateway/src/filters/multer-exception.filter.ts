import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, Logger } from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'
import { Prisma } from '@prisma/client'
import { Response } from 'express'
import { PrismaExceptionFilter } from './prisma-exception.filter'
import { MAX_DOCUMENT_BYTES, UPLOAD_ERRORS } from '../documents/document-upload.constants'

/**
 * Multer aborts the request stream when a hard limit is hit, and by default
 * that surfaces as an opaque 500. Without this filter an oversize upload would
 * look like a server crash instead of a validation failure — the CRM needs a
 * 413 with a readable Hebrew message.
 *
 * `multer` is not directly resolvable from this package (it is a transitive
 * dependency of `@nestjs/platform-express`), so the error is matched on
 * `name === 'MulterError'` inside a catch-all rather than via `@Catch(MulterError)`.
 *
 * A catch-all filter must never simply re-throw: a filter's `catch()` is the
 * end of the chain, and re-throwing produces an unhandled rejection and NO
 * response at all — which would silently break every HttpException raised by
 * this controller, including RBAC 403s and tenant-isolation 404s. So everything
 * that is not a MulterError is delegated explicitly:
 *   - Prisma errors → the same `PrismaExceptionFilter` that is registered
 *     globally (a controller-scoped filter runs first and would otherwise
 *     shadow it),
 *   - everything else → `BaseExceptionFilter`, which preserves each
 *     HttpException's own status.
 *
 * Applied per-controller (`@UseFilters`), never globally.
 */
@Catch()
export class MulterExceptionFilter extends BaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(MulterExceptionFilter.name)
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
    // Log the multer code only — never the filename or any file content.
    this.logger.warn(`Upload rejected by multer: ${exception.code}`)

    const message =
      exception.code === 'LIMIT_FILE_SIZE' ? UPLOAD_ERRORS.tooLarge
      : exception.code === 'LIMIT_UNEXPECTED_FILE' ? UPLOAD_ERRORS.missingFile
      : 'העלאת הקובץ נכשלה'

    const statusCode =
      exception.code === 'LIMIT_FILE_SIZE'
        ? HttpStatus.PAYLOAD_TOO_LARGE
        : HttpStatus.BAD_REQUEST

    return res.status(statusCode).json({
      statusCode,
      message,
      error: exception.code,
      maxBytes: MAX_DOCUMENT_BYTES,
    })
  }
}
