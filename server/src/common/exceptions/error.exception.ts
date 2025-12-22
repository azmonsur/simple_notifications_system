import { HttpException, HttpStatus } from "@nestjs/common";

export class AccountLockedException extends HttpException {
  constructor(message?: any) {
    super(
      {
        statusCode: 423,
        error: "Account Locked",
        message,
      },
      423
    );
  }
}

export class TooManyRequestException extends HttpException {
  constructor(message?: any) {
    super(message || "Too many requets", HttpStatus.TOO_MANY_REQUESTS);
  }
}
