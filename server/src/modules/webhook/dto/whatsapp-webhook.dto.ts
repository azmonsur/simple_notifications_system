import { IsString, IsOptional } from "class-validator";

export class WhatsAppWebhookDto {
  @IsString()
  message_id?: string;

  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  timestamp?: string;
}
