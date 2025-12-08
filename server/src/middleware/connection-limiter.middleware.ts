// middleware/connection-limiter.middleware.ts
import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger/logger";

interface ConnectionLimiterConfig {
  maxConnectionsPerIp?: number;
  maxConnectionsGlobal?: number;
  whitelistedIps?: string[];
}

@Injectable()
export class ConnectionLimiterMiddleware implements NestMiddleware {
  private connections = new Map<string, number>();
  private totalConnections = 0;

  private maxConnectionsPerIp: number;
  private maxConnectionsGlobal: number;
  private whitelistedIps: string[];

  constructor(config?: ConnectionLimiterConfig) {
    this.maxConnectionsPerIp = config?.maxConnectionsPerIp || 50;
    this.maxConnectionsGlobal = config?.maxConnectionsGlobal || 1000;
    this.whitelistedIps = config?.whitelistedIps || ["127.0.0.1", "::1"];

    this.startCleanup();
  }

  use(req: Request, res: Response, next: NextFunction) {
    const ip = this.getClientIp(req);

    // Skip whitelisted IPs
    if (this.whitelistedIps.includes(ip)) {
      return next();
    }

    // Check global connection limit
    if (this.totalConnections >= this.maxConnectionsGlobal) {
      logger.warn(
        `Global connection limit reached: ${this.totalConnections}/${this.maxConnectionsGlobal}`
      );
      return res.status(503).json({
        error: "Service temporarily unavailable",
        message: "Server is at maximum capacity. Please try again later.",
      });
    }

    const currentConnections = this.connections.get(ip) || 0;

    // Check per-IP connection limit
    if (currentConnections >= this.maxConnectionsPerIp) {
      logger.warn(
        `Connection limit exceeded for IP: ${ip} (${currentConnections}/${this.maxConnectionsPerIp})`
      );
      return res.status(429).json({
        error: "Too many concurrent connections",
        message: `Maximum ${this.maxConnectionsPerIp} concurrent connections allowed per IP`,
        currentConnections,
        limit: this.maxConnectionsPerIp,
      });
    }

    // Increment connection count
    this.incrementConnection(ip);

    // Decrement when response finishes or closes
    let cleaned = false;
    const cleanup = () => {
      if (!cleaned) {
        cleaned = true;
        this.decrementConnection(ip);
      }
    };

    res.on("finish", cleanup);
    res.on("close", cleanup);

    next();
  }

  private incrementConnection(ip: string) {
    const current = this.connections.get(ip) || 0;
    this.connections.set(ip, current + 1);
    this.totalConnections++;
  }

  private decrementConnection(ip: string) {
    const current = this.connections.get(ip) || 1;
    if (current <= 1) {
      this.connections.delete(ip);
    } else {
      this.connections.set(ip, current - 1);
    }
    this.totalConnections = Math.max(0, this.totalConnections - 1);
  }

  private getClientIp(req: Request): string {
    // Handle proxies (Nginx, CloudFlare, etc.)
    return (
      (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
      (req.headers["x-real-ip"] as string) ||
      (req.headers["cf-connecting-ip"] as string) || // CloudFlare
      req.socket.remoteAddress ||
      "unknown"
    );
  }

  // Cleanup stale connections periodically
  private startCleanup() {
    setInterval(() => {
      const before = this.connections.size;
      // Remove entries with 0 connections (shouldn't happen, but safety check)
      for (const [ip, count] of this.connections.entries()) {
        if (count <= 0) {
          this.connections.delete(ip);
        }
      }
      const after = this.connections.size;
      if (before !== after) {
        logger.info(`Cleaned up ${before - after} stale connection entries`);
      }
    }, 60000); // Every minute
  }

  // Get current stats
  getStats() {
    return {
      totalConnections: this.totalConnections,
      uniqueIps: this.connections.size,
      maxConnectionsPerIp: this.maxConnectionsPerIp,
      maxConnectionsGlobal: this.maxConnectionsGlobal,
      topIps: Array.from(this.connections.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([ip, count]) => ({ ip, connections: count })),
    };
  }
}
