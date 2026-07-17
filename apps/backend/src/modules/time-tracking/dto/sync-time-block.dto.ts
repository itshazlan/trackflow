import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
  IsInt,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SyncActivityDto {
  @IsInt()
  keyboardCount: number;

  @IsInt()
  mouseCount: number;

  @IsString()
  @IsNotEmpty()
  activeAppName: string;

  @IsString()
  @IsNotEmpty()
  activeWindowTitle: string;
}

export class SyncTimeBlockDto {
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @IsUUID()
  @IsOptional()
  issueId?: string | null;

  @IsString()
  @IsOptional()
  note?: string | null;

  @IsDateString()
  @IsNotEmpty()
  blockStart: string;

  @IsDateString()
  @IsNotEmpty()
  blockEnd: string;

  @IsObject()
  @ValidateNested()
  @Type(() => SyncActivityDto)
  activity: SyncActivityDto;
}
