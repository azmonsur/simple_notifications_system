import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  IsNumber,
} from "class-validator";
import { Type } from "class-transformer";

// --- LEVEL 5: Error Details ---
export class WhatsAppErrorDto {
  @IsNumber()
  @IsNotEmpty()
  code!: number;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsOptional()
  error_data?: {
    details?: string;
  };

  @IsOptional()
  @IsString()
  href?: string;
}

// --- LEVEL 4: Status Update (Delivery Receipt - DLR) ---
export class WhatsAppStatusDto {
  @IsString()
  @IsNotEmpty()
  id!: string; // Message ID of the outbound message

  @IsString()
  @IsNotEmpty()
  status!: string; // e.g., 'delivered', 'read', 'failed'

  @IsString()
  @IsNotEmpty()
  timestamp!: string;

  @IsString()
  @IsNotEmpty()
  recipient_id!: string; // The customer's phone number

  // Use lazy function for potential circular/initialization issues
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppErrorDto)
  errors?: WhatsAppErrorDto[];
}

// --- LEVEL 3: Metadata (Information about your business number) ---
export class WhatsAppMetadataDto {
  @IsString()
  @IsNotEmpty()
  display_phone_number!: string;

  @IsString()
  @IsNotEmpty()
  phone_number_id!: string;
}

// --- LEVEL 2: Value (The core event data - Statuses OR Messages) ---
// IMPORTANT: You need to add the 'messages' array here to handle incoming messages
export class WhatsAppChangeValueDto {
  @IsString()
  @IsNotEmpty()
  messaging_product!: string;

  @ValidateNested()
  @Type(() => WhatsAppMetadataDto)
  metadata!: WhatsAppMetadataDto;

  @IsArray()
  @IsOptional() // Statuses is optional because the payload could contain 'messages'
  @ValidateNested({ each: true })
  @Type(() => WhatsAppStatusDto)
  statuses?: WhatsAppStatusDto[];

  // 💡 Add the 'messages' property here to handle customer-initiated messages
  // You will need a separate WhatsAppMessageDto if you want to validate incoming messages
  @IsArray()
  @IsOptional()
  messages?: any[];
}

// --- LEVEL 1: Change (Wraps the 'Value' object) ---
export class WhatsAppChangeDto {
  @IsString()
  @IsNotEmpty()
  field!: string; // Should be 'messages'

  @ValidateNested()
  // 💡 FIX APPLIED HERE: Guaranteeing lazy loading is essential for this reference
  @Type(() => WhatsAppChangeValueDto)
  value!: WhatsAppChangeValueDto;
}

// --- TOP LEVEL: Entry (Wraps the 'Change' object) ---
export class WhatsAppEntryDto {
  @IsString()
  @IsNotEmpty()
  id!: string; // The ID of the WhatsApp Business Account (WABA ID)

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppChangeDto)
  changes!: WhatsAppChangeDto[];
}

// --- ROOT DTO ---
export class WhatsAppWebhookDto {
  @IsString()
  @IsNotEmpty()
  object!: string; // Should be 'whatsapp'

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppEntryDto)
  entry!: WhatsAppEntryDto[];
}
