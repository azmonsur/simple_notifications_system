// src/modules/auth/auth.service.ts
import { Injectable, UnauthorizedException } from "@nestjs/common";
import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { CreateLoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  private readonly jwtSecret = process.env.JWT_SECRET || "replace_this_secret";
  // We accept env as string (e.g. "8h", "1d", "3600") or numeric seconds (e.g. "3600")
  // We'll cast later to string | number to satisfy SignOptions typing.
  private readonly tokenExpiryEnv = process.env.JWT_EXPIRES_IN || "8h";

  validateAdmin({ email, password }: CreateLoginDto): {} {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      // Fail safe — deny access if env not configured
      return false;
    }

    return email === adminEmail && password === adminPassword;
  }

  issueToken(payload: Record<string, any>): string {
    // Copy type of property of an interface (SignOptions)
    type StringValue = SignOptions["expiresIn"];

    // Cast to string | number to satisfy SignOptions.expiresIn typing.
    const expiresIn = this.tokenExpiryEnv as unknown as StringValue;
    const options: SignOptions = { expiresIn };

    // jwt.sign has multiple overloads — this call matches the (payload, secret, options) overload.
    return jwt.sign(payload, this.jwtSecret, options);
  }

  verifyToken(token: string): string | JwtPayload {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (err) {
      throw new UnauthorizedException("Invalid token");
    }
  }
}
