import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Req,
  Param,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { NotificationsService } from "./notifications.service";
import { CreateNotificationDto } from "./dto/notifications.dto";

import { JwtAuthGuard } from "../auth/jwt.guard";
import { Throttle } from "@nestjs/throttler";

@Controller("api/v1")
export class NotificationsController {
  constructor(private svc: NotificationsService) {}

  @Throttle({ default: { limit: 300, ttl: 60 } }) // max 50 requests per IP per 60 seconds
  @Post("message")
  async webhook(@Body() event: CreateNotificationDto, @Req() req: Request) {
    const ip = req.ip;
    await this.svc.createFromEvent(event, ip as unknown as string);
    return { status: "accepted" };
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60 } }) // max 10 requests per IP per 60 seconds
  @Get("admin/notifications/failed")
  async listFailed(@Query("limit") limit?: string) {
    console.log(limit);
    return { data: await this.svc.listFailed(limit ? parseInt(limit) : 100) };
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60 } }) // max 10 requests per IP per 60 seconds
  @Post("admin/notifications/:id/retry")
  async retry(@Param("id") id: string) {
    await this.svc.markQueued(id);
    return { status: "queued" };
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60 } }) // max 10 requests per IP per 60 seconds
  @Post("admin/notifications/:id/resolve")
  async resolve(@Param("id") id: string) {
    await this.svc.markResolved(id);
    return { status: "resolved" };
  }
}
