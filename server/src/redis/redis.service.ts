import { Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService {
  constructor(@Inject("REDIS_CLIENT") private readonly redis: Redis) {}

  async get(key: string) {
    return this.redis.get(key);
  }

  async set(key: string, value: any, ttlSec?: number) {
    if (ttlSec) {
      return this.redis.set(key, value, "EX", ttlSec);
    }
    return this.redis.set(key, value);
  }

  async incr(key: string) {
    return this.redis.incr(key);
  }

  async del(key: string) {
    return this.redis.del(key);
  }
}
