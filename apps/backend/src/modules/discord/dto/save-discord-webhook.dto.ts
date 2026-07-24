import { IsString, IsNotEmpty, IsUrl, IsArray, IsOptional } from 'class-validator';

export class SaveDiscordWebhookDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl({}, { message: 'webhookUrl must be a valid URL' })
  webhookUrl: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  events?: string[];
}
