// src/redis/redis.service.ts
import { Injectable, Inject, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);

    constructor(
        @Inject('REDIS_CLIENT') private readonly redisClient: Redis
    ) {
        // Глобальный обработчик ошибок Redis
        this.redisClient.on('error', (err) => {
            this.logger.error(`Redis client error: ${err.message}`, err.stack);
        });
    }

    async onModuleDestroy() {
        try {
            await this.redisClient.quit();
            this.logger.log('Redis client disconnected successfully');
        } catch (err) {
            this.logger.error(`Error while disconnecting Redis client: ${err.message}`, err.stack);
        }
    }

    // Базовые методы
    async get(key: string): Promise<string | null> {
        try {
            return await this.redisClient.get(key);
        } catch (err) {
            this.logger.error(`GET operation failed for key ${key}: ${err.message}`);
            throw err;
        }
    }

    async set(key: string, value: string): Promise<'OK'> {
        try {
            return await this.redisClient.set(key, value);
        } catch (err) {
            this.logger.error(`SET operation failed for key ${key}: ${err.message}`);
            throw err;
        }
    }

    async del(key: string): Promise<number> {
        try {
            return await this.redisClient.del(key);
        } catch (err) {
            this.logger.error(`DEL operation failed for key ${key}: ${err.message}`);
            throw err;
        }
    }

    async setWithExpire(key: string, value: string, ttl: number): Promise<'OK'> {
        try {
            return await this.redisClient.set(key, value, 'EX', ttl);
        } catch (err) {
            this.logger.error(`SETEX operation failed for key ${key}: ${err.message}`);
            throw err;
        }
    }

    // Hash методы
    async hSet(key: string, field: string, value: string): Promise<number> {
        try {
            return await this.redisClient.hset(key, field, value);
        } catch (err) {
            this.logger.error(`HSET operation failed for key ${key}.${field}: ${err.message}`);
            throw err;
        }
    }

    async hGet(key: string, field: string): Promise<string | null> {
        try {
            return await this.redisClient.hget(key, field);
        } catch (err) {
            this.logger.error(`HGET operation failed for key ${key}.${field}: ${err.message}`);
            throw err;
        }
    }

    async hDel(key: string, field: string): Promise<number> {
        try {
            return await this.redisClient.hdel(key, field);
        } catch (err) {
            this.logger.error(`HDEL operation failed for key ${key}.${field}: ${err.message}`);
            throw err;
        }
    }

    async hGetAll(key: string): Promise<Record<string, string>> {
        try {
            return await this.redisClient.hgetall(key);
        } catch (err) {
            this.logger.error(`HGETALL operation failed for key ${key}: ${err.message}`);
            throw err;
        }
    }

    async hKeys(key: string): Promise<string[]> {
        try {
            return await this.redisClient.hkeys(key);
        } catch (err) {
            this.logger.error(`HKEYS operation failed for key ${key}: ${err.message}`);
            throw err;
        }
    }

    // Set методы
    async sAdd(key: string, member: string): Promise<number> {
        try {
            return await this.redisClient.sadd(key, member);
        } catch (err) {
            this.logger.error(`SADD operation failed for key ${key}: ${err.message}`);
            throw err;
        }
    }

    async sRem(key: string, member: string): Promise<number> {
        try {
            return await this.redisClient.srem(key, member);
        } catch (err) {
            this.logger.error(`SREM operation failed for key ${key}: ${err.message}`);
            throw err;
        }
    }

    async sMembers(key: string): Promise<string[]> {
        try {
            return await this.redisClient.smembers(key);
        } catch (err) {
            this.logger.error(`SMEMBERS operation failed for key ${key}: ${err.message}`);
            throw err;
        }
    }

    async sIsMember(key: string, member: string): Promise<boolean> {
        try {
            return (await this.redisClient.sismember(key, member)) === 1;
        } catch (err) {
            this.logger.error(`SISMEMBER operation failed for key ${key}: ${err.message}`);
            throw err;
        }
    }

    // Key методы
    async exists(key: string): Promise<boolean> {
        try {
            return (await this.redisClient.exists(key)) === 1;
        } catch (err) {
            this.logger.error(`EXISTS operation failed for key ${key}: ${err.message}`);
            throw err;
        }
    }

    async expire(key: string, seconds: number): Promise<number> {
        try {
            return await this.redisClient.expire(key, seconds);
        } catch (err) {
            this.logger.error(`EXPIRE operation failed for key ${key}: ${err.message}`);
            throw err;
        }
    }

    // Pub/Sub методы
    async publish(channel: string, message: string): Promise<number> {
        try {
            return await this.redisClient.publish(channel, message);
        } catch (err) {
            this.logger.error(`PUBLISH operation failed for channel ${channel}: ${err.message}`);
            throw err;
        }
    }

    async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
        try {
            const subscriber = this.redisClient.duplicate();
            subscriber.on('error', (err) => {
                this.logger.error(`Subscriber error for channel ${channel}: ${err.message}`);
            });

            await subscriber.subscribe(channel);
            subscriber.on('message', (ch, msg) => {
                if (ch === channel) {
                    callback(msg);
                }
            });
        } catch (err) {
            this.logger.error(`SUBSCRIBE operation failed for channel ${channel}: ${err.message}`);
            throw err;
        }
    }

    // Утилиты
    async ping(): Promise<string> {
        try {
            return await this.redisClient.ping();
        } catch (err) {
            this.logger.error(`PING operation failed: ${err.message}`);
            throw err;
        }
    }

    async flushAll(): Promise<'OK'> {
        try {
            return await this.redisClient.flushall();
        } catch (err) {
            this.logger.error(`FLUSHALL operation failed: ${err.message}`);
            throw err;
        }
    }
}