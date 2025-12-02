// src/workers/outbox/outbox.worker.module.ts
import { ConfigModule } from "@nestjs/config";
import { Module } from "@nestjs/common";
import { OutboxWorkerService } from "./outbox.publisher.worker";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [OutboxWorkerService],
})
export class OutboxWorkerModule {}
