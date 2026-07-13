import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import { user } from '../../db/schema/auth';
import { UpdateProfileDto } from './dto/user-profile.dto';

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async findOne(id: string) {
    const [found] = await this.db
      .select()
      .from(user)
      .where(eq(user.id, id))
      .limit(1);

    if (!found) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Exclude password hash from response for security
    const { password, ...safeUser } = found;
    return safeUser;
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const [updated] = await this.db
      .update(user)
      .set(dto)
      .where(eq(user.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const { password, ...safeUser } = updated;
    return safeUser;
  }
}
