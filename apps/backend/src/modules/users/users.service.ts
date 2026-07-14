import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import { user } from '../../db/schema/auth';
import { UpdateProfileDto } from './dto/user-profile.dto';
import { R2Service } from '../time-tracking/r2.service';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly r2Service: R2Service,
  ) {}

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
    const cleanDto: any = { ...dto };
    delete cleanDto.employeeId;
    delete cleanDto.joinDate;
    delete cleanDto.employmentStatus;
    delete cleanDto.isAdmin;
    delete cleanDto.email;
    delete cleanDto.id;
    delete cleanDto.createdAt;

    // Filter out undefined fields so Drizzle doesn't complain about empty updates
    Object.keys(cleanDto).forEach((key) => {
      if (cleanDto[key] === undefined) {
        delete cleanDto[key];
      }
    });

    if (Object.keys(cleanDto).length === 0) {
      return this.findOne(id);
    }

    const [updated] = await this.db
      .update(user)
      .set(cleanDto)
      .where(eq(user.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const { password, ...safeUser } = updated;
    return safeUser;
  }

  async getAvatarUploadUrl(id: string) {
    const objectKey = `avatars/${id}.webp`;
    const uploadUrl = await this.r2Service.getPresignedUploadUrl(objectKey, 'image/webp');
    const publicUrl = `/api/uploads/${objectKey}`;

    await this.db
      .update(user)
      .set({ image: publicUrl })
      .where(eq(user.id, id));

    return {
      uploadUrl,
      publicUrl,
      r2ObjectKey: objectKey,
    };
  }
}
