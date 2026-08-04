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
  @Max(104857600, { message: 'Ukuran berkas tidak boleh melebihi 100MB.' })
  fileSizeBytes: number;
}
