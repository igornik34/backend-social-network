// src/redis/redis.module.ts
import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import Redis from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        return new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          db: parseInt(process.env.REDIS_DB || '0'),
          lazyConnect: true,
          showFriendlyErrorStack: true,
        });
      },
    },
    RedisService,
  ],
  exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule {}