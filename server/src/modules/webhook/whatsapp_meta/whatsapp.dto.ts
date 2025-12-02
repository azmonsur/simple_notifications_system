import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class WhatsAppWebhookDto {
  @IsString()
  @IsNotEmpty()
  object?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppEntryDto)
  entry?: WhatsAppEntryDto[];
}

export class WhatsAppEntryDto {
  @IsString()
  @IsNotEmpty()
  id?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppChangeDto)
  changes?: WhatsAppChangeDto[];
}

export class WhatsAppChangeDto {
  @IsString()
  @IsNotEmpty()
  field?: string;

  @ValidateNested()
  @Type(() => WhatsAppChangeValueDto)
  value?: WhatsAppChangeValueDto;
}

export class WhatsAppChangeValueDto {
  @IsString()
  @IsNotEmpty()
  messaging_product?: string;

  @ValidateNested()
  @Type(() => WhatsAppMetadataDto)
  metadata?: WhatsAppMetadataDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppStatusDto)
  statuses?: WhatsAppStatusDto[];
}

export class WhatsAppMetadataDto {
  @IsString()
  @IsNotEmpty()
  display_phone_number?: string;

  @IsString()
  @IsNotEmpty()
  phone_number_id?: string;
}

export class WhatsAppStatusDto {
  @IsString()
  @IsNotEmpty()
  id?: string;

  @IsString()
  @IsNotEmpty()
  status?: string; // e.g. "sent", "delivered", "failed"

  @IsString()
  @IsNotEmpty()
  timestamp?: string;

  @IsString()
  @IsNotEmpty()
  recipient_id?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppErrorDto)
  errors?: WhatsAppErrorDto[];
}

export class WhatsAppErrorDto {
  @IsNotEmpty()
  code?: number;

  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsString()
  @IsNotEmpty()
  message?: string;

  @IsOptional()
  error_data?: {
    details?: string;
  };

  @IsOptional()
  @IsString()
  href?: string;
}
