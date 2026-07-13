import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsString()
  @IsOptional()
  companyName?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  screenshotRetentionDays?: number;
}
