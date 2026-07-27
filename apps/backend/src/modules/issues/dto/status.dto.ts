import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsIn,
  IsArray,
  IsBoolean,
} from 'class-validator';
import type { ProjectRole } from '@trackflow/shared-types';

export class CreateStatusDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  orderIndex: number;

  @IsString()
  @IsOptional()
  @IsIn(['manager', 'developer', 'reporter_qa'])
  restrictedToRole?: ProjectRole | null;

  @IsBoolean()
  @IsOptional()
  isFinal?: boolean;
}

export class UpdateStatusDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsInt()
  @IsOptional()
  orderIndex?: number;

  @IsString()
  @IsOptional()
  @IsIn(['manager', 'developer', 'reporter_qa'])
  restrictedToRole?: ProjectRole | null;

  @IsBoolean()
  @IsOptional()
  isFinal?: boolean;
}

export class ReorderStatusesDto {
  @IsArray()
  @IsString({ each: true })
  statusIds: string[];
}
