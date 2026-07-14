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

  async uploadAvatar(id: string, buffer: Buffer, mimeType: string) {
    const objectKey = `avatars/${id}.webp`;

    // 1. Upload to R2 (or local disk in mock mode) FIRST
    await this.r2Service.uploadBuffer(objectKey, buffer, mimeType);

    // 2. Determine the public URL for serving the image
    //    - Real R2: served via /uploads proxy (main.ts pipes from R2)
    //    - Mock mode: served as static from /uploads directory
    const publicUrl = `/api/uploads/${objectKey}`;

    // 3. Only update DB after upload succeeds
    await this.db
      .update(user)
      .set({ image: publicUrl })
      .where(eq(user.id, id));

    return { publicUrl };
  }

  async findAll() {
    const users = await this.db.select().from(user);
    return users.map(({ password, ...u }: any) => u);
  }
}
