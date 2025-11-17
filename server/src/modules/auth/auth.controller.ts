import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Req,
  Logger,
} from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "./auth.service";
import { CreateLoginDto } from "./dto/login.dto";
import { Throttle } from "@nestjs/throttler";

@Throttle({ default: { limit: 10, ttl: 60 } }) // max 20 requests per IP per 60 seconds
@Controller("api/v1/admin/auth")
export class AuthController {
  private logger = new Logger("AuthController");

  constructor(private readonly authService: AuthService) {}

  @Post("login")
  async login(@Body() body: CreateLoginDto, @Req() req: Request) {
    const { email, password } = body || {};
    if (!email || !password)
      throw new BadRequestException("email and password are required");

    const ok = this.authService.validateAdmin(body);
    if (!ok) {
      this.logger.warn(
        `Failed login attempt for email ${email} from IP ${req.ip}`
      );
      throw new BadRequestException("Invalid credentials");
    }

    const token = this.authService.issueToken({ sub: email, role: "admin" });
    return { token };
  }
}
