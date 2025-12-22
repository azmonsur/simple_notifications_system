// src/modules/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
  ForbiddenException,
} from "@nestjs/common";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import * as bcrypt from "bcrypt";
import * as argon2 from "argon2";
import { CreateLoginDto } from "./dto/login.dto";
import { CreateSignupDto } from "./dto/signup.dto";
import { RedisAuditService } from "../../common/services/audit.service";
import { query as dbQuery, pool } from "../../utils/db/db";
import { logger } from "../../utils/logger/logger";
import { QueryResult, PoolClient } from "pg";
import crypto from "crypto";
import SendEmailSendGrid from "../../helpers/sendEmailSendgrid";
import geoip from "geoip-lite";
import { Request, Response } from "express";
import { AccountLockedException } from "../../common/exceptions/error.exception";

export interface JwtCustomPayload extends JwtPayload {
  sub: string; // will hold user id (UUID)
  role: string; // role name
}

// --- check required env variables at module load ---
const requiredEnvVars = [
  "JWT_SECRET",
  "JWT_ACCESS_EXPIRES_IN",
  "JWT_REFRESH_EXPIRES_IN",
] as const;

const missingVars = requiredEnvVars.filter((key) => !process.env[key]);
if (missingVars.length > 0) {
  logger.error("Missing environment variables:", missingVars.join(", "));
  throw new Error(
    "One or more required environment variables are missing. Check the logs for details."
  );
}

@Injectable()
export class AuthService {
  constructor(private readonly redisAuthService: RedisAuditService) {}

  private readonly jwtSecret: Secret = process.env.JWT_SECRET as string;
  private readonly accessTokenExpiry: string = process.env
    .JWT_ACCESS_EXPIRES_IN as string;
  private readonly refreshTokenExpiry: string = process.env
    .JWT_REFRESH_EXPIRES_IN as string;

