import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsIn,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateIssueDto {
  @IsUUID()
  @IsNotEmpty()
  trackerId: string;

  @IsUUID()
  @IsOptional()
  statusId?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  assigneeId?: string | null;

  @IsString()
  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority?: 'low' | 'medium' | 'high' | 'urgent';

  @IsString()
  @IsOptional()
  startDate?: string | null;

  @IsString()
  @IsOptional()
  dueDate?: string | null;

  @IsNumber()
  @IsOptional()
  estimatedHours?: number | null;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  collaboratorIds?: string[];
}

export class UpdateIssueDto {
  @IsUUID()
  @IsOptional()
  trackerId?: string;

  @IsUUID()
  @IsOptional()
  statusId?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  assigneeId?: string | null;

  @IsString()
  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority?: 'low' | 'medium' | 'high' | 'urgent';

  @IsString()
  @IsOptional()
  startDate?: string | null;

  @IsString()
  @IsOptional()
  dueDate?: string | null;

  @IsNumber()
  @IsOptional()
  estimatedHours?: number | null;
}

export class UpdateIssueStatusDto {
  @IsUUID()
  @IsNotEmpty()
  statusId: string;
}

export class AddCollaboratorDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class CommitImportRowDto {
  @IsNumber()
  @IsNotEmpty()
  row: number;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsUUID()
  @IsNotEmpty()
  trackerId: string;

  @IsString()
  @IsNotEmpty()
  trackerName: string;

  @IsString()
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority: 'low' | 'medium' | 'high' | 'urgent';

  @IsString()
  @IsOptional()
  dueDate?: string | null;

  @IsUUID()
  @IsNotEmpty()
  statusId: string;

  @IsString()
  @IsNotEmpty()
  statusName: string;

  @IsString()
  @IsOptional()
  assigneeId?: string | null;
}

export class CommitImportDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommitImportRowDto)
  rows: CommitImportRowDto[];

  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  sheetName: string;
}
