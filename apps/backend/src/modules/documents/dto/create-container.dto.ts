import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export class CreateContainerDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsEnum(['project_doc', 'supporting_file', 'third_party'])
  @IsNotEmpty()
  category: 'project_doc' | 'supporting_file' | 'third_party';

  @IsString()
  @IsOptional()
  description?: string;
}
