import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { TelemetryService } from '../utils/telemetry.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelemetryInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TelemetryInterceptor.name);

  constructor(
    private readonly telemetryService: TelemetryService,
    private readonly configService: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    // Extract request information
    const method = request.method;
    const url = request.url;
    const userAgent = request.headers['user-agent'] || 'unknown';
    const correlationId = request.headers['correlation-id'] as string || 'unknown';
    const userId = (request as any).claims?.sub || 'anonymous';
    const orgId = (request as any).claims?.orgId || 'unknown';
    const role = (request as any).claims?.role || 'unknown';

    // Create span for this request
    const span = this.telemetryService.createSpan(`HTTP ${method} ${url}`, {
      'http.method': method,
      'http.url': url,
      'http.user_agent': userAgent,
      'http.request.id': correlationId,
      'user.id': userId,
      'organization.id': orgId,
      'user.role': role,
    });

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        // Set span attributes for successful response
        this.telemetryService.setSpanAttributes(span, {
          'http.status_code': statusCode,
          'http.response.duration_ms': duration,
          'http.response.size_bytes': JSON.stringify(data).length,
        });

        // Record metrics
        this.telemetryService.recordHistogram('http.request.duration', duration, {
          method,
          route: this.extractRoute(url),
          status_code: statusCode.toString(),
          user_role: role,
        });

        this.telemetryService.recordMetric('http.request.count', 1, {
          method,
          route: this.extractRoute(url),
          status_code: statusCode.toString(),
          user_role: role,
        });

        // Add span event for successful completion
        this.telemetryService.addSpanEvent(span, 'request.completed', {
          duration_ms: duration,
          status_code: statusCode,
        });

        span.end();

        // Log successful request
        this.logger.log({
          message: 'Request completed',
          method,
          url,
          statusCode,
          duration,
          correlationId,
          userId,
          orgId,
          role,
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;

        // Set span attributes for error response
        this.telemetryService.setSpanAttributes(span, {
          'http.status_code': statusCode,
          'http.response.duration_ms': duration,
          'error': true,
          'error.message': error.message,
          'error.type': error.constructor.name,
        });

        // Record error metrics
        this.telemetryService.recordHistogram('http.request.duration', duration, {
          method,
          route: this.extractRoute(url),
          status_code: statusCode.toString(),
          user_role: role,
          error: 'true',
        });

        this.telemetryService.recordMetric('http.request.error.count', 1, {
          method,
          route: this.extractRoute(url),
          status_code: statusCode.toString(),
          user_role: role,
          error_type: error.constructor.name,
        });

        // Add span event for error
        this.telemetryService.addSpanEvent(span, 'request.error', {
          duration_ms: duration,
          status_code: statusCode,
          error_message: error.message,
          error_type: error.constructor.name,
        });

        span.end();

        // Log error
        this.logger.error({
          message: 'Request failed',
          method,
          url,
          statusCode,
          duration,
          correlationId,
          userId,
          orgId,
          role,
          error: error.message,
          stack: error.stack,
        });

        throw error;
      }),
    );
  }

  private extractRoute(url: string): string {
    // Extract route pattern from URL for better metrics grouping
    // Remove query parameters and path parameters
    const baseUrl = url?.split('?')[0] || 'unknown'; // Remove query string
    return baseUrl
      .replace(/\/[0-9a-f-]{36}/g, '/:id') // Replace UUIDs with :id
      .replace(/\/[0-9]+/g, '/:id') // Replace numeric IDs with :id
      .toLowerCase();
  }
}
