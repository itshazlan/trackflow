import { IsString, IsNotEmpty, IsInt, Max, Min } from 'class-validator';

export class RequestFileUploadDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsInt()
  @Min(1)
  @Max(52428800) // 50MB limit (52428800 bytes)
  fileSizeBytes: number;
}
