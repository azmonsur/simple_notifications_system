import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const response = isHttp ? exception.getResponse() : null;

    const extractedMessage =
      typeof response === "string"
        ? response
        : response && (response as any).message
        ? (response as any).message
        : "An error occurred";

    // Log full details server-side
    this.logger.error({
      path: req.path,
      method: req.method,
      status,
      error: exception instanceof Error ? exception.stack : exception,
    });

    const isProd = process.env.NODE_ENV === "production";

    res.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: req.path,

      // 👇 PRODUCTION — return ONLY cleaned message
      message: isProd
        ? status === 500
          ? "Internal server error"
          : extractedMessage
        : // 👇 DEVELOPMENT — return full original exception response
          response ?? extractedMessage,
    });
  }
}
