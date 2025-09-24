import { Injectable, NestMiddleware, HttpException, HttpStatus, Inject } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { RateLimitConfigService } from '../config/rate-limit.config';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: FastifyRequest) => string;
}

interface RateLimitInfo {
  count: number;
  resetTime: number;
  remaining: number;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private readonly redis?: Redis;
  private readonly rateLimitConfig: RateLimitConfigService;
  private readonly disabled: boolean;

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(RateLimitConfigService) rateLimitConfigService: RateLimitConfigService
  ) {
    this.rateLimitConfig = rateLimitConfigService;
    this.disabled = this.configService.get<string>('API_DEMO_MODE') === 'true';

    if (!this.disabled) {
      // Initialize Redis connection
      this.redis = new Redis({
        host: this.configService.get('REDIS_HOST', 'localhost') as string,
        port: Number(this.configService.get('REDIS_PORT', 6379)),
        password: this.configService.get('REDIS_PASSWORD') as string | undefined,
        maxRetriesPerRequest: 3,
      });

      // Handle Redis connection errors
      if (this.redis) {
        this.redis.on('error', (error) => {
          this.logger.error('Redis connection error:', error);
        });
      }
    }

    this.logger.log({
      action: 'RATE_LIMIT_MIDDLEWARE_INITIALIZED',
      disabled: this.disabled,
      redis_connected: !!this.redis
    });
  }

  async use(req: FastifyRequest, res: FastifyReply, next: (err?: unknown) => void) {
    if (this.disabled) {
      next();
      return;
    }

    try {
      const rateLimitConfig = this.rateLimitConfig.getConfiguration();

      // Check if request should be rate limited
      if (!this.rateLimitConfig.shouldRateLimit(req)) {
        next();
        return;
      }

      // Get applicable strategies for this request
      const applicableStrategies = this.rateLimitConfig.getApplicableStrategies(req);

      // Apply rate limiting for each applicable strategy
      for (const strategy of applicableStrategies) {
        const key = strategy.keyGenerator!(req);
        const rateLimitInfo = await this.getRateLimitInfo(key, strategy);

        // Check if limit exceeded
        if (rateLimitInfo.count >= strategy.maxRequests) {
          // Set rate limit headers
          this.setRateLimitHeaders(res, rateLimitInfo, strategy);

          // Log rate limit exceeded
          this.logger.warn({
            action: 'RATE_LIMIT_EXCEEDED',
            key,
            count: rateLimitInfo.count,
            maxRequests: strategy.maxRequests,
            strategy: strategy.name,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            path: req.routeOptions.url,
            method: req.method,
          });

          throw new HttpException(
            {
              error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: `Rate limit exceeded for ${strategy.name}`,
                details: {
                  limit: strategy.maxRequests,
                  remaining: 0,
                  resetTime: rateLimitInfo.resetTime,
                  strategy: strategy.name,
                },
              },
            },
            HttpStatus.TOO_MANY_REQUESTS
          );
        }

        // Increment counter
        await this.incrementCounter(key, strategy);

        // Set rate limit headers
        this.setRateLimitHeaders(res, {
          count: rateLimitInfo.count + 1,
          resetTime: rateLimitInfo.resetTime,
          remaining: strategy.maxRequests - (rateLimitInfo.count + 1),
        }, strategy);
      }

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error({
        action: 'RATE_LIMIT_ERROR',
        error: (error as Error).message,
        path: req.routeOptions.url,
        method: req.method,
      });

      // Don't block requests if rate limiting fails
      next();
    }
  }

  private async getRateLimitInfo(key: string, strategy: any): Promise<RateLimitInfo> {
    try {
      const data = await this.redis!.get(key);

      if (!data) {
        return {
          count: 0,
          resetTime: Date.now() + strategy.windowMs,
          remaining: strategy.maxRequests,
        };
      }

      const parsed = JSON.parse(data);
      const now = Date.now();

      // Check if window has expired
      if (now > parsed.resetTime) {
        return {
          count: 0,
          resetTime: now + strategy.windowMs,
          remaining: strategy.maxRequests,
        };
      }

      return {
        count: parsed.count,
        resetTime: parsed.resetTime,
        remaining: Math.max(0, strategy.maxRequests - parsed.count),
      };
    } catch (error) {
      this.logger.error({
        action: 'GET_RATE_LIMIT_INFO_ERROR',
        key,
        strategy: strategy.name,
        error: (error as Error).message
      });
      return {
        count: 0,
        resetTime: Date.now() + strategy.windowMs,
        remaining: strategy.maxRequests,
      };
    }
  }

  private async incrementCounter(key: string, strategy: any): Promise<void> {
    try {
      const data = await this.redis!.get(key);
      const now = Date.now();

      if (!data) {
        // First request in window
        await this.redis!.setex(
          key,
          Math.ceil(strategy.windowMs / 1000),
          JSON.stringify({
            count: 1,
            resetTime: now + strategy.windowMs,
          })
        );
      } else {
        const parsed = JSON.parse(data);

        if (now > parsed.resetTime) {
          // Window expired, reset counter
          await this.redis!.setex(
            key,
            Math.ceil(strategy.windowMs / 1000),
            JSON.stringify({
              count: 1,
              resetTime: now + strategy.windowMs,
            })
          );
        } else {
          // Increment existing counter
          await this.redis!.setex(
            key,
            Math.ceil((parsed.resetTime - now) / 1000),
            JSON.stringify({
              count: parsed.count + 1,
              resetTime: parsed.resetTime,
            })
          );
        }
      }
    } catch (error) {
      this.logger.error({
        action: 'INCREMENT_RATE_LIMIT_ERROR',
        key,
        strategy: strategy.name,
        error: (error as Error).message
      });
    }
  }

  private setRateLimitHeaders(res: FastifyReply, info: RateLimitInfo, strategy: any): void {
    // Set standard rate limit headers
    res.header('X-RateLimit-Limit', strategy.maxRequests.toString());
    res.header('X-RateLimit-Remaining', info.remaining.toString());
    res.header('X-RateLimit-Reset', new Date(info.resetTime).toISOString());
    res.header('X-RateLimit-Strategy', strategy.name);

    if (info.remaining === 0) {
      const retryAfter = Math.ceil((info.resetTime - Date.now()) / 1000);
      res.header('Retry-After', retryAfter.toString());
    }
  }

  // Method to get rate limit status for a key and strategy
  async getRateLimitStatus(key: string, strategy?: any): Promise<RateLimitInfo> {
    if (strategy) {
      return this.getRateLimitInfo(key, strategy);
    }

    // Use base strategy if none provided
    const rateLimitConfig = this.rateLimitConfig.getConfiguration();
    const baseStrategy = rateLimitConfig.strategies.find(s => s.name === 'base');
    if (baseStrategy) {
      return this.getRateLimitInfo(key, baseStrategy);
    }

    // Fallback to default strategy
    return this.getRateLimitInfo(key, {
      name: 'default',
      maxRequests: rateLimitConfig.maxRequests,
      windowMs: rateLimitConfig.windowMs
    });
  }

  // Method to reset rate limit for a key (admin function)
  async resetRateLimit(key: string): Promise<void> {
    try {
      await this.redis!.del(key);
      this.logger.log({
        action: 'RATE_LIMIT_RESET',
        key,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error({
        action: 'RESET_RATE_LIMIT_ERROR',
        key,
        error: (error as Error).message
      });
      throw error;
    }
  }

  // Method to get all rate limit keys (admin function)
  async getAllRateLimitKeys(): Promise<string[]> {
    try {
      const keys = await this.redis!.keys('rate_limit:*');
      return keys;
    } catch (error) {
      this.logger.error({
        action: 'GET_RATE_LIMIT_KEYS_ERROR',
        error: (error as Error).message
      });
      return [];
    }
  }

  // Method to get rate limit statistics (admin function)
  async getRateLimitStats(): Promise<{
    totalKeys: number;
    keysByStrategy: Record<string, number>;
    topKeys: Array<{ key: string; count: number; resetTime: number }>;
  }> {
    try {
      const keys = await this.redis!.keys('rate_limit:*');
      const stats: Record<string, { count: number; resetTime: number }> = {};

      // Get data for each key
      for (const key of keys.slice(0, 100)) { // Limit to first 100 keys for performance
        try {
          const data = await this.redis!.get(key);
          if (data) {
            const parsed = JSON.parse(data);
            stats[key] = {
              count: parsed.count || 0,
              resetTime: parsed.resetTime || 0
            };
          }
        } catch (err) {
          // Skip keys with parsing errors
        }
      }

      // Group by strategy
      const keysByStrategy: Record<string, number> = {};
      const topKeys = Object.entries(stats)
        .map(([key, data]) => ({ key, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Count by strategy (simple heuristic based on key prefix)
      for (const key of keys) {
        if (key.includes('auth:')) {
          keysByStrategy['auth'] = (keysByStrategy['auth'] || 0) + 1;
        } else if (key.includes('sensitive:')) {
          keysByStrategy['sensitive'] = (keysByStrategy['sensitive'] || 0) + 1;
        } else if (key.includes('upload:')) {
          keysByStrategy['upload'] = (keysByStrategy['upload'] || 0) + 1;
        } else if (key.includes('bulk:')) {
          keysByStrategy['bulk'] = (keysByStrategy['bulk'] || 0) + 1;
        } else if (key.includes('health:')) {
          keysByStrategy['health'] = (keysByStrategy['health'] || 0) + 1;
        } else {
          keysByStrategy['other'] = (keysByStrategy['other'] || 0) + 1;
        }
      }

      return {
        totalKeys: keys.length,
        keysByStrategy,
        topKeys
      };
    } catch (error) {
      this.logger.error({
        action: 'GET_RATE_LIMIT_STATS_ERROR',
        error: (error as Error).message
      });
      return {
        totalKeys: 0,
        keysByStrategy: {},
        topKeys: []
      };
    }
  }

  onModuleDestroy() {
    this.redis?.disconnect();
  }
}
