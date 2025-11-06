import { Controller, Post, Body, Get, Query, Param } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { CreateNotificationDto } from "../dto/notifications.dto";

@Controller()
export class NotificationsController {
  constructor(private svc: NotificationsService) {}

  @Post("api/v1/message")
  async webhook(@Body() event: CreateNotificationDto) {
    await this.svc.createFromEvent(event);
    return { status: "accepted" };
  }

  @Get("api/v1/admin/notifications")
  async listFailed(@Query("limit") limit?: string) {
    return { data: await this.svc.listFailed(limit ? parseInt(limit) : 100) };
  }

  @Post("api/v1/admin/notifications/:id/retry")
  async retry(@Param("id") id: string) {
    await this.svc.markQueued(id);
    return { status: "queued" };
  }

  @Post("api/v1/admin/notifications/:id/resolve")
  async resolve(@Param("id") id: string) {
    await this.svc.markResolved(id);
    return { status: "resolved" };
  }
}
