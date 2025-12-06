// src/dto/notifications.dto.ts
import { IsEmail, IsNotEmpty, IsString, Min } from "class-validator";

// Main DTO
export class CreateLoginDto {
  @IsEmail({}, { message: "Invalid email address" })
  email!: string;

  @IsNotEmpty({ message: "Password is required" })
  password!: string;
}
