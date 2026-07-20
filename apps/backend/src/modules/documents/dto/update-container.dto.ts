import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export class UpdateContainerDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  title?: string;

  @IsEnum(['project_doc', 'supporting_file', 'third_party'])
  @IsNotEmpty()
  @IsOptional()
  category?: 'project_doc' | 'supporting_file' | 'third_party';

  @IsString()
  @IsOptional()
  description?: string | null;
}
