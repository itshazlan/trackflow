import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';

export class OverrideTimeBlockDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['delete', 'mark_unpaid'])
  action: 'delete' | 'mark_unpaid';

  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class SelfDeleteTimeBlockDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
