import { SetMetadata } from '@nestjs/common';
import { ProjectRole } from '@trackflow/shared-types';

export const Roles = (...roles: ProjectRole[]) => SetMetadata('roles', roles);
