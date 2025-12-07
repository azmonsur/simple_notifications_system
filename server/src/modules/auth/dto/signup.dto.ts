// src/modules/auth/dto/signup.dto.ts
import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsIn,
  Matches,
} from "class-validator";

export class CreateSignupDto {
  @IsEmail({}, { message: "Invalid email address" })
  email!: string;

  @IsNotEmpty({ message: "Username is required" })
  username!: string;

  @IsNotEmpty({ message: "Password is required" })
  // @MinLength(6, { message: "Password must be at least 6 characters" })
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/, {
    message:
      "Password must be at least 6 characters long and include uppercase, lowercase, number, and special character",
  })
  password!: string;

  @IsNotEmpty({ message: "First name is required" })
  firstName!: string;

  @IsNotEmpty({ message: "Last name is required" })
  lastName!: string;

  @IsOptional()
  @IsIn(["male", "female", "other"], {
    message: "Gender must be male, female, or other",
  })
  gender?: string;

  @IsNotEmpty({ message: "First name is required" })
  roleName!: string;
}
