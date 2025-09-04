import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common'
import { FastifyReply } from 'fastify'

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<FastifyReply>()
    const request = ctx.getRequest()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let code = 'INTERNAL_SERVER_ERROR'
    let message = 'An unexpected error occurred'
    let details = null

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const exceptionResponse = exception.getResponse() as any
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse
      } else if (exceptionResponse && typeof exceptionResponse === 'object') {
        message = exceptionResponse.message || exceptionResponse.error || message
        details = exceptionResponse.details || null
      }

      // Map HTTP status codes to error codes
      switch (status) {
        case HttpStatus.BAD_REQUEST:
          code = 'VALIDATION_ERROR'
          break
        case HttpStatus.UNAUTHORIZED:
          code = 'UNAUTHORIZED'
          break
        case HttpStatus.FORBIDDEN:
          code = 'FORBIDDEN'
          break
        case HttpStatus.NOT_FOUND:
          code = 'RESOURCE_NOT_FOUND'
          break
        case HttpStatus.CONFLICT:
          code = 'CONFLICT'
          break
        case HttpStatus.UNPROCESSABLE_ENTITY:
          code = 'VALIDATION_ERROR'
          break
        case HttpStatus.TOO_MANY_REQUESTS:
          code = 'RATE_LIMIT_EXCEEDED'
          break
        default:
          code = 'HTTP_ERROR'
      }
    }

    const errorResponse = {
      error: {
        code,
        message,
        details,
      },
    }

    // Add correlation ID to response headers
    const correlationId = request.headers['correlation-id'] || request.id
    response.header('Correlation-Id', correlationId)

    response.status(status).send(errorResponse)
  }
}
