"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Webhook,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit2,
  Send,
  Link2,
} from "lucide-react";
import { DiscordWebhookConfig } from "@/lib/discord-service";
import { useConfirm } from "@/components/ui/confirm-dialog";

export interface EventOption {
  id: string;
  label: string;
}

interface DiscordWebhookCardProps {
  title?: string;
  description?: string;
  eventOptions: EventOption[];
  onFetch: () => Promise<DiscordWebhookConfig>;
  onSave: (webhookUrl: string, events: string[]) => Promise<DiscordWebhookConfig>;
  onDelete: () => Promise<void>;
  onTest: () => Promise<{ success: boolean; message: string }>;
}

export default function DiscordWebhookCard({
  title = "Integrasi Discord Webhook",
  description = "Kirimkan notifikasi otomatis ke channel Discord pilihan Anda saat event terjadi.",
  eventOptions,
  onFetch,
  onSave,
  onDelete,
  onTest,
}: DiscordWebhookCardProps) {
  const confirm = useConfirm();
  const [config, setConfig] = useState<DiscordWebhookConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Form State
  const [isEditing, setIsEditing] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(
    eventOptions.map((e) => e.id)
  );

  // Action states
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await onFetch();
      setConfig(data);
      if (data.configured && data.events) {
        setSelectedEvents(data.events);
      } else {
        setSelectedEvents(eventOptions.map((e) => e.id));
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Gagal memuat konfigurasi Discord Webhook.");
    } finally {
      setLoading(false);
    }
  }, [onFetch, eventOptions]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        void loadData();
      }
    });
    return () => {
      active = false;
    };
  }, [loadData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // If editing existing config and webhookUrl input is empty, keep old URL by requiring a non-empty string only if no config existed or if inputting new URL
    if (!webhookUrl.trim() && !config?.configured) {
      setError("Webhook URL Discord wajib diisi.");
      return;
    }

    // In edit mode of configured webhook, if user didn't type a new URL, we require a URL or require input
    const urlToSave = webhookUrl.trim();
    if (!urlToSave) {
      setError("Masukkan Webhook URL baru.");
      return;
    }

    if (selectedEvents.length === 0) {
      setError("Pilih setidaknya 1 event notifikasi.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMsg("");

    try {
      const updated = await onSave(urlToSave, selectedEvents);
      setConfig(updated);
      setWebhookUrl(""); // Security: Clear raw URL from memory & input field
      setIsEditing(false);
      setSuccessMsg("Konfigurasi Discord Webhook berhasil disimpan.");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Gagal menyimpan Discord Webhook.");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await onTest();
      setSuccessMsg(res.message || "Pesan pengujian berhasil dikirim ke channel Discord!");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Gagal melakukan test koneksi Discord Webhook.");
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Hapus Integrasi Discord",
      description:
        "Apakah Anda yakin ingin menghapus konfigurasi Discord Webhook ini? Notifikasi otomatis tidak akan dikirimkan lagi.",
      confirmLabel: "Hapus Webhook",
      variant: "destructive",
    });
    if (!ok) return;

    setDeleting(true);
    setError("");
    setSuccessMsg("");

    try {
      await onDelete();
      setConfig({ configured: false });
      setWebhookUrl("");
      setSelectedEvents(eventOptions.map((e) => e.id));
      setIsEditing(false);
      setSuccessMsg("Konfigurasi Discord Webhook berhasil dihapus.");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Gagal menghapus Discord Webhook.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-border bg-card p-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isConfigured = config?.configured && !isEditing;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-500">
            <Webhook className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-[13.5px] font-semibold text-foreground flex items-center gap-2">
              {title}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
              {description}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        {config?.configured && !isEditing && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-500">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Terhubung ✅</span>
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-500">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* STATE 1: Configured (View Mode) */}
      {isConfigured ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5" />
              Webhook URL (Tersimpan & Terenkripsi)
            </Label>
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-[12px]">
              <code className="font-mono text-[11.5px] text-foreground">
                {config.webhookUrl}
              </code>
              <span className="text-[10px] text-muted-foreground italic">
                Secret Masked
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground">
              Event Aktif
            </Label>
            <div className="flex flex-col gap-2">
              {eventOptions.map((opt) => {
                const isActive = config.events?.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    className="flex items-center gap-2 text-[12px] text-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={isActive ?? false}
                      readOnly
                      disabled
                      className="h-3.5 w-3.5 rounded border-input text-primary"
                    />
                    <span
                      className={
                        isActive
                          ? "font-medium text-foreground"
                          : "text-muted-foreground line-through"
                      }
                    >
                      {opt.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-border/60 pt-3 mt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-[12px] font-medium gap-1.5 border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-500"
              onClick={handleTest}
              disabled={testing || deleting}
            >
              {testing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span>Test Koneksi</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-[12px] font-medium gap-1.5"
                onClick={() => {
                  setError("");
                  setSuccessMsg("");
                  setWebhookUrl("");
                  setSelectedEvents(config.events || eventOptions.map((e) => e.id));
                  setIsEditing(true);
                }}
                disabled={testing || deleting}
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span>Ganti</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-[12px] font-medium gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleDelete}
                disabled={testing || deleting}
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                <span>Hapus</span>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* STATE 2: Edit / New Mode */
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="discord-webhook-url" className="text-[11.5px] font-semibold text-foreground">
              Discord Webhook URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="discord-webhook-url"
              type="url"
              required
              placeholder="https://discord.com/api/webhooks/1234567890/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="h-9 text-[12.5px] font-mono"
              disabled={saving}
            />
            <span className="text-[10px] text-muted-foreground">
              Salin Webhook URL dari Pengaturan Channel Discord → Integrasi → Webhook.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[11.5px] font-semibold text-foreground">
              Event Notifikasi
            </Label>
            <div className="flex flex-col gap-2">
              {eventOptions.map((opt) => {
                const checked = selectedEvents.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    className="flex items-center gap-2 text-[12px] text-foreground"
                  >
                    <input
                      type="checkbox"
                      id={`event-${opt.id}`}
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEvents((prev) => [...prev, opt.id]);
                        } else {
                          setSelectedEvents((prev) =>
                            prev.filter((id) => id !== opt.id)
                          );
                        }
                      }}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
                      disabled={saving}
                    />
                    <label
                      htmlFor={`event-${opt.id}`}
                      className="cursor-pointer select-none"
                    >
                      {opt.label}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3 mt-1">
            {config?.configured && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-[12px]"
                onClick={() => {
                  setIsEditing(false);
                  setWebhookUrl("");
                  setError("");
                }}
                disabled={saving}
              >
                Batal
              </Button>
            )}

            <Button
              type="submit"
              size="sm"
              className="h-8 text-[12px] font-semibold px-4"
              disabled={saving || !webhookUrl.trim() || selectedEvents.length === 0}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan Webhook"
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
