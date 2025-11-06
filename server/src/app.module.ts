// src/app.module.ts
import { Module } from "@nestjs/common";
import { NotificationsModule } from "./notifications/notifications.module";
import { AdminModule } from "./admin/admin.module";

@Module({
  imports: [AdminModule, NotificationsModule],
})
export class AppModule {}
