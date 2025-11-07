// src/dto/notifications.dto.ts
import { IsString, Min } from "class-validator";

// Main DTO
export class CreateLoginDto {
  @IsString()
  email!: string;

  @IsString()
  password!: string;
}
