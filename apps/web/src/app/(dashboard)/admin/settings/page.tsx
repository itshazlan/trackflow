"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getAdminSettings, updateAdminSettings, AppSettings } from "@/lib/admin-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Settings,
  AlertCircle,
  CheckCircle2,
  Building,
  CalendarDays,
} from "lucide-react";

import DiscordWebhookCard from "@/components/discord-webhook-card";
import {
  getAppDiscordWebhook,
  saveAppDiscordWebhook,
  deleteAppDiscordWebhook,
  testAppDiscordWebhook,
} from "@/lib/discord-service";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [retentionDays, setRetentionDays] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getAdminSettings();
      setSettings(data);
      setCompanyName(data.companyName);
      setRetentionDays(String(data.screenshotRetentionDays));
    } catch (err) {
      console.error(err);
      setError("Gagal memuat pengaturan aplikasi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        void loadSettings();
      }
    });
    return () => {
      active = false;
    };
  }, [loadSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !retentionDays.trim()) return;

    const days = parseInt(retentionDays, 10);
    if (isNaN(days) || days < 1) {
      setError("Masa simpan screenshot harus minimal 1 hari.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const updated = await updateAdminSettings(companyName.trim(), days);
      setSettings(updated);
      setSuccess("Pengaturan aplikasi berhasil disimpan.");
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Gagal memperbarui pengaturan.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Pengaturan Sistem (Admin)
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Kelola parameter sistem global dan kebijakan penyimpanan data perusahaan.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-[12px] text-green-500">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {settings && (
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col gap-5">
          {/* Company Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="company-name" className="text-[11.5px] font-semibold text-foreground flex items-center gap-1.5">
              <Building className="h-4 w-4 text-muted-foreground" />
              Nama Perusahaan (Company Name)
            </Label>
            <Input
              id="company-name"
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Masukkan nama perusahaan..."
              className="h-9 text-[12.5px]"
              disabled={saving}
            />
            <span className="text-[10px] text-muted-foreground leading-normal">
              Nama ini akan ditampilkan pada kop laporan PDF resmi dan identitas aplikasi.
            </span>
          </div>

          {/* Screenshot Retention Days */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="retention-days" className="text-[11.5px] font-semibold text-foreground flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              Masa Simpan Screenshot (Hari)
            </Label>
            <Input
              id="retention-days"
              type="number"
              min="1"
              required
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
              placeholder="Contoh: 30"
              className="h-9 text-[12.5px]"
              disabled={saving}
            />
            <span className="text-[10px] text-muted-foreground leading-normal">
              Batas waktu (hari) penyimpanan berkas screenshot di Cloudflare R2 sebelum dihapus oleh sistem otomatis.
            </span>
          </div>

          <div className="border-t border-border pt-4 mt-1 flex justify-end">
            <Button type="submit" className="h-9 text-[12.5px] font-semibold px-4" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan Pengaturan"
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Section Integrasi (App-Level Discord Webhook) */}
      <div className="flex flex-col gap-3 pt-2">
        <h2 className="text-sm font-bold text-foreground tracking-tight">Integrasi Sistem</h2>
        <DiscordWebhookCard
          title="Integrasi Discord (App-Level)"
          description="Kirim notifikasi otomatis ke channel Discord saat proyek baru dibuat di aplikasi."
          eventOptions={[
            { id: "project_created", label: "Notifikasi saat Proyek Baru Dibuat" },
          ]}
          onFetch={getAppDiscordWebhook}
          onSave={saveAppDiscordWebhook}
          onDelete={deleteAppDiscordWebhook}
          onTest={testAppDiscordWebhook}
        />
      </div>
    </div>
  );
}
