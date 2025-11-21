import { IsString, IsOptional, IsNumber } from "class-validator";

export class SendGridEventDto {
  @IsString()
  email?: string;

  @IsString()
  event?: string; // e.g., "delivered", "open", "bounce"

  @IsOptional()
  @IsString()
  ip?: string;

  @IsOptional()
  @IsString()
  response?: string;

  @IsOptional()
  @IsString()
  sg_event_id?: string;

  @IsOptional()
  @IsString()
  sg_message_id?: string;

  @IsOptional()
  @IsString()
  "smtp-id"?: string;

  @IsOptional()
  @IsNumber()
  timestamp?: number;

  @IsOptional()
  @IsNumber()
  tls?: number;
}
