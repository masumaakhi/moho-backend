import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis | any;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get('REDIS_HOST') || '127.0.0.1';

    if (host === 'mock') {
      const RedisMock = require('ioredis-mock');
      this.redis = new RedisMock();
    } else {
      this.redis = new Redis({
        host,
        port: this.configService.get('REDIS_PORT') || 6379,
        maxRetriesPerRequest: null,
      });
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`[Cache] Error getting key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      console.error(`[Cache] Error setting key ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error(`[Cache] Error deleting key ${key}:`, error);
    }
  }
}
