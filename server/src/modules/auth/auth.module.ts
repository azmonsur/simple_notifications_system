import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtAuthGuard } from "./jwt.guard";
import { CommonModule } from "../../common/common.module";

@Module({
  imports: [CommonModule],
  providers: [AuthService, JwtAuthGuard],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
