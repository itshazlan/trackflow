import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import { appSettings } from '../../db/schema/settings';
import { user } from '../../db/schema/auth';
import { UpdateSettingsDto } from './dto/admin-settings.dto';
import { AdminCreateUserDto, AdminUpdateUserDto, UpdateEmploymentDto } from './dto/admin-user.dto';
import { auth } from '../auth/better-auth.config';

@Injectable()
export class AdminService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  // --- App Settings ---
  async getSettings() {
    const [settings] = await this.db.select().from(appSettings).limit(1);
    if (!settings) {
      // Return default fallbacks if somehow settings aren't seeded yet
      return { companyName: 'TrackFlow', screenshotRetentionDays: 365 };
    }
    return settings;
  }

  async updateSettings(dto: UpdateSettingsDto) {
    const [settings] = await this.db.select().from(appSettings).limit(1);
    if (!settings) {
      const [inserted] = await this.db.insert(appSettings).values(dto).returning();
      return inserted;
    }

    const [updated] = await this.db
      .update(appSettings)
      .set(dto)
      .where(eq(appSettings.id, settings.id))
      .returning();

    return updated;
  }

  // --- User Management ---
  async listUsers() {
    const users = await this.db.select().from(user);
    return users.map(({ password, ...u }: any) => u);
  }

  async createUser(dto: AdminCreateUserDto) {
    try {
      // Leverage Better Auth email password programmatic API for standard hashing and validation
      const result = await auth.api.signUpEmail({
        body: {
          email: dto.email,
          password: dto.password || 'TemporaryPassword123!',
          name: dto.name,
          username: dto.username,
          position: dto.position,
          department: dto.department,
          employeeId: dto.employeeId,
          joinDate: dto.joinDate ? new Date(dto.joinDate) : undefined,
          employmentStatus: dto.employmentStatus || 'active',
          isAdmin: dto.isAdmin || false,
        },
      });

      if (!result || !result.user) {
        throw new BadRequestException('User creation failed via Auth provider');
      }

      return result.user;
    } catch (err: any) {
      console.error('[AdminService.createUser error]:', err);
      throw new BadRequestException(err.message || 'Failed to create user');
    }
  }

  async updateUser(id: string, dto: AdminUpdateUserDto) {
    const payload: any = { ...dto };
    if (dto.joinDate) {
      payload.joinDate = new Date(dto.joinDate);
    }

    const [updated] = await this.db
      .update(user)
      .set(payload)
      .where(eq(user.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const { password, ...safeUser } = updated;
    return safeUser;
  }

  async updateEmployment(id: string, dto: UpdateEmploymentDto) {
    const payload: any = { ...dto };
    if (dto.joinDate) {
      payload.joinDate = new Date(dto.joinDate);
    }

    const [updated] = await this.db
      .update(user)
      .set(payload)
      .where(eq(user.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const { password, ...safeUser } = updated;
    return safeUser;
  }
}
