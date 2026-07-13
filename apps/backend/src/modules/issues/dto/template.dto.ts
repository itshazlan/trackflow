import { IsString, IsNotEmpty, IsOptional, IsUUID, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class TemplateFieldDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsBoolean()
  required: boolean;

  @IsString()
  @IsOptional()
  helperText?: string;
}

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  titlePattern?: string;

  @IsUUID()
  @IsNotEmpty()
  trackerId: string;

  @IsUUID()
  @IsOptional()
  projectId?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateFieldDto)
  fields: TemplateFieldDto[];
}

export class UpdateTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  titlePattern?: string;

  @IsUUID()
  @IsOptional()
  trackerId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateFieldDto)
  @IsOptional()
  fields?: TemplateFieldDto[];
}
