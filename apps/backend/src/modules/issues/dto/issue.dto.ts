import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsIn,
  IsObject,
  IsNumber,
} from 'class-validator';

export class CreateIssueDto {
  @IsUUID()
  @IsNotEmpty()
  trackerId: string;

  @IsUUID()
  @IsOptional()
  statusId?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  templateId?: string;

  @IsObject()
  @IsOptional()
  titleValues?: Record<string, string>;

  @IsObject()
  @IsOptional()
  fieldValues?: Record<string, string>;

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
