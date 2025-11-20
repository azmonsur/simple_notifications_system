import { IsString, IsOptional } from "class-validator";

export class EmailWebhookDto {
  @IsString()
  event?: string;

  @IsOptional()
  message?: {
    id: string;
  };

  @IsOptional()
  recipient?: string;
}
