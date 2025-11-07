import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Param,
  UseGuards,
} from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { CreateNotificationDto } from "./dto/notifications.dto";

import { JwtAuthGuard } from "../auth/jwt.guard";
@Controller("api/v1")
export class NotificationsController {
  constructor(private svc: NotificationsService) {}

  @Post("message")
  async webhook(@Body() event: CreateNotificationDto) {
    await this.svc.createFromEvent(event);
    return { status: "accepted" };
  }

  @UseGuards(JwtAuthGuard)
  @Get("admin/notifications/failed")
  async listFailed(@Query("limit") limit?: string) {
    console.log(limit);
    return { data: await this.svc.listFailed(limit ? parseInt(limit) : 100) };
  }

  @UseGuards(JwtAuthGuard)
  @Post("admin/notifications/:id/retry")
  async retry(@Param("id") id: string) {
    await this.svc.markQueued(id);
    return { status: "queued" };
  }

  @UseGuards(JwtAuthGuard)
  @Post("admin/notifications/:id/resolve")
  async resolve(@Param("id") id: string) {
    await this.svc.markResolved(id);
    return { status: "resolved" };
  }
}
