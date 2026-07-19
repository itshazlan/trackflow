"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Loader2 } from "lucide-react";
import { io } from "socket.io-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/lib/notifications-service";
import { NotificationDto } from "@trackflow/shared-types";

interface NotificationBellProps {
  userId: string;
}

const playNotificationSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioContext = new AudioContextClass();

    const playTone = (freq: number, start: number, duration: number, volume: number) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.00001, start + duration);

      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.start(start);
      osc.stop(start + duration);
    };

    const now = audioContext.currentTime;
    // Pleasant dual-tone chime
    playTone(523.25, now, 0.25, 0.06); // C5
    playTone(659.25, now + 0.07, 0.3, 0.06); // E5
  } catch (err) {
    console.error("Gagal memutar suara notifikasi:", err);
  }
};

export default function NotificationBell({ userId }: NotificationBellProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  // 1. Fetch notifications
  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(false, 1, 50),
    enabled: !!userId,
  });

  const notifications = notificationsData?.data || [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // 2. Socket.io integration
  useEffect(() => {
    if (!userId) return;

    const socketUrl =
      typeof window !== "undefined" && window.location.hostname === "localhost"
        ? "http://localhost:3000"
        : "";

    const socket = io(socketUrl, {
      query: { userId },
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      console.log("[Socket.io] Notifications connected");
    });

    socket.on("notification.created", (newNotification: NotificationDto) => {
      console.log("[Socket.io] Realtime Notification:", newNotification);
      playNotificationSound();
      // Invalidate query to fetch new notifications list
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });

    return () => {
      socket.disconnect();
    };
  }, [userId, queryClient]);

  // 3. Mark single as read mutation
  const markReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // 4. Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const handleNotificationClick = async (n: NotificationDto) => {
    // 1. Mark as read if not already read
    if (!n.isRead) {
      await markReadMutation.mutateAsync(n.id);
    }
    setIsOpen(false);

    // 2. Navigate based on entity type
    if (n.entityType === "project") {
      router.push(`/projects/${n.entityId}`);
    } else if (n.entityType === "issue") {
      try {
        // Fetch issue to get project ID
        const res = await fetch(`/api/issues/${n.entityId}`);
        if (res.ok) {
          const issue = await res.json();
          router.push(`/projects/${issue.projectId}/issues/${issue.id}`);
        } else {
          router.push("/projects");
        }
      } catch (err) {
        console.error("Gagal mendapatkan detail tiket untuk navigasi:", err);
        router.push("/projects");
      }
    } else if (n.entityType === "timesheet") {
      router.push("/timesheets");
    } else if (n.entityType === "time_block") {
      router.push("/projects");
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger
        render={
          <button className="relative flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent text-muted-foreground hover:text-foreground outline-none cursor-pointer" />
        }
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 shadow-lg border border-border bg-card">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-3.5 py-2 shrink-0">
          <span className="text-[12px] font-semibold text-foreground">Notifikasi</span>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="flex items-center text-[10px] font-medium text-primary hover:underline gap-1 disabled:opacity-50 cursor-pointer"
            >
              <Check className="h-3 w-3" />
              Tandai semua dibaca
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-72 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center text-[11px] text-muted-foreground">
              Tidak ada notifikasi
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  void handleNotificationClick(n);
                }}
                className={`flex flex-col gap-0.5 border-b border-border/50 px-3.5 py-2.5 cursor-pointer transition-colors text-left ${
                  n.isRead
                    ? "bg-card hover:bg-accent/40"
                    : "bg-accent/10 hover:bg-accent/25 font-medium border-l-2 border-l-primary"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-[12px] ${n.isRead ? "text-foreground/90 font-medium" : "text-foreground font-semibold"}`}>
                    {n.title}
                  </span>
                  {!n.isRead && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {n.body}
                </p>
                <span className="text-[9px] text-muted-foreground/60 mt-1">
                  {new Date(n.createdAt).toLocaleDateString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
