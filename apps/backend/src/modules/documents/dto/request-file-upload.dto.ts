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
  @Max(104857600) // 100MB limit (104857600 bytes)
  fileSizeBytes: number;
}
