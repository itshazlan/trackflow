import { IsString, IsNotEmpty, IsIn } from 'class-validator';
import type { ProjectRole } from '@trackflow/shared-types';

export class AddMembershipDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['manager', 'developer', 'reporter_qa'])
  role: ProjectRole;
}

export class UpdateMembershipDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['manager', 'developer', 'reporter_qa'])
  role: ProjectRole;
}
