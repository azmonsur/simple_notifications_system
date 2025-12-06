// src/modules/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Req,
  Res,
} from "@nestjs/common";
import { Request, Response } from "express";
import { AuthService, JwtCustomPayload } from "./auth.service";
import { CreateLoginDto } from "./dto/login.dto";
import { CreateSignupDto } from "./dto/signup.dto";
import { Throttle } from "@nestjs/throttler";

@Throttle({ default: { limit: 10, ttl: 60 } })
@Controller("admin/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // SIGN UP
  @Post("signup")
  async signup(
    @Body() body: CreateSignupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const { email, password, roleName } = body;

    if (!email || !password || !roleName)
      throw new BadRequestException("email, password and role are required");

    const { accessToken, refreshToken } = await this.authService.signup(
      body,
      req
    );

    // Set refresh token as HttpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/v1/admin/auth/refresh", // only sent to refresh endpoint
      maxAge: this.authService.refreshTokenExpiryMs(), // in milliseconds
    });

    return {
      message: "Signup successful",
      accessToken, // only access token returned in JSON
    };
  }

  // Login
  @Post("login")
  async login(
    @Body() body: CreateLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const { email, password } = body || {};
    if (!email || !password)
      throw new BadRequestException("email and password are required");

    // validateAdmin now returns tokens directly
    const { accessToken, refreshToken } = await this.authService.validateAdmin(
      body,
      req
    );

    // Set refresh token as HttpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/v1/admin/auth/refresh",
      maxAge: this.authService.refreshTokenExpiryMs(),
    });

    return {
      message: "Login successful",
      accessToken,
    };
  }

  // Request reset token
  @Post("request-password-reset")
  async requestPasswordReset(
    @Body("email") email: string,
    @Req() req: Request
  ) {
    return this.authService.requestPasswordReset(email, req);
  }

  // Rest password
  @Post("reset-password")
  async resetPassword(
    @Body("email") email: string,
    @Body("token") token: string,
    @Body("newPassword") newPassword: string,
    @Req() req: Request
  ) {
    return this.authService.resetPassword(email, token, newPassword, req);
  }

  // Refresh token
  @Post("refresh")
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const oldRefreshToken = req.cookies.refreshToken;
    if (!oldRefreshToken)
      throw new BadRequestException("Refresh token missing");

    try {
      const { sub, role } = await this.authService.verifyRefreshToken(
        oldRefreshToken
      );

      const payload = { sub, role };

      // Rotate refresh token
      const { accessToken, refreshToken: newRefreshToken } =
        await this.authService.rotateRefreshToken(oldRefreshToken, payload);

      // Set new refresh token in cookie
      res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/api/v1/admin/auth/refresh",
        maxAge: this.authService.refreshTokenExpiryMs(),
      });

      return { accessToken };
    } catch (err) {
      throw new BadRequestException("Invalid or revoked refresh token");
    }
  }
}
