"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enablePushNotifications } from "@/lib/push-notifications";

const DISMISS_KEY = "trackflow_push_prompt_dismissed_at";
const COOLDOWN_DAYS = 7;

export function PushNotificationBanner() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (shouldShowBanner()) {
        setVisible(true);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  function shouldShowBanner(): boolean {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      return false;
    }

    if (Notification.permission !== "default") {
      return false;
    }

    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (!dismissedAt) return true;

    const daysSinceDismiss =
      (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
    return daysSinceDismiss >= COOLDOWN_DAYS;
  }

  async function handleActivate() {
    try {
      setLoading(true);
      await enablePushNotifications();
    } catch (err) {
      console.error("Gagal mengaktifkan notifikasi push dari banner:", err);
    } finally {
      setLoading(false);
      setVisible(false);
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-border bg-card p-4 shadow-lg animate-in slide-in-from-bottom-4 transition-all">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0 mt-0.5">
          <Bell className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">
              Aktifkan notifikasi TrackFlow?
            </p>
            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
            Dapatkan info instan saat ada mention, assignment, atau approval — meski browser sedang tertutup.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleDismiss}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
            >
              Nanti Saja
            </button>
            <Button
              onClick={handleActivate}
              disabled={loading}
              className="ml-auto h-7 px-3 text-[11px] font-medium cursor-pointer"
            >
              {loading ? "Memproses..." : "Aktifkan"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