  // --- Transaction helper ---
  private async withTransaction<T>(
    fn: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  // --- Helpers ---
  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  // --- Login using database and transaction ---
  // Keeps original name validateAdmin
  async validateAdmin(body: CreateLoginDto, req: Request) {
    try {
      const ip =
        req.ip ||
        (req.headers["x-real-ip"] as string) ||
        (req.headers["x-forwarded-for"] as string);

      const geo = geoip.lookup(ip);

      const location = geo
        ? `${geo.city}, ${geo.region}, ${geo.country}`
        : "unknown";
      const { email, password } = body;

      return await this.withTransaction(async (client) => {
        try {
          // Fetch user and role (role name) — sub will be user.id
          const res: QueryResult = await client.query(
            `SELECT u.id, u.email, u.failed_login_count, u.account_locked_until, u.password_hash, r.name as role
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE u.email = $1`,
            [email]
          );

          const user = res?.rows[0];

          if (!user) {
            await this.redisAuthService.audit({
              actor: email,
              action: "login.failed",
              ip,
              userAgent: req.headers["user-agent"],
              meta: { reason: "User not found" },
            });
            throw new UnauthorizedException("Invalid credentials");
          }

          // Verify password using argon2
          // const passwordMatches = await bcrypt.compare(
          //   password,
          //   user.password_hash
          // );
          const passwordMatches = await argon2.verify(
            user.password_hash,
            password
          );
          if (!passwordMatches) {
            // audit failed attempt
            await this.redisAuthService.audit({
              actor: user.id,
              action: "login.failed",
              ip,
              userAgent: req.headers["user-agent"],
              meta: { reason: "Wrong password" },
            });

            // Optionally update failed_login_count/account_locked_until here (not required)
            await dbQuery(
              `UPDATE users SET failed_login_count = failed_login_count + 1 WHERE id = $1`,
              [user.id]
            );

            throw new UnauthorizedException("Invalid credentials");
          }

          if (
            user.account_locked_until &&
            new Date(Date.now()) > user.account_locked_until
          ) {
            await dbQuery(
              `UPDATE users SET failed_login_count = 0, account_locked_until = $1 WHERE id = $2`,
              [null, user.id]
            );
          }

          if (user.failed_login_count > 3) {
            await this.redisAuthService.audit({
              actor: user.id,
              action: "login.failed",
              ip,
              userAgent: req.headers["user-agent"],
              meta: {
                reason: `Maximum login atempts reached, user can login by ${new Date(
                  Date.now() + 15 * 60 * 1000
                )}`,
              },
            });

            if (!user.account_locked_until) {
              await dbQuery(
                `UPDATE users SET account_locked_until = $1 WHERE id = $2`,
                [new Date(Date.now() + 15 * 60 * 1000), user.id]
              );
            }

            throw new AccountLockedException(
              "Login not allowed this time, try again soon"
            );
          }

          // Successful login audit
          await this.redisAuthService.audit({
            actor: user.id,
            action: "login.success",
            ip,
            userAgent: req.headers["user-agent"],
          });

          // Build JWT payload using user id as sub and role name
          const payload: JwtCustomPayload = { sub: user.id, role: user.role };

          // Issue tokens
          const accessToken = this.issueAccessToken(payload);
          const refreshToken = this.issueRefreshToken(payload);

          // Hash refresh token and store in DB (token_hash, user_id, expires_at)
          const tokenHash = this.hashToken(refreshToken);
          const expiresAt = new Date(Date.now() + this.refreshTokenExpiryMs());

          // Update last login info and then insert token (atomic)
          await client.query(
            `UPDATE users SET last_login_at = NOW(), last_login_ip = $1, last_login_location = $2, updated_at = NOW(),
             failed_login_count = 0, account_locked_until = $3 WHERE id = $4`,
            [ip, location, null, user.id]
          );

          // Insert refresh token first and get its ID
          const insertTokenResult = await client.query(
            `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
              VALUES ($1, $2, $3)
              RETURNING id`,
            [user.id, tokenHash, expiresAt]
          );
          const refreshTokenId = insertTokenResult.rows[0].id;

          // Insert user session linked to this refresh token
          await client.query(
            `INSERT INTO user_sessions (user_id, ip_address, location, user_agent, expires_at, refresh_token_id)
              VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              user.id,
              ip,
              location,
              req.headers["user-agent"],
              new Date(Date.now() + this.refreshTokenExpiryMs()),
              refreshTokenId,
            ]
          );

          return { accessToken, refreshToken };
        } catch (err) {
          // If it's a known Nest exception, rethrow so outer catch handles translation

          if (err instanceof HttpException) {
            throw err;
          }
          const errMsg = err instanceof Error ? err.message : String(err);
          logger.error(`validateAdmin transaction error: ${errMsg}`);
          throw new InternalServerErrorException("Login failed");
        }
      });
    } catch (err) {
      // Top-level translation and logging
      if (err instanceof HttpException) {
        throw err;
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`validateAdmin transaction error: ${errMsg}`);
      throw new InternalServerErrorException("Login failed");
    }
  }

  // --- Signup using database and transaction ---
  // Accepts CreateSignupDto (roleName provided from frontend)
  async signup(dto: CreateSignupDto, req: Request) {
    try {
      const ip =
        req.ip ||
        (req.headers["x-real-ip"] as string) ||
        (req.headers["x-forwarded-for"] as string);

      const geo = geoip.lookup(ip);

      const location = geo
        ? `${geo.city}, ${geo.region}, ${geo.country}`
        : "unknown";

      return await this.withTransaction(async (client) => {
        try {
          const {
            email,
            password,
            username,
            firstName,
            lastName,
            gender,
            roleName,
          } = dto;

          // Check existing user
          const existsRes = await client.query(
            "SELECT id FROM users WHERE email = $1 OR username = $2",
            [email, username]
          );
          if (existsRes?.rows?.length > 0) {
            throw new ConflictException("Email or username already registered");
          }

          // Hash password using bcrypt
          // const passwordHash = await bcrypt.hash(password, 12)
          const passwordHash = await argon2.hash(password, {
            type: argon2.argon2id,
            memoryCost: 2 ** 16,
            timeCost: 5,
            parallelism: 1,
          });

          // Resolve roleName -> role_id
          const roleRes = await client.query(
            "SELECT id, name FROM roles WHERE name = $1",
            [roleName]
          );
          if (roleRes?.rows?.length === 0) {
            throw new ConflictException(`Role '${roleName}' not found`);
          }
          const roleId = roleRes.rows[0].id;

          // Insert user
          const insertRes: QueryResult = await client.query(
            `INSERT INTO users 
             (username, email, password_hash, first_name, last_name, gender, role_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, email`,
            [username, email, passwordHash, firstName, lastName, gender, roleId]
          );

          const user = insertRes.rows[0];

          // Prepare payload with user.id and role name
          const payload: JwtCustomPayload = { sub: user.id, role: roleName };

          // Issue tokens
          const accessToken = this.issueAccessToken(payload);
          const refreshToken = this.issueRefreshToken(payload);

          // Store refresh token (hashed) in DB
          const tokenHash = this.hashToken(refreshToken);
          const expiresAt = new Date(Date.now() + this.refreshTokenExpiryMs());

          await client.query(
            `UPDATE users SET last_login_at = NOW(), last_login_ip = $1, last_login_location = $2, updated_at = NOW() WHERE id = $3`,
            [ip, location, user.id]
          );

          // Store refresh token (hashed) in DB and get its ID
          const insertTokenRes = await client.query(
            `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
              VALUES ($1, $2, $3)
              RETURNING id`,
            [user.id, tokenHash, expiresAt]
          );
          const refreshTokenId = insertTokenRes.rows[0].id;

          // Insert user session linked to this refresh token
          await client.query(
            `INSERT INTO user_sessions (user_id, ip_address, location, user_agent, expires_at, refresh_token_id)
                VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              user.id,
              ip,
              location,
              req.headers["user-agent"],
              new Date(Date.now() + this.refreshTokenExpiryMs()),
              refreshTokenId,
            ]
          );

          // Audit signup
          await this.redisAuthService.audit({
            actor: user.id,
            action: "signup.success",
            meta: { userId: user.id },
          });

          return { accessToken, refreshToken };
        } catch (err) {
          if (err instanceof ConflictException) throw err;
          logger.error("signup transaction error:", err);
          throw err;
        }
      });
    } catch (err) {
      logger.error("signup error:", err);
      if (err instanceof ConflictException) throw err;
      throw new InternalServerErrorException("Signup failed");
    }
  }

  // --- JWT Methods ---
  issueAccessToken(payload: JwtCustomPayload): string {
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

  // --- Verify access token ---
  verifyAccessToken(token: string): JwtCustomPayload {
    try {
      const payload = jwt.verify(token, this.jwtSecret);
      if (typeof payload === "string")
        throw new UnauthorizedException("Invalid access token");
      return payload as JwtCustomPayload;
    } catch (err) {
      logger.error("verifyAccessToken error:", err);
      throw new UnauthorizedException("Invalid access token");
    }
  }

  // --- Verify refresh token + check DB revocation/rotation ---
  async verifyRefreshToken(token: string): Promise<JwtCustomPayload> {
    try {
      // Verify token signature & exp
      let payload: JwtCustomPayload;
      try {
        payload = jwt.verify(token, this.jwtSecret) as JwtCustomPayload;
      } catch (err) {
        throw new UnauthorizedException("Invalid refresh token");
      }

      // payload.sub should be user id
      const userId = payload.sub;
      if (!userId) throw new UnauthorizedException("Invalid token payload");

      // Hash provided token
      const tokenHash = this.hashToken(token);

      const res = await dbQuery(
        `SELECT rt.id, rt.user_id, rt.revoked_at, rt.expires_at, rt.replaced_by_token_id
        FROM refresh_tokens rt
        INNER JOIN user_sessions us
        ON us.refresh_token_id = rt.id
        WHERE rt.user_id = $1 AND rt.token_hash = $2
        ORDER BY rt.created_at DESC LIMIT 1`,
        [userId, tokenHash]
      );

      if (res.rows.length === 0) {
        throw new UnauthorizedException("Refresh token not found");
      }

      const row = res.rows[0];

      // Check expiration (DB-level)
      if (new Date(row.expires_at) < new Date()) {
        await dbQuery(
          `DELETE FROM user_sessions
           WHERE refresh_token_id = $1`,
          [row.id]
        );
        throw new UnauthorizedException("Refresh token expired");
      }

      // Revoked?
      if (row.revoked_at) {
        await dbQuery(
          `DELETE FROM user_sessions
           WHERE refresh_token_id = $1`,
          [row.id]
        );
        throw new UnauthorizedException("Refresh token revoked");
      }

      // Rotated already?
      if (row.replaced_by_token_id) {
        throw new UnauthorizedException("Refresh token has been rotated");
      }

      return payload;
    } catch (err) {
      logger.error("verifyRefreshToken error:", err);
      if (err instanceof UnauthorizedException) throw err;
      throw new InternalServerErrorException("Failed to verify refresh token");
    }
  }

  // --- Revoke refresh token (mark revoked_at) ---
  // Keep function name revokeRefreshToken
  async revokeRefreshToken(token: string) {
    try {
      // Hash token, then mark revoked_at
      const tokenHash = this.hashToken(token);
      await dbQuery(
        `UPDATE refresh_tokens
         SET revoked_at = NOW()
         WHERE token_hash = $1`,
        [tokenHash]
      );
    } catch (err) {
      logger.error("revokeRefreshToken error:", err);
      throw new InternalServerErrorException("Failed to revoke refresh token");
    }
  }

  issueTokens(payload: JwtCustomPayload) {
    return {
      accessToken: this.issueAccessToken(payload),
      refreshToken: this.issueRefreshToken(payload),
    };
  }

  // --- Rotate refresh token: revoke old, insert new, link replaced_by_token_id ---
  async rotateRefreshToken(oldToken: string, payload: JwtCustomPayload) {
    try {
      return await this.withTransaction(async (client) => {
        try {
          // Hash old token and find its row (must belong to payload.sub)
          const oldHash = this.hashToken(oldToken);

          const oldRes: QueryResult = await client.query(
            `SELECT id, user_id, expires_at FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE`,
            [oldHash]
          );

          if (oldRes.rows.length === 0) {
            throw new UnauthorizedException("Refresh token not found");
          }

          const oldRow = oldRes.rows[0];

          // Ensure token belongs to the same user as payload.sub
          if (oldRow.user_id !== payload.sub) {
            // Possible token theft / mismatch
            throw new UnauthorizedException("Token user mismatch");
          }

          // Revoke the old token (set revoked_at)
          await client.query(
            `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`,
            [oldRow.id]
          );

          // Issue new refresh token (JWT)
          const newRefreshToken = this.issueRefreshToken(payload);
          const newHash = this.hashToken(newRefreshToken);
          const expiresAt = new Date(Date.now() + this.refreshTokenExpiryMs());

          // Insert new token row and get its id
          const insertRes: QueryResult = await client.query(
            `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [oldRow.user_id, newHash, oldRow.expires_at]
          );

          const newRowId = insertRes.rows[0].id;

          // Link old token to new token via replaced_by_token_id
          await client.query(
            `UPDATE refresh_tokens SET replaced_by_token_id = $1 WHERE id = $2`,
            [newRowId, oldRow.id]
          );

          // Update user session
          await client.query(
            `UPDATE user_sessions SET refresh_token_id = $1 WHERE refresh_token_id = $2`,
            [newRowId, oldRow.id]
          );

          // Issue new access token as well
          const accessToken = this.issueAccessToken(payload);

          return { accessToken, refreshToken: newRefreshToken };
        } catch (err) {
          if (err instanceof UnauthorizedException) throw err;
          logger.error("rotateRefreshToken transaction error:", err);
          throw err;
        }
      });
    } catch (err) {
      logger.error("rotateRefreshToken error:", err);
      if (err instanceof UnauthorizedException) throw err;
      throw new InternalServerErrorException("Failed to rotate refresh token");
    }
  }

  // --- Cookie helper (unchanged) ---
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

  // Request password reset
  async requestPasswordReset(email: string, req: Request) {
    const ip =
      req.ip ||
      (req.headers["x-real-ip"] as string) ||
      (req.headers["x-forwarded-for"] as string);
    const userAgent = req.headers["user-agent"];

    try {
      return await this.withTransaction(async (client) => {
        const res = await client.query(
          `SELECT id, first_name FROM users WHERE email = $1`,
          [email]
        );

        if (res.rows.length === 0) {
          // Audit attempt even if user doesn't exist
          await this.redisAuthService.audit({
            actor: email,
            action: "password-reset.request",
            ip,
            userAgent,
            meta: { reason: "User not found" },
          });

          return { message: "If the email exists, a reset link will be sent" };
        }

        const user = res.rows[0];

        // Generate token
        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = this.hashToken(token);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await client.query(
          `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
          [user.id, tokenHash, expiresAt]
        );

        const resetLink = `${
          process.env.FRONTEND_URL
        }/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

        // Send email
        await SendEmailSendGrid({
          to: email,
          subject: "Password Reset Request",
          body: `Hi ${user.first_name},\n\nClick here to reset your password: ${resetLink}\n\nIf you did not request this, ignore this email.`,
        });

        // Audit successful request
        await this.redisAuthService.audit({
          actor: email,
          action: "password-reset.request.success",
          ip,
          userAgent,
          meta: { userId: user.id },
        });

        return { message: "If the email exists, a reset link will be sent" };
      });
    } catch (err) {
      logger.error("requestPasswordReset error:", err);
      throw new InternalServerErrorException(
        "Failed to process password reset request"
      );
    }
  }

  // Reset password
  // Reset password
  async resetPassword(
    email: string,
    token: string,
    newPassword: string,
    req: Request
  ) {
    const ip =
      req.ip ||
      (req.headers["x-real-ip"] as string) ||
      (req.headers["x-forwarded-for"] as string);
    const userAgent = req.headers["user-agent"];
    const geo = geoip.lookup(ip);
    const location = geo
      ? `${geo.city}, ${geo.region}, ${geo.country}`
      : "unknown";

    try {
      return await this.withTransaction(async (client) => {
        // --- Find user ---
        const res = await client.query(
          `SELECT id, first_name FROM users WHERE email = $1`,
          [email]
        );

        if (res.rows.length === 0) {
          await this.redisAuthService.audit({
            actor: email,
            action: "password-reset.failed",
            ip,
            userAgent,
            meta: { reason: "User not found" },
          });
          throw new UnauthorizedException("Invalid reset token or email");
        }

        const user = res.rows[0];
        const userId = user.id;

        // --- Verify token ---
        const tokenHash = this.hashToken(token);
        const tokenRes = await client.query(
          `SELECT id, expires_at, used_at 
         FROM password_reset_tokens 
         WHERE user_id = $1 AND token_hash = $2
         FOR UPDATE`,
          [userId, tokenHash]
        );

        if (tokenRes.rows.length === 0) {
          throw new UnauthorizedException("Invalid reset token or email");
        }

        const resetToken = tokenRes.rows[0];

        if (resetToken.used_at) {
          throw new UnauthorizedException("Token already used");
        }

        if (new Date(resetToken.expires_at) < new Date()) {
          throw new UnauthorizedException("Token expired");
        }

        // --- Update password (use argon2 for consistency) ---
        const passwordHash = await argon2.hash(newPassword, {
          type: argon2.argon2id,
          memoryCost: 2 ** 16,
          timeCost: 5,
          parallelism: 1,
        });

        await client.query(
          `UPDATE users 
         SET password_hash = $1, updated_at = NOW() 
         WHERE id = $2`,
          [passwordHash, userId]
        );

        // --- Mark this token as used ---
        await client.query(
          `UPDATE password_reset_tokens 
         SET used_at = NOW() 
         WHERE id = $1`,
          [resetToken.id]
        );

        // --- Invalidate ALL refresh tokens for this user ---
        await client.query(
          `UPDATE refresh_tokens 
         SET revoked_at = NOW() 
         WHERE user_id = $1 AND revoked_at IS NULL`,
          [userId]
        );

        // --- Log successful password reset ---
        await this.redisAuthService.audit({
          actor: userId,
          action: "password-reset.success",
          ip,
          userAgent,
          meta: { userId, location },
        });

        return { message: "Password reset successful. Please log in again." };
      });
    } catch (err) {
      logger.error("resetPassword error:", err);
      if (err instanceof UnauthorizedException) throw err;

      throw new InternalServerErrorException(
        "Failed to reset password. Try again."
      );
    }
  }

  // LOGOUT SINGLE USER ON SINGLE DEVICE
  async logout(req: Request, res: Response) {
    const ip =
      req.ip ||
      (req.headers["x-real-ip"] as string) ||
      (req.headers["x-forwarded-for"] as string);
    const userAgent = req.headers["user-agent"];

    const refreshToken = req.cookies?.refreshToken; //req.cookies.refreshToken

    if (!refreshToken) {
      throw new UnauthorizedException("You are not logged in");
    }

    let payload: JwtCustomPayload;
    try {
      payload = this.verifyAccessToken(refreshToken); // or verifyRefreshToken if you prefer DB verification
    } catch (err) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    const userId = payload.sub;

    const tokenHash = this.hashToken(refreshToken);

    // Use transaction for atomicity
    return await this.withTransaction(async (client) => {
      try {
        // Revoke refresh token and get its ID
        const revokeRes = await client.query(
          `UPDATE refresh_tokens
         SET revoked_at = NOW()
         WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL
         RETURNING id`,
          [userId, tokenHash]
        );

        if (revokeRes.rows.length === 0) {
          throw new UnauthorizedException("Token already revoked or invalid");
        }

        const refreshTokenId = revokeRes.rows[0].id;

        // Delete corresponding user session
        await client.query(
          `DELETE FROM user_sessions
         WHERE user_id = $1 AND refresh_token_id = $2`,
          [userId, refreshTokenId]
        );

        // Clear cookie
        res.clearCookie("refreshToken", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/api/v1/admin/auth", // only sent to refresh endpoint  /api/v1/admin/auth/refresh
        });

        // Successful logout audit
        await this.redisAuthService.audit({
          actor: userId,
          action: "logout.success",
          ip,
          userAgent,
        });

        return { message: "Logout successful" };
      } catch (err) {
        throw err; // transaction rollback happens automatically
      }
    });
  }

  // LOGOUT SINGLE USER ON ALL DEVICES
  async logoutAllDevices(userId: string, req: Request, res: Response) {
    const ip =
      req.ip ||
      (req.headers["x-real-ip"] as string) ||
      (req.headers["x-forwarded-for"] as string);
    const userAgent = req.headers["user-agent"];

    try {
      return await this.withTransaction(async (client) => {
        // Fetch email for audit
        const result = await client.query(
          `SELECT email FROM users WHERE id = $1`,
          [userId]
        );
        if (result.rows.length === 0) {
          throw new UnauthorizedException("User not found");
        }
        const email = result.rows[0].email;

        // Revoke ALL refresh tokens and get their IDs
        const revokeRes = await client.query(
          `UPDATE refresh_tokens
         SET revoked_at = NOW()
         WHERE user_id = $1 AND revoked_at IS NULL
         RETURNING id`,
          [userId]
        );

        const revokedTokenIds = revokeRes.rows.map((row) => row.id);

        if (revokedTokenIds.length > 0) {
          // Delete all sessions associated with revoked tokens
          await client.query(
            `DELETE FROM user_sessions
           WHERE user_id = $1 AND refresh_token_id = ANY($2::uuid[])`,
            [userId, revokedTokenIds]
          );
        }

        // Clear cookie for current device
        res.clearCookie("refreshToken", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/api/v1/admin/auth", // only sent to refresh endpoint  /api/v1/admin/auth/refresh
        });

        // Audit logout for all devices
        await this.redisAuthService.audit({
          actor: email,
          action: "logout.success",
          ip,
          userAgent,
          meta: { allDevices: true },
        });

        return { message: "Successfully logged out from all devices" };
      });
    } catch (err) {
      logger.error("logoutAllDevices error:", err);
      if (err instanceof UnauthorizedException) throw err;
      throw new InternalServerErrorException(
        "Failed to log out from all devices"
      );
    }
  }
}
