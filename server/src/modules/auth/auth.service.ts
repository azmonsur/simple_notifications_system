// src/modules/auth/auth.service.ts
import { Injectable, UnauthorizedException } from "@nestjs/common";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import { CreateLoginDto } from "./dto/login.dto";
import { RedisAuditService } from "../../common/services/audit.service";

export interface JwtCustomPayload extends JwtPayload {
  sub: string;
  role: string;
}

// --- check required env variables at module load ---
const requiredEnvVars = [
  "JWT_SECRET",
  "JWT_ACCESS_EXPIRES_IN",
  "JWT_REFRESH_EXPIRES_IN",
] as const;
const missingVars = requiredEnvVars.filter((key) => !process.env[key]);
if (missingVars.length > 0) {
  console.error("Missing environment variables:", missingVars.join(", "));
  throw new Error(
    "One or more required environment variables are missing. Check the logs for details."
  );
}

@Injectable()
export class AuthService {
  constructor(private readonly redisAuthService: RedisAuditService) {}

  private readonly jwtSecret: Secret = process.env.JWT_SECRET as string;

  // Access token: short-lived (15 minutes default)
  private readonly accessTokenExpiry: string = process.env
    .JWT_ACCESS_EXPIRES_IN as string;

  // Refresh token: long-lived (7 days default)
  private readonly refreshTokenExpiry: string = process.env
    .JWT_REFRESH_EXPIRES_IN as string;

  // --- Admin validation ---
  validateAdmin(dto: CreateLoginDto, ip: string, userAgent: string): boolean {
    const { email, password } = dto;
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (
      !adminEmail ||
      !adminPassword ||
      email !== adminEmail ||
      password !== adminPassword
    ) {
      this.redisAuthService.audit({
        actor: email,
        action: "login.failed",
        ip,
        userAgent,
        meta: { reason: "Invalid credentials" },
      });
      return false;
    }

    this.redisAuthService.audit({
      actor: email,
      action: "login.success",
      ip,
      userAgent,
    });
    return true;
  }

  // --- JWT Methods ---
  issueAccessToken(payload: JwtCustomPayload): string {
    // remove iat and exp from payload
    const { iat, exp, ...data } = payload;
    return jwt.sign(data as object, this.jwtSecret, {
      expiresIn: this.accessTokenExpiry as jwt.SignOptions["expiresIn"],
    });
  }

  issueRefreshToken(payload: JwtCustomPayload): string {
    return jwt.sign(payload as object, this.jwtSecret, {
      expiresIn: this.refreshTokenExpiry as jwt.SignOptions["expiresIn"],
    });
  }

  verifyAccessToken(token: string): JwtCustomPayload {
    const payload = jwt.verify(token, this.jwtSecret);
    if (typeof payload === "string")
      throw new UnauthorizedException("Invalid access token");
    return payload as JwtCustomPayload;
  }

  verifyRefreshToken(token: string): JwtCustomPayload {
    const payload = jwt.verify(token, this.jwtSecret);
    if (typeof payload === "string")
      throw new UnauthorizedException("Invalid refresh token");
    return payload as JwtCustomPayload;
  }

  issueTokens(payload: JwtCustomPayload) {
    return {
      accessToken: this.issueAccessToken(payload),
      refreshToken: this.issueRefreshToken(payload),
    };
  }

  // --- Cookie helper ---
  refreshTokenExpiryMs(): number {
    const match = this.refreshTokenExpiry.match(/(\d+)([smhd])/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "s":
        return value * 1000;
      case "m":
        return value * 60 * 1000;
      case "h":
        return value * 60 * 60 * 1000;
      case "d":
        return value * 24 * 60 * 60 * 1000;
      default:
        return 7 * 24 * 60 * 60 * 1000;
    }
  }
}
