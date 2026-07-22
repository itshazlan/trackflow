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

export class CreateCommentAttachmentDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsNumber()
  fileSizeBytes: number;
}

export class ConfirmCommentAttachmentDto {
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

export class CreateCommentImageDto extends CreateCommentAttachmentDto {}
export class ConfirmCommentImageDto extends ConfirmCommentAttachmentDto {}
