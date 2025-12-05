import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService, JwtCustomPayload } from "./auth.service";
import { Request } from "express";

export interface AuthRequest extends Request {
  user?: JwtCustomPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req: AuthRequest = context.switchToHttp().getRequest();
    const authHeader =
      req.headers["authorization"] || req.headers["Authorization"];
    if (!authHeader)
      throw new UnauthorizedException("Authorization header missing");

    const token = Array.isArray(authHeader)
      ? authHeader[0].split(" ")[1]
      : authHeader.split(" ")[1];

    if (!token)
      throw new UnauthorizedException("Malformed authorization header");

    try {
      // Use the new type-safe access token verifier
      const payload = this.authService.verifyAccessToken(token);

      // Attach payload to request
      req.user = payload;

      return true;
    } catch (err) {
      throw new UnauthorizedException("Invalid access token");
    }
  }
}
