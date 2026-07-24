export interface DiscordWebhookConfig {
  configured: boolean;
  id?: string;
  webhookUrl?: string; // Masked URL (e.g. https://discord.com/api/webhooks/12345/***...masked)
  events?: string[];
  createdAt?: string;
}

// App-level Discord Webhook
export async function getAppDiscordWebhook(): Promise<DiscordWebhookConfig> {
  const res = await fetch("/api/admin/integrations/discord", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error("Gagal mengambil konfigurasi Discord Webhook aplikasi");
  }
  return res.json();
}

export async function saveAppDiscordWebhook(
  webhookUrl: string,
  events: string[] = ["project_created"]
): Promise<DiscordWebhookConfig> {
  const res = await fetch("/api/admin/integrations/discord", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ webhookUrl, events }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || "Gagal menyimpan Discord Webhook aplikasi");
  }
  return res.json();
}

export async function deleteAppDiscordWebhook(): Promise<void> {
  const res = await fetch("/api/admin/integrations/discord", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || "Gagal menghapus Discord Webhook aplikasi");
  }
}

export async function testAppDiscordWebhook(): Promise<{ success: boolean; message: string }> {
  const res = await fetch("/api/admin/integrations/discord/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || "Gagal melakukan test koneksi Discord Webhook");
  }
  return res.json();
}

// Project-level Discord Webhook
export async function getProjectDiscordWebhook(projectId: string): Promise<DiscordWebhookConfig> {
  const res = await fetch(`/api/projects/${projectId}/integrations/discord`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || "Gagal mengambil konfigurasi Discord Webhook proyek");
  }
  return res.json();
}

export async function saveProjectDiscordWebhook(
  projectId: string,
  webhookUrl: string,
  events: string[] = ["issue_created"]
): Promise<DiscordWebhookConfig> {
  const res = await fetch(`/api/projects/${projectId}/integrations/discord`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ webhookUrl, events }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || "Gagal menyimpan Discord Webhook proyek");
  }
  return res.json();
}

export async function deleteProjectDiscordWebhook(projectId: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/integrations/discord`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || "Gagal menghapus Discord Webhook proyek");
  }
}

export async function testProjectDiscordWebhook(
  projectId: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/projects/${projectId}/integrations/discord/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || "Gagal melakukan test koneksi Discord Webhook");
  }
  return res.json();
}
