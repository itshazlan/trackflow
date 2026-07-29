"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Loader2,
  AlertCircle,
  Info,
  Filter,
  Users,
  Wifi,
  Clock,
  Briefcase,
  CheckCircle2,
  Moon,
  PowerOff,
} from "lucide-react";
import { io } from "socket.io-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { getSession, UserSession } from "@/lib/auth-service";
import { getProjects, Project } from "@/lib/projects-service";
import { getLiveStatus, UserLiveStatusItem } from "@/lib/reports-service";

export default function ActivityRankingPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: session, isLoading: isSessionLoading } = useQuery<UserSession | null>({
    queryKey: ["session"],
    queryFn: getSession,
  });

  const { data: projects = [], isLoading: isProjectsLoading } = useQuery<Project[]>({
    queryKey: ["projects", session?.user?.id],
    queryFn: getProjects,
    enabled: !!session?.user?.id,
  });

  const isAdmin = !!session?.user?.isAdmin;
  const managedProjects = projects.filter(
    (p: any) => isAdmin || p.role === "manager"
  );
  const isManagerOrAdmin = isAdmin || managedProjects.length > 0;

  const effectiveProjectId =
    selectedProjectId === "all" ? undefined : selectedProjectId;

  const {
    data: liveStatusList = [],
    isLoading: isLiveStatusLoading,
    error: liveStatusError,
  } = useQuery<UserLiveStatusItem[]>({
    queryKey: ["live-status", effectiveProjectId],
    queryFn: () => getLiveStatus(effectiveProjectId),
    enabled: isManagerOrAdmin,
    refetchInterval: 30000, // Fallback refetch every 30 seconds
  });

  // Socket.io Realtime Listener for status_changed
  useEffect(() => {
    if (!session?.user?.id || !isManagerOrAdmin) return;

    const socket = io({
      query: { userId: session.user.id },
      transports: ["websocket", "polling"],
    });

    socket.on("user.status_changed", () => {
      void queryClient.invalidateQueries({
        queryKey: ["live-status", effectiveProjectId],
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [session?.user?.id, isManagerOrAdmin, effectiveProjectId, queryClient]);

  if (isSessionLoading || isProjectsLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isManagerOrAdmin) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-foreground">Akses Ditolak</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Fitur Status Live (Aktif & Idle User) hanya dapat diakses oleh Manager proyek atau Administrator sistem.
        </p>
      </div>
    );
  }

  // Calculate live counts
  const activeCount = liveStatusList.filter((u) => u.status === "active").length;
  const idleCount = liveStatusList.filter((u) => u.status === "idle").length;
  const offlineCount = liveStatusList.filter((u) => u.status === "offline").length;

  const formatLastHeartbeat = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 10) return "Baru saja";
    if (diffSec < 60) return `${diffSec} dtk yang lalu`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} mnt yang lalu`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} jam yang lalu`;
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full pb-16">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-2xs">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
              Status Live: Aktif & Idle User
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Wifi className="h-3 w-3 animate-pulse text-emerald-500" />
                Real-time
              </span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Daftar real-time status aktivitas pengguna TrackFlow Desktop
            </p>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Project Filter */}
          <div className="flex items-center gap-1.5 border border-border bg-card px-2.5 py-1.5 rounded-lg text-xs">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-transparent text-foreground font-medium outline-none cursor-pointer pr-1"
            >
              <option value="all">
                {isAdmin ? "Semua Proyek (Lintas Proyek)" : "Semua Proyek Saya"}
              </option>
              {managedProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Live Stats Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Active Card */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">User Aktif</p>
              <p className="text-lg font-bold text-foreground font-mono">{activeCount}</p>
            </div>
          </div>
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
        </div>

        {/* Idle Card */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Moon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">User Idle (&gt; 5 mnt)</p>
              <p className="text-lg font-bold text-foreground font-mono">{idleCount}</p>
            </div>
          </div>
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
        </div>

        {/* Offline Card */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground border border-border">
              <PowerOff className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">User Offline</p>
              <p className="text-lg font-bold text-foreground font-mono">{offlineCount}</p>
            </div>
          </div>
          <span className="h-2.5 w-2.5 rounded-full bg-slate-400"></span>
        </div>
      </div>

      {/* Usage Note Banner */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-xs text-blue-700 dark:text-blue-300 leading-relaxed shadow-2xs">
        <Info className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" />
        <div>
          <span className="font-bold">Mekanisme Live Status:</span> Desktop client mengirimkan sinyal *heartbeat* ringan tiap ~60 detik via Socket.io. Jika tidak ada aktivitas keyboard/mouse selama 5 menit, desktop client secara otomatis memperbarui status menjadi <span className="font-semibold underline">Idle</span>.
        </div>
      </div>

      {/* Error Banner */}
      {liveStatusError && (
        <div className="flex items-center gap-2 p-3.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Gagal memuat status live user: {(liveStatusError as Error).message}</span>
        </div>
      )}

      {/* Live Status Table */}
      {isLiveStatusLoading ? (
        <div className="flex h-48 w-full items-center justify-center border border-border rounded-xl bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : liveStatusList.length === 0 ? (
        <div className="p-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl bg-card">
          Tidak ada pengguna yang terdaftar pada proyek yang dipilih.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-2xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 hover:bg-transparent">
                <TableHead className="w-72 pl-4 font-semibold text-xs">
                  Anggota Tim
                </TableHead>
                <TableHead className="w-36 text-center font-semibold text-xs whitespace-nowrap">
                  Status Live
                </TableHead>
                <TableHead className="font-semibold text-xs whitespace-nowrap">
                  Proyek &amp; Task Aktif
                </TableHead>
                <TableHead className="w-48 text-right pr-6 font-semibold text-xs whitespace-nowrap">
                  Heartbeat Terakhir
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {liveStatusList.map((item) => {
                const initials = item.name
                  ? item.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)
                  : "?";

                return (
                  <TableRow key={item.userId} className="hover:bg-muted/30 transition-colors">
                    {/* User Info */}
                    <TableCell className="pl-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-9 w-9 border border-border shrink-0">
                            {item.avatar ? (
                              <img
                                src={item.avatar}
                                alt={item.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <AvatarFallback className="text-[11px] font-bold">
                                {initials}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <span
                            className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card ${
                              item.status === "active"
                                ? "bg-emerald-500"
                                : item.status === "idle"
                                ? "bg-amber-500"
                                : "bg-slate-400"
                            }`}
                          />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {item.name}
                          </span>
                          <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground truncate">
                            <span className="font-mono">@{item.username || "user"}</span>
                            {item.position && (
                              <>
                                <span>•</span>
                                <span>{item.position}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Live Status Pill */}
                    <TableCell className="text-center py-3.5">
                      {item.status === "active" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Aktif
                        </span>
                      ) : item.status === "idle" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          Idle
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          Offline
                        </span>
                      )}
                    </TableCell>

                    {/* Active Project & Issue Task */}
                    <TableCell className="py-3.5">
                      {item.status !== "offline" && (item.projectName || item.issueTitle) ? (
                        <div className="flex flex-col gap-1 min-w-0">
                          {item.projectName && (
                            <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                              <Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate">{item.projectName}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            {item.issueKey && (
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted border border-border">
                                {item.issueKey}
                              </span>
                            )}
                            <span className="truncate">
                              {item.issueTitle ? item.issueTitle : "Tugas Aktivitas Umum (Non-Issue)"}
                            </span>
                          </div>
                        </div>
                      ) : item.status !== "offline" ? (
                        <span className="text-xs text-muted-foreground italic">
                          Aktivitas Umum (Tanpa Spesifikasi Task)
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground font-mono">-</span>
                      )}
                    </TableCell>

                    {/* Last Heartbeat */}
                    <TableCell className="text-right pr-6 py-3.5">
                      <div className="flex items-center justify-end gap-1.5 text-xs font-mono text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span>{formatLastHeartbeat(item.lastHeartbeatAt)}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
