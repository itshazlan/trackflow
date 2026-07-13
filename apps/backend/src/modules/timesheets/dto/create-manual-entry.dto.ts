import { IsString, IsNotEmpty, IsOptional, IsUUID, IsInt, IsDateString, Min } from 'class-validator';

export class CreateManualEntryDto {
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @IsUUID()
  @IsOptional()
  issueId?: string | null;

  @IsInt()
  @Min(1)
  durationMinutes: number;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsDateString()
  @IsNotEmpty()
  entryDate: string;
}
