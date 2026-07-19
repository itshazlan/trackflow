import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  titlePattern?: string;

  @IsString()
  @IsOptional()
  descriptionPattern?: string;

  @IsUUID()
  @IsOptional()
  trackerId?: string;

  @IsUUID()
  @IsOptional()
  projectId?: string | null;
}

export class UpdateTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  titlePattern?: string;

  @IsString()
  @IsOptional()
  descriptionPattern?: string;

  @IsUUID()
  @IsOptional()
  trackerId?: string;
}
