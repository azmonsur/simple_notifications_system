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
      ? (exception as HttpException).getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = isHttp
      ? (exception as HttpException).getResponse()
      : "Internal server error";

    // Log full details server-side (logs should not be exposed to clients)
    this.logger.error({
      path: req.path,
      method: req.method,
      status,
      message: exception instanceof Error ? exception.stack : exception,
    });

    // Return sanitized response
    res.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: req.path,
      message:
        process.env.NODE_ENV === "production"
          ? status === HttpStatus.INTERNAL_SERVER_ERROR
            ? "Internal server error"
            : typeof message === "string"
            ? message
            : (message as any).message
          : message,
    });
  }
}
