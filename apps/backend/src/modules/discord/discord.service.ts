import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, isNull, and, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import { discordWebhooks } from '../../db/schema/discord-webhooks';
import { SaveDiscordWebhookDto } from './dto/save-discord-webhook.dto';

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);

  constructor(@Inject(DRIZZLE) private db: any) {}

  /**
   * Helper function to mask a Discord Webhook URL.
   * e.g. "https://discord.com/api/webhooks/123456/abcdef" -> "https://discord.com/api/webhooks/123456/***...masked"
   */
  maskWebhookUrl(url: string): string {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split('/').filter(Boolean);
      // Expected parts: ["api", "webhooks", "id", "token"]
      if (parts.length >= 4 && parts[0] === 'api' && parts[1] === 'webhooks') {
        const id = parts[2];
        return `${parsed.origin}/api/webhooks/${id}/***...masked`;
      }
      return `${parsed.origin}/api/webhooks/***...masked`;
    } catch {
      return 'https://discord.com/api/webhooks/***...masked';
    }
  }

  // --- APP-LEVEL WEBHOOK (NULL projectId) ---

  async getAppWebhook() {
    try {
      const [webhook] = await this.db
        .select()
        .from(discordWebhooks)
        .where(isNull(discordWebhooks.projectId))
        .limit(1);

      if (!webhook) {
        return { configured: false };
      }

      return {
        configured: true,
        id: webhook.id,
        webhookUrl: this.maskWebhookUrl(webhook.webhookUrl),
        events: webhook.events,
        createdAt: webhook.createdAt,
      };
    } catch (err: any) {
      this.logger.error(`Failed to fetch app webhook: ${err.message}`);
      return { configured: false };
    }
  }

  async saveAppWebhook(dto: SaveDiscordWebhookDto, userId: string) {
    try {
      const events = dto.events && dto.events.length > 0 ? dto.events : ['project_created'];

      const [existing] = await this.db
        .select()
        .from(discordWebhooks)
        .where(isNull(discordWebhooks.projectId))
        .limit(1);

      if (existing) {
        const [updated] = await this.db
          .update(discordWebhooks)
          .set({
            webhookUrl: dto.webhookUrl,
            events: sql`${JSON.stringify(events)}::jsonb`,
            createdBy: userId,
            createdAt: new Date(),
          })
          .where(eq(discordWebhooks.id, existing.id))
          .returning();

        return {
          configured: true,
          id: updated.id,
          webhookUrl: this.maskWebhookUrl(updated.webhookUrl),
          events: updated.events,
          createdAt: updated.createdAt,
        };
      } else {
        const [inserted] = await this.db
          .insert(discordWebhooks)
          .values({
            projectId: null,
            webhookUrl: dto.webhookUrl,
            events: sql`${JSON.stringify(events)}::jsonb`,
            createdBy: userId,
          })
          .returning();

        return {
          configured: true,
          id: inserted.id,
          webhookUrl: this.maskWebhookUrl(inserted.webhookUrl),
          events: inserted.events,
          createdAt: inserted.createdAt,
        };
      }
    } catch (err: any) {
      this.logger.error(`Gagal menyimpan app webhook: ${err.message}`, err.stack);
      throw new BadRequestException(`Gagal menyimpan Discord Webhook: ${err.message}`);
    }
  }

  async deleteAppWebhook() {
    await this.db
      .delete(discordWebhooks)
      .where(isNull(discordWebhooks.projectId));

    return { success: true, message: 'App-level Discord webhook configuration deleted' };
  }

  async testAppWebhook() {
    const [webhook] = await this.db
      .select()
      .from(discordWebhooks)
      .where(isNull(discordWebhooks.projectId))
      .limit(1);

    if (!webhook || !webhook.webhookUrl) {
      throw new NotFoundException('App-level Discord webhook belum dikonfigurasi');
    }

    return this.sendTestNotification(webhook.webhookUrl);
  }

  // --- PROJECT-LEVEL WEBHOOK ---

  async getProjectWebhook(projectId: string) {
    try {
      const [webhook] = await this.db
        .select()
        .from(discordWebhooks)
        .where(eq(discordWebhooks.projectId, projectId))
        .limit(1);

      if (!webhook) {
        return { configured: false };
      }

      return {
        configured: true,
        id: webhook.id,
        webhookUrl: this.maskWebhookUrl(webhook.webhookUrl),
        events: webhook.events,
        createdAt: webhook.createdAt,
      };
    } catch (err: any) {
      this.logger.error(`Failed to fetch project webhook: ${err.message}`);
      return { configured: false };
    }
  }

  async saveProjectWebhook(
    projectId: string,
    dto: SaveDiscordWebhookDto,
    userId: string,
  ) {
    try {
      const events = dto.events && dto.events.length > 0 ? dto.events : ['issue_created'];

      const [existing] = await this.db
        .select()
        .from(discordWebhooks)
        .where(eq(discordWebhooks.projectId, projectId))
        .limit(1);

      if (existing) {
        const [updated] = await this.db
          .update(discordWebhooks)
          .set({
            webhookUrl: dto.webhookUrl,
            events: sql`${JSON.stringify(events)}::jsonb`,
            createdBy: userId,
            createdAt: new Date(),
          })
          .where(eq(discordWebhooks.id, existing.id))
          .returning();

        return {
          configured: true,
          id: updated.id,
          webhookUrl: this.maskWebhookUrl(updated.webhookUrl),
          events: updated.events,
          createdAt: updated.createdAt,
        };
      } else {
        const [inserted] = await this.db
          .insert(discordWebhooks)
          .values({
            projectId,
            webhookUrl: dto.webhookUrl,
            events: sql`${JSON.stringify(events)}::jsonb`,
            createdBy: userId,
          })
          .returning();

        return {
          configured: true,
          id: inserted.id,
          webhookUrl: this.maskWebhookUrl(inserted.webhookUrl),
          events: inserted.events,
          createdAt: inserted.createdAt,
        };
      }
    } catch (err: any) {
      this.logger.error(`Gagal menyimpan project webhook: ${err.message}`, err.stack);
      throw new BadRequestException(`Gagal menyimpan Discord Webhook: ${err.message}`);
    }
  }

  async deleteProjectWebhook(projectId: string) {
    await this.db
      .delete(discordWebhooks)
      .where(eq(discordWebhooks.projectId, projectId));

    return { success: true, message: 'Project Discord webhook configuration deleted' };
  }

  async testProjectWebhook(projectId: string) {
    const [webhook] = await this.db
      .select()
      .from(discordWebhooks)
      .where(eq(discordWebhooks.projectId, projectId))
      .limit(1);

    if (!webhook || !webhook.webhookUrl) {
      throw new NotFoundException('Discord webhook proyek ini belum dikonfigurasi');
    }

    return this.sendTestNotification(webhook.webhookUrl);
  }

  // --- SEND TEST MESSAGE ---

  async sendTestNotification(targetUrl: string) {
    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [
            {
              title: '✅ Integration Test',
              description: 'TrackFlow berhasil terhubung ke channel ini',
              color: 0x4f46e5,
            },
          ],
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new BadRequestException(
          `Gagal mengirim pesan test ke Discord: Status ${res.status} ${errText}`,
        );
      }

      return {
        success: true,
        message: 'TrackFlow berhasil terhubung ke channel ini',
      };
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Gagal kirim pesan test Discord: ${err.message}`);
    }
  }

  // --- FIRE-AND-FORGET TRIGGERS ---

  async notifyDiscordProjectCreated(project: {
    id: string;
    key: string;
    name: string;
  }) {
    try {
      const [webhook] = await this.db
        .select()
        .from(discordWebhooks)
        .where(isNull(discordWebhooks.projectId))
        .limit(1);

      if (!webhook || !webhook.webhookUrl) return;

      const events = (webhook.events as string[]) || [];
      if (!events.includes('project_created')) return;

      await fetch(webhook.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [
            {
              title: `📁 Proyek Baru: ${project.name}`,
              description: `Kode: \`${project.key}\``,
              color: 0x4f46e5,
              url: `https://trackflow.internal/projects/${project.id}`,
            },
          ],
        }),
      });
    } catch (err: any) {
      this.logger.warn(`Gagal kirim notifikasi Discord: ${err.message}`);
      // JANGAN throw — kegagalan Discord tidak boleh membatalkan pembuatan proyek
    }
  }

  async notifyDiscordIssueCreated(
    issue: {
      id: string;
      number: number;
      title: string;
      description?: string | null;
    },
    project: { id: string; key: string; name: string },
  ) {
    try {
      const [webhook] = await this.db
        .select()
        .from(discordWebhooks)
        .where(eq(discordWebhooks.projectId, project.id))
        .limit(1);

      if (!webhook || !webhook.webhookUrl) return;

      const events = (webhook.events as string[]) || [];
      if (!events.includes('issue_created')) return;

      await fetch(webhook.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [
            {
              title: `📌 Issue Baru: [${project.key}-${issue.number}] ${issue.title}`,
              description: issue.description || 'Tidak ada deskripsi',
              color: 0x4f46e5,
              url: `https://trackflow.internal/projects/${project.id}/issues/${issue.id}`,
            },
          ],
        }),
      });
    } catch (err: any) {
      this.logger.warn(`Gagal kirim notifikasi Discord: ${err.message}`);
    }
  }

  async notifyDiscordStatusChanged(
    issue: {
      id: string;
      number: number;
      title: string;
      projectId: string;
      projectKey: string;
    },
    oldStatus: string,
    newStatus: string,
    actor: { id: string; name: string },
  ) {
    try {
      const [webhook] = await this.db
        .select()
        .from(discordWebhooks)
        .where(eq(discordWebhooks.projectId, issue.projectId))
        .limit(1);

      if (!webhook || !webhook.webhookUrl) return;

      const events = (webhook.events as string[]) || [];
      if (!events.includes('issue_status_changed')) return;

      await fetch(webhook.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [
            {
              title: `🔄 ${issue.projectKey}-${issue.number}: ${issue.title}`,
              description: `**${oldStatus}** → **${newStatus}**\nOleh: ${actor.name}`,
              color: 0x818cf8,
              url: `https://trackflow.internal/projects/${issue.projectId}/issues/${issue.id}`,
            },
          ],
        }),
      });
    } catch (err: any) {
      this.logger.warn(`Gagal kirim notifikasi status Discord: ${err.message}`);
    }
  }
}
