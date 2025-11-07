import { Controller, Post, Body, BadRequestException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { CreateLoginDto } from "./dto/login.dto";

@Controller("api/v1/admin/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  async login(@Body() body: CreateLoginDto) {
    const { email, password } = body || {};
    if (!email || !password)
      throw new BadRequestException("email and password are required");

    const ok = this.authService.validateAdmin(body);
    if (!ok) {
      throw new BadRequestException("Invalid credentials");
    }

    // payload can be extended
    const token = this.authService.issueToken({ sub: email, role: "admin" });
    return { token };
  }
}
