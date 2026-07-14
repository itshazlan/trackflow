import { IsString, IsOptional } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string | null;

  @IsString()
  @IsOptional()
  image?: string | null;

  @IsString()
  @IsOptional()
  position?: string | null;

  @IsString()
  @IsOptional()
  department?: string | null;
}
