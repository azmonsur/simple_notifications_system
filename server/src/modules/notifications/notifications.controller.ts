import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Req,
  Param,
  UseGuards,
  HttpCode,
} from "@nestjs/common";
import { Request, Response } from "express";
import { NotificationsService } from "./notifications.service";
import { CreateNotificationDto } from "./dto/notifications.dto";

import { JwtAuthGuard } from "../auth/jwt.guard";
import { Throttle } from "@nestjs/throttler";
import { RedisRateLimitGuard } from "../../common/guards/redis/redis-rate-limit.guard";
import { RedisRateLimit } from "../../common/guards/redis/redis-rate-limit.decorator";
import { Public } from "../../common/decorators/public.decorator";

@Controller("")
export class NotificationsController {
  constructor(private svc: NotificationsService) {}

  // @Throttle({ default: { limit: 300, ttl: 60 } }) // max 50 requests per IP per 60 seconds
  @Public()
  @RedisRateLimit(20, 60)
  @Post("notification")
  @HttpCode(202)
  async notification(
    @Body() event: CreateNotificationDto,
    @Req() req: Request
  ) {
    const ip = req.ip;
    await this.svc.createFromEvent(event, ip as unknown as string);

    return {
      statusCode: 202,
      message: "Notification accepted for processing",
    };
  }

  @RedisRateLimit(50, 60)
  @Get("admin/notifications/failed")
  async listFailed(@Query("limit") limit?: string) {
    return { data: await this.svc.listFailed(limit ? parseInt(limit) : 100) };
  }

  @RedisRateLimit(50, 60)
  @Post("admin/notifications/:id/retry")
  async retry(@Param("id") id: string) {
    await this.svc.markQueued(id);
    return { status: "Message queued" };
  }

  @RedisRateLimit(50, 60)
  @Throttle({ default: { limit: 10, ttl: 60 } }) // max 10 requests per IP per 60 seconds
  @Post("admin/notifications/:id/resolve")
  async resolve(@Param("id") id: string) {
    await this.svc.markResolved(id);
    return { status: "Message resolved" };
  }
}
