import { ConfigModule } from "@nestjs/config";
import { Module } from "@nestjs/common";
import { EmailWorkerService } from "./email.worker";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [EmailWorkerService],
})
export class EmailWorkerModule {}
