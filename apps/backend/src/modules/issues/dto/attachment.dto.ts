import { IsNotEmpty, IsString } from 'class-validator';

export class CreateAttachmentDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  contentType: string;
}
