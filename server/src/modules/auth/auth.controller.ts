// src/modules/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Req,
  Res,
  UnauthorizedException,
  HttpCode,
} from "@nestjs/common";
import { Request, Response } from "express";
import { AuthService, JwtCustomPayload } from "./auth.service";
import { CreateLoginDto } from "./dto/login.dto";
import { CreateSignupDto } from "./dto/signup.dto";
import { RedisRateLimit } from "../../common/guards/redis/redis-rate-limit.decorator";
import { Public } from "../../common/decorators/public.decorator";

declare module "express" {
  interface Request {
    user?: JwtCustomPayload; // Add the payload type here
  }
}

@Public()
@Controller("admin/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // SIGN UP

  @RedisRateLimit(8, 60)
  @HttpCode(201)
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

    //  Remove old refresh token - new path
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/v1/admin/auth", // only sent to refresh endpoint
    });

    // Set refresh token as HttpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/v1/admin/auth", // only sent to refresh endpoint
      maxAge: this.authService.refreshTokenExpiryMs(), // in milliseconds
    });

    return {
      message: "Signup successful",
      accessToken, // only access token returned in JSON
    };
  }

  // Login

  @RedisRateLimit(5, 60)
  @HttpCode(200)
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

    //  Remove old refresh token - new path
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/v1/admin/auth", // only sent to refresh endpoint
    });

    // Set refresh token as HttpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/v1/admin/auth", // only sent to refresh endpoint
      maxAge: this.authService.refreshTokenExpiryMs(), // in milliseconds
    });

    return {
      message: "Login successful",
      accessToken,
    };
  }

  // Refresh token
  @RedisRateLimit(10, 60)
  @Post("refresh")
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const oldRefreshToken = req.cookies.refreshToken;

    //  Remove old refresh token - new path
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/v1/admin/auth", // only sent to refresh endpoint
    });

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
        path: "/api/v1/admin/auth",
        maxAge: this.authService.refreshTokenExpiryMs(),
      });

      return { accessToken };
    } catch (err) {
      throw new BadRequestException("Invalid or revoked refresh token");
    }
  }

  // Request reset token

  @RedisRateLimit(5, 300)
  @HttpCode(200)
  @Post("request-password-reset")
  async requestPasswordReset(
    @Body("email") email: string,
    @Req() req: Request
  ) {
    return this.authService.requestPasswordReset(email, req);
  }

  // Rest password
  @RedisRateLimit(5, 3600)
  @HttpCode(200)
  @Post("reset-password")
  async resetPassword(
    @Body("email") email: string,
    @Body("token") token: string,
    @Body("newPassword") newPassword: string,
    @Req() req: Request
  ) {
    return this.authService.resetPassword(email, token, newPassword, req);
  }

  // --- LOGOUT current device ---
  @RedisRateLimit(20, 60)
  @HttpCode(200)
  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const result = await this.authService.logout(req, res);

      return result;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw err;
    }
  }

  // --- LOGOUT from all devices ---
  @Post("logout-all")
  @HttpCode(200)
  async logoutAllDevices(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    try {
      // Extract userId from your auth context or JWT payload
      const payload = req.user as { sub: string }; // assuming you use a guard that attaches user
      if (!payload?.sub) {
        throw new UnauthorizedException("User not authenticated");
      }

      const result = await this.authService.logoutAllDevices(
        payload.sub,
        req,
        res
      );

      return result;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw err;
    }
  }
}
