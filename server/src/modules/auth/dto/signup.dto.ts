// src/modules/auth/dto/signup.dto.ts
import { Transform } from "class-transformer";
import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsIn,
  Matches,
} from "class-validator";

export class CreateSignupDto {
  // EMAIL
  @IsEmail({}, { message: "Invalid email address" })
  email!: string;

  // USERNAME
  @IsNotEmpty({ message: "Username is required" })
  @Matches(/^[A-Za-z0-9_]{4,}$/, {
    message:
      "Username must be at least 4 characters long and only include uppercase, lowercase, number, underscore",
  })
  // @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  username!: string;

  // PASSWORD
  @IsNotEmpty({ message: "Password is required" })
  @Matches(
    /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])[^\s]{6,20}$/,
    {
      message:
        "Password must be 6 - 20 characters long and include at least one uppercase, lowercase, number, and special character",
    }
  )
  password!: string;

  // FIRSTNAME
  @IsNotEmpty({ message: "First name is required" })
  @MinLength(2, { message: "Firstname must be at least 2 characters long" })
  @Matches(/^(?!.*(--|''))^[A-Za-z]+([-''][A-Za-z]+)*$/, {
    message:
      "Firstname can only include uppercase, lowercase, hyphen, and apostrope",
  })
  firstName!: string;

  // LASTNAME
  @IsNotEmpty({ message: "Last name is required" })
  @MinLength(2, { message: "Lastname must be at least 2 characters long" })
  @Matches(/^(?!.*(--|''))^[A-Za-z]+([-''][A-Za-z]+)*$/, {
    message:
      "Lastname can only include uppercase, lowercase, hyphen, and apostrope",
  })
  lastName!: string;

  // GENDER
  @IsOptional()
  @IsIn(["male", "female", "other"], {
    message: "Gender must be male, female, or other",
  })
  gender?: string;

  // ROLENAME
  @IsNotEmpty({ message: "role name is required" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  roleName!: string;
}
