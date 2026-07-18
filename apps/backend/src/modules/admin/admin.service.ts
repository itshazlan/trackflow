import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, or, count } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import { appSettings } from '../../db/schema/settings';
import { user, session, account } from '../../db/schema/auth';
import { issues, issueComments } from '../../db/schema/issues';
import { timeBlocks } from '../../db/schema/time-tracking';
import { UpdateSettingsDto } from './dto/admin-settings.dto';
import {
  AdminCreateUserDto,
  AdminUpdateUserDto,
  UpdateEmploymentDto,
} from './dto/admin-user.dto';
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
      const [inserted] = await this.db
        .insert(appSettings)
        .values(dto)
        .returning();
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

  async deactivate(userId: string) {
    const [updatedUser] = await this.db
      .update(user)
      .set({ employmentStatus: 'inactive' })
      .where(eq(user.id, userId))
      .returning();

    if (!updatedUser) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Invalidate all active Better Auth sessions (web & desktop)
    await this.db.delete(session).where(eq(session.userId, userId));

    const { password, ...safeUser } = updatedUser;
    return safeUser;
  }

  async hardDelete(userId: string, force: boolean) {
    if (!force) {
      throw new BadRequestException('Gunakan deactivate() untuk penghapusan standar');
    }

    const [issueCount] = await this.db
      .select({ count: count() })
      .from(issues)
      .where(or(eq(issues.assigneeId, userId), eq(issues.createdBy, userId)));

    const [timeBlockCount] = await this.db
      .select({ count: count() })
      .from(timeBlocks)
      .where(eq(timeBlocks.userId, userId));

    const [commentCount] = await this.db
      .select({ count: count() })
      .from(issueComments)
      .where(eq(issueComments.authorId, userId));

    const totalHistory = (issueCount?.count || 0) + (timeBlockCount?.count || 0) + (commentCount?.count || 0);

    if (totalHistory > 0) {
      throw new BadRequestException(
        `User ini punya ${totalHistory} riwayat data terkait — nonaktifkan saja, jangan hapus permanen`,
      );
    }

    await this.db.transaction(async (tx: any) => {
      await tx.delete(session).where(eq(session.userId, userId));
      await tx.delete(account).where(eq(account.userId, userId));

      const [deleted] = await tx
        .delete(user)
        .where(eq(user.id, userId))
        .returning();

      if (!deleted) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }
    });

    return { success: true, message: 'User permanently deleted' };
  }
}
