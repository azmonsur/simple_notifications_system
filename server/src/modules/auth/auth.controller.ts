// src/modules/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Req,
  Res,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { AuthService, JwtCustomPayload } from "./auth.service";
import { CreateLoginDto } from "./dto/login.dto";
import { Throttle } from "@nestjs/throttler";

@Throttle({ default: { limit: 10, ttl: 60 } })
@Controller("admin/auth")
export class AuthController {
  private logger = new Logger("AuthController");

  constructor(private readonly authService: AuthService) {}

  @Post("login")
  async login(
    @Body() body: CreateLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const { email, password } = body || {};
    if (!email || !password)
      throw new BadRequestException("email and password are required");

    const ok = this.authService.validateAdmin(
      body,
      req.ip as string,
      req.headers["user-agent"] || ""
    );

    if (!ok) {
      this.logger.warn(
        `Failed login attempt for email ${email} from IP ${req.ip}`
      );
      throw new BadRequestException("Invalid credentials");
    }

    const payload: JwtCustomPayload = { sub: email, role: "admin" };
    const tokens = this.authService.issueTokens(payload);

    // Set refresh token as HttpOnly cookie
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/v1/admin/auth/refresh", // only sent to refresh endpoint
      maxAge: this.authService.refreshTokenExpiryMs(), // in milliseconds
    });

    return {
      message: "Login successful",
      accessToken: tokens.accessToken, // only access token returned in JSON
    };
  }

  @Post("refresh")
  async refresh(@Req() req: Request) {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) throw new BadRequestException("Refresh token missing");

    try {
      const payload = this.authService.verifyRefreshToken(refreshToken);
      const accessToken = this.authService.issueAccessToken(payload);

      return { accessToken };
    } catch (err) {
      throw new BadRequestException("Invalid refresh token");
    }
  }
}
