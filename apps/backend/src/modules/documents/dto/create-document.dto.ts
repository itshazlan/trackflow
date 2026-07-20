import { IsString, IsNotEmpty, IsEnum, IsInt, IsOptional } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsEnum(['project_doc', 'supporting_file', 'third_party'])
  @IsNotEmpty()
  category: 'project_doc' | 'supporting_file' | 'third_party';

  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsInt()
  @IsNotEmpty()
  fileSizeBytes: number;

  @IsString()
  @IsOptional()
  description?: string;
}
