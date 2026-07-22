import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  body: string;

  @IsOptional()
  @IsUUID()
  parentCommentId?: string;
}

export class UpdateCommentDto {
  @IsString()
  @IsNotEmpty()
  body: string;
}

export class CreateCommentImageDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^image\//i, { message: 'mimeType must be an image/*' })
  mimeType: string;

  @IsNumber()
  fileSizeBytes: number;
}

export class ConfirmCommentImageDto {
  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  r2ObjectKey?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsNumber()
  fileSizeBytes?: number;
}
