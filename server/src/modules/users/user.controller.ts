import { Controller, Post, Body, Req } from "@nestjs/common";
import { Request } from "express";
import { Throttle } from "@nestjs/throttler";
import { UserService } from "./user.service";

@Controller("")
export class UserController {
  constructor(private readonly userService: UserService) {}

  // @Throttle({ default: { limit: 20, ttl: 60 } }) // max 20 requests per IP per 60 seconds
  @Post("users")
  async createUser(
    @Body()
    body: {
      username: string;
      first_name: string;
      last_name: string;
      age: number;
      gender: string;
    },
    @Req() req: Request
  ) {
    {
      const ip = req.ip;
      return this.userService.createUser(body, ip as unknown as string);
    }
  }
}
