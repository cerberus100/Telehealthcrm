import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { FastifyReply } from 'fastify'

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest()
    const response = context.switchToHttp().getResponse<FastifyReply>()

    return next.handle().pipe(
      map(data => {
        // Add correlation ID to response headers
        const correlationId = request.headers['correlation-id'] || request.id
        response.header('Correlation-Id', correlationId)

        return data
      })
    )
  }
}
