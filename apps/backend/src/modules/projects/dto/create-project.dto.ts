import { IsString, IsNotEmpty, IsOptional, IsUUID, Matches } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z][A-Z0-9_-]{1,9}$/, {
    message: 'Project key must be uppercase, alphanumeric, hyphen or underscore, 2-10 characters, and start with an uppercase letter.',
  })
  key: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  parentProjectId?: string;
}
