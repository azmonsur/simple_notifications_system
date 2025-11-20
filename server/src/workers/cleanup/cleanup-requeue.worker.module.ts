import { ConfigModule } from "@nestjs/config";
import { Module } from "@nestjs/common";
import { CleanupWorkerService } from "./cleanup-requeue.worker";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [CleanupWorkerService],
})
export class CleanupWorkerModule {}
