import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const authHeader =
      req.headers["authorization"] || req.headers["Authorization"];
    if (!authHeader)
      throw new UnauthorizedException("Authorization header missing");

    const parts = (
      Array.isArray(authHeader) ? authHeader[0] : authHeader
    ).split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer")
      throw new UnauthorizedException("Malformed authorization header");

    const token = parts[1];
    try {
      const payload = this.authService.verifyToken(token);
      // attach user info to request for handlers if needed
      req.user = payload;
      return true;
    } catch (err) {
      throw new UnauthorizedException("Invalid token");
    }
  }
}
