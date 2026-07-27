"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Trophy,
  Loader2,
  AlertCircle,
  Info,
  Calendar,
  Filter,
  Users,
  Award,
  Medal,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
import { getActivityRanking, ActivityRankingItem } from "@/lib/reports-service";

export default function ActivityRankingPage() {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");

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
    data: rankingList = [],
    isLoading: isRankingLoading,
    error: rankingError,
  } = useQuery<ActivityRankingItem[]>({
    queryKey: ["activity-ranking", period, effectiveProjectId],
    queryFn: () => getActivityRanking(period, effectiveProjectId),
    enabled: isManagerOrAdmin,
  });

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
          Fitur Peringkat Aktivitas Time Book hanya dapat diakses oleh Manager proyek atau Administrator sistem.
        </p>
      </div>
    );
  }

  const formatHoursMinutes = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}j`;
    return `${hours}j ${mins}m`;
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full pb-16">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 shadow-2xs">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
              Peringkat Aktivitas Time Book
            </h1>
            <p className="text-xs text-muted-foreground">
              Analisis tingkat keaktifan dan durasi kerja terakumulasi per anggota tim
            </p>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Period Toggle */}
          <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5 text-xs">
            <button
              onClick={() => setPeriod("week")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                period === "week"
                  ? "bg-card text-foreground shadow-2xs border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              Minggu Ini
            </button>
            <button
              onClick={() => setPeriod("month")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                period === "month"
                  ? "bg-card text-foreground shadow-2xs border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              Bulan Ini
            </button>
          </div>

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

      {/* Usage Note Disclaimer Banner */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-xs text-blue-700 dark:text-blue-300 leading-relaxed shadow-2xs">
        <Info className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" />
        <div>
          <span className="font-bold">Panduan Penggunaan Manager:</span> Fitur peringkat ini dirancang secara khusus sebagai sarana identifikasi pola kerja, evaluasi beban kerja, dan pencegahan *bottleneck* tim — bukan sebagai alat penilaian kompetitif langsung atau hukuman. Jaga suasana kerja tetap positif dan kondusif untuk moral tim.
        </div>
      </div>

      {/* Error Banner */}
      {rankingError && (
        <div className="flex items-center gap-2 p-3.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Gagal memuat peringkat aktivitas: {(rankingError as Error).message}</span>
        </div>
      )}

      {/* Ranking Table */}
      {isRankingLoading ? (
        <div className="flex h-48 w-full items-center justify-center border border-border rounded-xl bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rankingList.length === 0 ? (
        <div className="p-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl bg-card">
          Tidak ada data aktivitas time book pada periode yang dipilih.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-2xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 hover:bg-transparent">
                <TableHead className="w-16 text-center font-semibold text-xs">
                  #
                </TableHead>
                <TableHead className="w-64 pl-4 font-semibold text-xs">
                  Anggota Tim
                </TableHead>
                <TableHead className="w-36 text-center font-semibold text-xs whitespace-nowrap">
                  Total Jam Kerja
                </TableHead>
                <TableHead className="text-center font-semibold text-xs whitespace-nowrap">
                  Breakdown Aktivitas (High / Med / Low / None)
                </TableHead>
                <TableHead className="w-48 text-right pr-6 font-semibold text-xs whitespace-nowrap">
                  Skor Aktivitas (0 - 3)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankingList.map((item, index) => {
                const rank = index + 1;
                const score = item.activityScore;
                const pct = Math.min(100, Math.max(0, Math.round((score / 3) * 100)));

                const initials = item.name
                  ? item.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)
                  : "?";

                // Score status style
                let scoreBadgeColor = "bg-rose-500/10 text-rose-600 border-rose-500/20";
                let progressColor = "bg-rose-500";
                if (score >= 2.25) {
                  scoreBadgeColor = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
                  progressColor = "bg-emerald-500";
                } else if (score >= 1.5) {
                  scoreBadgeColor = "bg-amber-500/10 text-amber-600 border-amber-500/20";
                  progressColor = "bg-amber-500";
                }

                return (
                  <TableRow key={item.userId} className="hover:bg-muted/30 transition-colors">
                    {/* Rank Number / Icon */}
                    <TableCell className="text-center py-3.5">
                      {rank === 1 ? (
                        <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 border border-amber-500/30 font-bold text-xs shadow-2xs">
                          <Trophy className="h-3.5 w-3.5 text-amber-500" />
                        </div>
                      ) : rank === 2 ? (
                        <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-300/30 text-slate-700 dark:text-slate-300 border border-slate-300/40 font-bold text-xs">
                          <Medal className="h-3.5 w-3.5 text-slate-400" />
                        </div>
                      ) : rank === 3 ? (
                        <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-700/20 text-amber-700 dark:text-amber-500 border border-amber-700/30 font-bold text-xs">
                          <Award className="h-3.5 w-3.5 text-amber-600" />
                        </div>
                      ) : (
                        <span className="font-mono text-xs font-semibold text-muted-foreground">
                          #{rank}
                        </span>
                      )}
                    </TableCell>

                    {/* User Info */}
                    <TableCell className="pl-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8 border border-border shrink-0">
                          {item.avatar ? (
                            <img
                              src={item.avatar}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <AvatarFallback className="text-[10.5px] font-bold">
                              {initials}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {item.name}
                          </span>
                          <span className="text-[10.5px] text-muted-foreground truncate font-mono">
                            @{item.username || "user"}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Total Time */}
                    <TableCell className="text-center py-3.5">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {formatHoursMinutes(item.totalMinutes)}
                      </span>
                      <span className="block text-[10px] text-muted-foreground mt-0.5">
                        {item.totalBlocks} blok waktu
                      </span>
                    </TableCell>

                    {/* Activity Breakdown */}
                    <TableCell className="py-3.5">
                      <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-semibold" title="Tinggi">
                          {item.high} High
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20 font-semibold" title="Sedang">
                          {item.medium} Med
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 font-semibold" title="Rendah">
                          {item.low} Low
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border font-semibold" title="None">
                          {item.none} None
                        </span>
                      </div>
                    </TableCell>

                    {/* Activity Score & Visual Progress Bar */}
                    <TableCell className="text-right pr-6 py-3.5">
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${scoreBadgeColor}`}>
                            {score.toFixed(2)} / 3.00
                          </span>
                        </div>
                        <div className="h-1.5 w-32 rounded-full bg-muted/60 overflow-hidden border border-border/30">
                          <div
                            className={`h-full ${progressColor} rounded-full transition-all duration-500`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
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
