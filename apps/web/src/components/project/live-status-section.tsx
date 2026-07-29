"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import {
  Loader2,
  Users,
  AlertCircle,
  Activity,
  CheckCircle2,
  Moon,
  PowerOff,
  Clock,
  Briefcase,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  getProjectLiveStatus,
  ProjectLiveStatusMember,
} from "@/lib/projects-service";

interface LiveStatusSectionProps {
  projectId: string;
}

export default function LiveStatusSection({ projectId }: LiveStatusSectionProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: liveStatusData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["project-live-status", projectId],
    queryFn: () => getProjectLiveStatus(projectId),
    enabled: !!projectId,
    refetchInterval: 30000, // Fallback refetch every 30 seconds
  });

  // Real-time Socket.io listener for status_changed event
  useEffect(() => {
    if (!projectId) return;

    const socket = io({
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      socket.emit("joinProject", projectId);
    });

    socket.on("user.status_changed", () => {
      void queryClient.invalidateQueries({
        queryKey: ["project-live-status", projectId],
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [projectId, queryClient]);

  if (isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>
          Gagal mengambil status live anggota: {(error as Error).message}
        </span>
      </div>
    );
  }

  const members: ProjectLiveStatusMember[] = liveStatusData?.members || [];

  const activeCount = members.filter((m) => m.status === "active").length;
  const idleCount = members.filter((m) => m.status === "idle").length;
  const offlineCount = members.filter((m) => m.status === "offline").length;

  const formatRelativeTime = (timestamp?: string | null) => {
    if (!timestamp) return "-";
    const date = new Date(timestamp);
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);

    if (diffMin < 1) return "Baru saja";
    if (diffMin < 60) return `${diffMin} menit yang lalu`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} jam yang lalu`;
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400">
            <Activity className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
              Live Status Anggota
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Status aktivitas real-time seluruh anggota tim dalam proyek ini
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 border border-border px-3 py-1.5 rounded-lg">
          <Users className="h-3.5 w-3.5" />
          <span>Total {members.length} Anggota Tim</span>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Pengguna Aktif
              </p>
              <p className="text-lg font-bold text-foreground">{activeCount}</p>
            </div>
          </div>
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Tracking
          </span>
        </div>

        <div className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:text-amber-400">
              <Moon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Pengguna Idle
              </p>
              <p className="text-lg font-bold text-foreground">{idleCount}</p>
            </div>
          </div>
          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            &gt; 5 Mnt Inaktif
          </span>
        </div>

        <div className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground border border-border">
              <PowerOff className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Pengguna Offline
              </p>
              <p className="text-lg font-bold text-foreground">{offlineCount}</p>
            </div>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded border border-border">
            Tidak Tracking
          </span>
        </div>
      </div>

      {/* Members Status Table */}
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[240px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Anggota Tim
              </TableHead>
              <TableHead className="w-[140px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Status Live
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Task Saat Ini (Tracking)
              </TableHead>
              <TableHead className="w-[160px] text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Terakhir Aktif
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-xs text-muted-foreground italic"
                >
                  Belum ada anggota tim dalam proyek ini.
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => {
                const isOnline = member.status !== "offline";

                return (
                  <TableRow key={member.userId} className="hover:bg-muted/30 transition-colors">
                    {/* User Info */}
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-7 w-7 border border-border">
                          <AvatarFallback className="text-[10px] font-semibold bg-muted text-muted-foreground">
                            {member.name ? member.name.substring(0, 2).toUpperCase() : "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-foreground leading-none">
                            {member.name}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Status Pill */}
                    <TableCell className="py-3">
                      {member.status === "active" ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400 dark:bg-emerald-500/20">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          <span>🟢 Aktif</span>
                        </div>
                      ) : member.status === "idle" ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:text-amber-400 dark:bg-amber-500/20">
                          <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                          <span>🟡 Idle</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted/60 text-muted-foreground border border-border">
                          <span className="h-2 w-2 rounded-full bg-muted-foreground/40"></span>
                          <span>⚪ Offline</span>
                        </div>
                      )}
                    </TableCell>

                    {/* Current Task */}
                    <TableCell className="py-3">
                      {!isOnline || member.currentTask === null ? (
                        <span className="text-xs text-muted-foreground italic">-</span>
                      ) : typeof member.currentTask === "object" ? (
                        <div className="inline-flex items-center gap-1.5 text-xs text-foreground bg-muted/50 border border-border px-2.5 py-1 rounded-md max-w-md truncate">
                          <span className="font-mono text-[11px] font-bold text-primary shrink-0">
                            {member.currentTask.issueKey}
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="truncate">{member.currentTask.title}</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 text-xs text-foreground bg-muted/50 border border-border px-2.5 py-1 rounded-md">
                          <Briefcase className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">Activity</span>
                        </div>
                      )}
                    </TableCell>

                    {/* Last Heartbeat */}
                    <TableCell className="py-3 text-right text-xs text-muted-foreground font-mono">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <Clock className="h-3 w-3 text-muted-foreground/60" />
                        <span>{formatRelativeTime(member.lastHeartbeatAt)}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
