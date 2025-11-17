import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import {
  httpRequestsTotal,
  httpRequestDurationSeconds,
  httpErrorsTotal,
} from "../metrics/api.metrics";

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = process.hrtime();

    res.on("finish", () => {
      const diff = process.hrtime(start);
      const durationInSeconds = diff[0] + diff[1] / 1e9;

      httpRequestsTotal
        .labels(
          req.method,
          req.route?.path || req.path,
          res.statusCode.toString()
        )
        .inc();
      httpRequestDurationSeconds
        .labels(req.method, req.route?.path || req.path)
        .observe(durationInSeconds);

      if (res.statusCode >= 400) {
        httpErrorsTotal
          .labels(
            req.method,
            req.route?.path || req.path,
            res.statusCode.toString()
          )
          .inc();
      }
    });

    next();
  }
}
