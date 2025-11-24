import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from "@nestjs/common";
import { logger } from "../utils/logger";
import { Request, Response, NextFunction } from "express";

@Injectable()
export class ApiKeyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const apiKey = process.env.NIPOST_API_KEY; // always read at runtime
    const authHeader = req.headers["authorization"]!;

    const token = authHeader.replace("Bearer ", "").trim();
    const clientIp = req.ip || req.connection.remoteAddress;

    logger.info(`Incoming request from IP: ${clientIp}`);
    logger.debug(`Received token: ${token}`);

    // API key validation
    if (!token || token !== apiKey) {
      logger.warn(`Unauthorized request from IP: ${clientIp}`);
      throw new UnauthorizedException("Invalid or missing API key");
    }

    next();
  }
}
