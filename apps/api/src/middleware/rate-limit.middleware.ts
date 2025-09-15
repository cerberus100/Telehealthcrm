import { Injectable, NestMiddleware, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
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
  private readonly config: RateLimitConfig;
  private readonly disabled: boolean;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    // Disable in demo mode to avoid Redis dependency
    this.disabled = process.env.API_DEMO_MODE === 'true';
    if (!this.disabled) {
      // Initialize Redis connection
      this.redis = new Redis({
        host: this.configService.get('REDIS_HOST', 'localhost') as string,
        port: Number(this.configService.get('REDIS_PORT', 6379)),
        password: this.configService.get('REDIS_PASSWORD') as string | undefined,
        maxRetriesPerRequest: 3,
      });
    }

    // Configure rate limiting
    this.config = {
      windowMs: this.configService.get('RATE_LIMIT_WINDOW_MS', 60000), // 1 minute
      maxRequests: this.configService.get('RATE_LIMIT_MAX_REQUESTS', 300), // 300 requests per minute
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: this.defaultKeyGenerator,
    };

    // Handle Redis connection errors
    if (this.redis) {
      this.redis.on('error', (error) => {
        this.logger.error('Redis connection error:', error);
      });
    }
  }

  async use(req: Request, res: Response, next: NextFunction) {
    if (this.disabled) {
      next();
      return;
    }
    try {
      // Generate rate limit key
      const key = this.config.keyGenerator!(req);
      
      // Get current rate limit info
      const rateLimitInfo = await this.getRateLimitInfo(key);
      
      // Check if limit exceeded
      if (rateLimitInfo.count >= this.config.maxRequests) {
        // Set rate limit headers
        this.setRateLimitHeaders(res, rateLimitInfo);
        
        // Log rate limit exceeded
        this.logger.warn({
          action: 'RATE_LIMIT_EXCEEDED',
          key,
          count: rateLimitInfo.count,
          maxRequests: this.config.maxRequests,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method,
        });

        throw new HttpException(
          {
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests',
              details: {
                limit: this.config.maxRequests,
                remaining: 0,
                resetTime: rateLimitInfo.resetTime,
              },
            },
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }

      // Increment counter
      await this.incrementCounter(key);
      
      // Set rate limit headers
      this.setRateLimitHeaders(res, {
        count: rateLimitInfo.count + 1,
        resetTime: rateLimitInfo.resetTime,
        remaining: this.config.maxRequests - (rateLimitInfo.count + 1),
      });

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error('Rate limit middleware error:', error);
      // Don't block requests if rate limiting fails
      next();
    }
  }

  private defaultKeyGenerator(req: Request): string {
    // Use user ID if authenticated, otherwise use IP
    const userId = (req as any).claims?.sub;
    const orgId = (req as any).claims?.orgId;
    
    if (userId && orgId) {
      return `rate_limit:${orgId}:${userId}`;
    }
    
    return `rate_limit:ip:${req.ip}`;
  }

  private async getRateLimitInfo(key: string): Promise<RateLimitInfo> {
    try {
      const data = await this.redis!.get(key);
      
      if (!data) {
        return {
          count: 0,
          resetTime: Date.now() + this.config.windowMs,
          remaining: this.config.maxRequests,
        };
      }

      const parsed = JSON.parse(data);
      const now = Date.now();
      
      // Check if window has expired
      if (now > parsed.resetTime) {
        return {
          count: 0,
          resetTime: now + this.config.windowMs,
          remaining: this.config.maxRequests,
        };
      }

      return {
        count: parsed.count,
        resetTime: parsed.resetTime,
        remaining: Math.max(0, this.config.maxRequests - parsed.count),
      };
    } catch (error) {
      this.logger.error('Error getting rate limit info:', error);
      return {
        count: 0,
        resetTime: Date.now() + this.config.windowMs,
        remaining: this.config.maxRequests,
      };
    }
  }

  private async incrementCounter(key: string): Promise<void> {
    try {
      const data = await this.redis!.get(key);
      const now = Date.now();
      
      if (!data) {
        // First request in window
        await this.redis!.setex(
          key,
          Math.ceil(this.config.windowMs / 1000),
          JSON.stringify({
            count: 1,
            resetTime: now + this.config.windowMs,
          })
        );
      } else {
        const parsed = JSON.parse(data);
        
        if (now > parsed.resetTime) {
          // Window expired, reset counter
          await this.redis!.setex(
            key,
            Math.ceil(this.config.windowMs / 1000),
            JSON.stringify({
              count: 1,
              resetTime: now + this.config.windowMs,
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
      this.logger.error('Error incrementing rate limit counter:', error);
    }
  }

  private setRateLimitHeaders(res: Response, info: RateLimitInfo): void {
    res.setHeader('X-RateLimit-Limit', this.config.maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', info.remaining.toString());
    res.setHeader('X-RateLimit-Reset', new Date(info.resetTime).toISOString());
    
    if (info.remaining === 0) {
      const retryAfter = Math.ceil((info.resetTime - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
    }
  }

  // Method to get rate limit status for a key
  async getRateLimitStatus(key: string): Promise<RateLimitInfo> {
    return this.getRateLimitInfo(key);
  }

  // Method to reset rate limit for a key (admin function)
  async resetRateLimit(key: string): Promise<void> {
    try {
      await this.redis!.del(key);
      this.logger.log(`Rate limit reset for key: ${key}`);
    } catch (error) {
      this.logger.error('Error resetting rate limit:', error);
      throw error;
    }
  }

  // Method to get all rate limit keys (admin function)
  async getAllRateLimitKeys(): Promise<string[]> {
    try {
      const keys = await this.redis!.keys('rate_limit:*');
      return keys;
    } catch (error) {
      this.logger.error('Error getting rate limit keys:', error);
      return [];
    }
  }

  onModuleDestroy() {
    this.redis?.disconnect();
  }
}
