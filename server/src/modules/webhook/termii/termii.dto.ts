import { IsNotEmpty, IsOptional, IsString, IsNumber } from "class-validator";

export class TermiiDLRDto {
  @IsString()
  @IsNotEmpty()
  type?: string; // "outbound"

  @IsString()
  @IsNotEmpty()
  receiver?: string; // e.g., "2348132329187"

  @IsString()
  @IsNotEmpty()
  sender?: string; // e.g., "CyberBridge"

  @IsString()
  @IsNotEmpty()
  message?: string;

  @IsOptional()
  @IsString()
  cost?: string; // e.g., "10.0000"

  @IsOptional()
  @IsNumber()
  pages?: number;

  @IsOptional()
  @IsString()
  command?: string; // "deliver"

  @IsString()
  @IsNotEmpty()
  status?: string; // e.g., "DELIVERED | Message delivered to handset"

  @IsOptional()
  @IsString()
  channel?: string; // "generic"

  @IsString()
  @IsNotEmpty()
  message_id?: string;

  @IsOptional()
  @IsString()
  message_id_str?: string;

  @IsOptional()
  @IsString()
  sent_at?: string; // ISO timestamp

  @IsOptional()
  @IsString()
  delivered_at?: string; // ISO timestamp

  @IsOptional()
  @IsNumber()
  msgtype?: number;

  @IsOptional()
  @IsString()
  origid?: string;

  @IsOptional()
  @IsString()
  messagestate?: string;

  @IsOptional()
  @IsString()
  notify_id?: string;
}
