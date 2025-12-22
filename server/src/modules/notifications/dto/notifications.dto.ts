// src/dto/notifications.dto.ts
import {
  IsString,
  IsArray,
  IsOptional,
  IsEmail,
  ValidateNested,
  IsNotEmpty,
  IsIn,
  IsNumber,
  Min,
  IsBoolean,
  Matches,
} from "class-validator";
import { Type } from "class-transformer";

// Constants
export const CHANNELS = ["sms", "whatsapp", "email"] as const;
export const PARCEL_STATUS = [
  "pending",
  "dispatched",
  "arrived",
  "received",
  "returned",
] as const;

// Recipient DTO
export class RecipientDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsArray()
  @IsIn(CHANNELS, {
    each: true,
    message: "Each preferred channel must be one of: sms, whatsapp, email",
  })
  preferred_channels!: (typeof CHANNELS)[number][];
}

// Notification Event DTO
export class NotificationEventDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/[a-zA-Z0-9-]{4,}/, {
    message: "Tracking number must be alphanumeric",
  })
  tracking_number!: string;

  @IsString()
  @IsIn(PARCEL_STATUS, {
    message: `Status must be one of: ${PARCEL_STATUS.join(", ")}`,
  })
  parcel_status!: (typeof PARCEL_STATUS)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsBoolean()
  recall!: Boolean;

  @IsOptional()
  @IsString()
  origin_center?: string;

  @IsOptional()
  @IsString()
  destination_center?: string;

  @ValidateNested()
  @Type(() => RecipientDto)
  sender!: RecipientDto;

  @ValidateNested()
  @Type(() => RecipientDto)
  receiver!: RecipientDto;
}

// Main DTO
export class CreateNotificationDto {
  @ValidateNested()
  @Type(() => NotificationEventDto)
  payload!: NotificationEventDto;
}
