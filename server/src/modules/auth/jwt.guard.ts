// src/modules/auth/jwt-auth.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthService, JwtCustomPayload } from "./auth.service";
import { Request } from "express";
import { IS_PUBLIC_KEY } from "../../common/decorators/public.decorator";

export interface AuthRequest extends Request {
  user?: JwtCustomPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private static readonly EXCLUDED = ["/metrics", "/health"];
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const req: AuthRequest = context.switchToHttp().getRequest();
    const path = req.url.split("?")[0];

    if (JwtAuthGuard.EXCLUDED.includes(path)) return true;

    const authHeader =
      req.headers["authorization"] || req.headers["Authorization"];

    console.log("authHeader", authHeader);
    if (!authHeader)
      throw new UnauthorizedException("Authorization header missing");

    const token = Array.isArray(authHeader)
      ? authHeader[0].split(" ")[1]
      : authHeader.split(" ")[1];
    if (!token)
      throw new UnauthorizedException("Malformed authorization header");

    try {
      // ✅ Stateless: just verify the JWT signature and expiration
      const payload: JwtCustomPayload =
        this.authService.verifyAccessToken(token);

      // Attach payload to request
      req.user = payload;

      // Optional role check
      const requiredRoles = this.reflector.get<string[]>(
        "roles",
        context.getHandler()
      );
      if (
        requiredRoles &&
        requiredRoles.length > 0 &&
        !requiredRoles.includes(payload.role)
      ) {
        throw new ForbiddenException("Insufficient permissions");
      }

      return true;
    } catch (err) {
      if (
        err instanceof UnauthorizedException ||
        err instanceof ForbiddenException
      )
        throw err;
      throw new UnauthorizedException("Invalid access token");
    }
  }
}
