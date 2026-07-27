"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Clock,
  AlertCircle,
  Activity,
  ArrowRight,
  ListTodo,
  FolderKanban,
  FileText,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { getDashboardSummary, DashboardSummary } from "@/lib/dashboard-service";
import { getSession, UserSession } from "@/lib/auth-service";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);

  useEffect(() => {
    getSession().then((s) => setSession(s));
  }, []);

  const { data, isLoading, error } = useQuery<DashboardSummary>({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
    staleTime: 1000 * 15,
    refetchOnMount: "always",
  });

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-100px)] w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const todayMinutes = data?.todayMinutes ?? 0;
  const hours = Math.floor(todayMinutes / 60);
  const minutes = todayMinutes % 60;
  const formattedWorkTime = `${hours}j ${minutes}m`;

  const overdueCount = data?.overdueCount ?? 0;
  const isTracking = !!data?.activeTimerStatus?.isTracking;

  return (
    <div className="flex flex-col h-full w-full max-w-[1200px] mx-auto p-6 gap-8">
      {/* Header Greeting */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Ringkasan Hari Ini
        </h1>
        <p className="text-xs text-muted-foreground">
          Selamat datang kembali,{" "}
          <span className="font-semibold text-foreground">
            {session?.user?.name || "User"}
          </span>
          ! Berikut ringkasan aktivitas dan tugas Anda hari ini.
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
          Gagal memuat ringkasan dashboard: {(error as Error).message}
        </div>
      )}

      {/* 3 Main Summary Widget Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Jam Kerja Hari Ini */}
        <div className="flex flex-col justify-between p-5 rounded-xl border border-border bg-card shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Jam Kerja Hari Ini
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Clock className="h-4 w-4" />
            </div>
          </div>

          <div className="my-3">
            <span className="text-3xl font-extrabold tracking-tight text-foreground">
              {formattedWorkTime}
            </span>
          </div>

          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            Total waktu tercatat hari ini
          </p>
        </div>

        {/* Card 2: Tugas Overdue */}
        <div
          onClick={() => router.push("/my-tasks?filter=overdue")}
          className="flex flex-col justify-between p-5 rounded-xl border border-border bg-card shadow-2xs hover:border-destructive/40 hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Tugas Overdue
            </span>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                overdueCount > 0
                  ? "bg-destructive/10 text-destructive border-destructive/20"
                  : "bg-muted text-muted-foreground border-border"
              }`}
            >
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>

          <div className="my-3 flex items-baseline gap-2">
            <span
              className={`text-3xl font-extrabold tracking-tight ${
                overdueCount > 0 ? "text-destructive" : "text-foreground"
              }`}
            >
              {overdueCount}
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              tiket
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">
              Melewati tenggat waktu
            </span>
            <span className="text-primary font-semibold group-hover:underline flex items-center gap-0.5">
              Lihat di Tugas Saya <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>

        {/* Card 3: Status Tracking */}
        <div className="flex flex-col justify-between p-5 rounded-xl border border-border bg-card shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Status Tracking
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500 border border-sky-500/20">
              <Activity className="h-4 w-4" />
            </div>
          </div>

          <div className="my-3 flex items-center gap-2.5">
            {isTracking ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Sedang Bekerja
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/60" />
                Idle / Tidak Aktif
              </span>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Desktop Client Tracker
          </p>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Akses Cepat
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => router.push("/my-tasks")}
            className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors text-left group cursor-pointer shadow-2xs"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
              <ListTodo className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                Tugas Saya
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Lihat semua tugas yang ditugaskan ke Anda
              </p>
            </div>
          </button>

          <button
            onClick={() => router.push("/projects")}
            className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors text-left group cursor-pointer shadow-2xs"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                Daftar Proyek
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Kelola proyek dan status workflow
              </p>
            </div>
          </button>

          <button
            onClick={() => router.push("/timesheets")}
            className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors text-left group cursor-pointer shadow-2xs"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                Timesheets
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Review laporan jam kerja & persetujuan
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
