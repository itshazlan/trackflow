import { IsString, IsNotEmpty, IsOptional, IsEmail, IsBoolean, IsIn } from 'class-validator';

export class AdminCreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  employeeId?: string;

  @IsString()
  @IsOptional()
  joinDate?: string;

  @IsString()
  @IsOptional()
  @IsIn(['active', 'inactive', 'on_leave'])
  employmentStatus?: 'active' | 'inactive' | 'on_leave';

  @IsBoolean()
  @IsOptional()
  isAdmin?: boolean;
}

export class AdminUpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  employeeId?: string;

  @IsString()
  @IsOptional()
  joinDate?: string;

  @IsString()
  @IsOptional()
  @IsIn(['active', 'inactive', 'on_leave'])
  employmentStatus?: 'active' | 'inactive' | 'on_leave';

  @IsBoolean()
  @IsOptional()
  isAdmin?: boolean;
}

export class UpdateEmploymentDto {
  @IsString()
  @IsOptional()
  position?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  employeeId?: string;

  @IsString()
  @IsOptional()
  joinDate?: string;

  @IsString()
  @IsOptional()
  @IsIn(['active', 'inactive', 'on_leave'])
  employmentStatus?: 'active' | 'inactive' | 'on_leave';
}
