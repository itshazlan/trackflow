"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  getTimesheets,
  getTimesheetDetail,
  createTimesheet,
  submitTimesheet,
  approveTimesheet,
  getManualEntries,
  createManualEntry,
  Timesheet,
  ManualTimeEntry,
} from "@/lib/timesheet-service";
import { getProjects, Project } from "@/lib/projects-service";
import { getProjectMembers, getIssues, ProjectMember, Issue } from "@/lib/issues-service";
import { getSession, UserSession } from "@/lib/auth-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Loader2,
  Plus,
  FileText,
  Clock,
  AlertCircle,
  FileCheck2,
  Calendar,
  Layers,
  ArrowRight,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock3,
} from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";

export default function TimesheetsPage() {
  const confirm = useConfirm();
  const [session, setSession] = useState<UserSession | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Timesheets state
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [viewMode, setViewMode] = useState<"personal" | "team">("personal");
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState("");

  // Timesheet Detail Modal state
  const [selectedTimesheetId, setSelectedTimesheetId] = useState<string | null>(null);
  const [timesheetDetail, setTimesheetDetail] = useState<Timesheet | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  // Manual entries state
  const [manualEntries, setManualEntries] = useState<ManualTimeEntry[]>([]);
  const [manualDate, setManualDate] = useState("");
  const [manualHours, setManualHours] = useState("");
  const [manualMinutes, setManualMinutes] = useState("");
  const [manualIssueId, setManualIssueId] = useState("");
  const [manualDesc, setManualDesc] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState("");

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const s = await getSession();
      setSession(s);

      const plist = await getProjects();
      setProjects(plist);

      if (plist.length > 0) {
        setSelectedProjectId(plist[0].id);
      }
    } catch (err) {
      console.error(err);
      setError("Gagal memuat data awal.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        void loadInitialData();
      }
    });
    return () => {
      active = false;
    };
  }, [loadInitialData]);

  // Load project-specific data when selected project changes
  const loadProjectData = useCallback(async () => {
    if (!selectedProjectId) return;
    try {
      setLoading(true);
      setError("");
      const [membersData, issuesData, tsData, manualData] = await Promise.all([
        getProjectMembers(selectedProjectId),
        getIssues(selectedProjectId),
        getTimesheets(selectedProjectId),
        getManualEntries(selectedProjectId),
      ]);
      setMembers(membersData);
      setIssues(issuesData);
      setTimesheets(tsData);
      setManualEntries(manualData);
    } catch (err) {
      console.error(err);
      setError("Gagal memuat data proyek.");
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active && selectedProjectId) {
        void loadProjectData();
      }
    });
    return () => {
      active = false;
    };
  }, [loadProjectData, selectedProjectId]);

  // Determine user role in current project
  const currentMember = members.find(
    (m) => m.email === session?.user?.email || m.username === session?.user?.username
  );
  const isManagerOrAdmin = currentMember?.role === "manager" || session?.user?.isAdmin;

  // Filter timesheets list
  const displayTimesheets = isManagerOrAdmin && viewMode === "team"
    ? timesheets
    : timesheets.filter((t) => t.userId === session?.user?.id);

  // Formatting minutes to Hours & Minutes
  const formatMinutes = (totalMins: number) => {
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return hours > 0 ? `${hours}j ${mins}m` : `${mins}m`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-green-500 uppercase tracking-wider">
            <CheckCircle2 className="h-3 w-3" /> Approved
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-500 uppercase tracking-wider">
            <XCircle className="h-3 w-3" /> Rejected
          </span>
        );
      case "submitted":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-500 uppercase tracking-wider">
            <Clock3 className="h-3 w-3" /> Submitted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-muted border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Draft
          </span>
        );
    }
  };

  const handleGenerateTimesheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !periodStart || !periodEnd) return;

    setGenerateLoading(true);
    setGenerateError("");

    try {
      await createTimesheet(selectedProjectId, periodStart, periodEnd);
      setIsGenerateOpen(false);
      setPeriodStart("");
      setPeriodEnd("");
      await loadProjectData();
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : "Gagal membuat timesheet.");
    } finally {
      setGenerateLoading(false);
    }
  };

  const handleSubmitTimesheetTrigger = async (tsId: string) => {
    const ok = await confirm({
      title: "Kirim Timesheet",
      description: "Kirim timesheet ini untuk diajukan ke manajer proyek?",
      confirmLabel: "Ya, Kirim",
      variant: "default",
    });
    if (!ok) return;
    try {
      await submitTimesheet(tsId);
      await loadProjectData();
    } catch (err: unknown) {
      await confirm({
        title: "Gagal Mengirim",
        description: err instanceof Error ? err.message : "Gagal mengirimkan timesheet.",
        confirmLabel: "Tutup",
        cancelLabel: "",
        variant: "destructive",
      });
    }
  };

  const loadTimesheetDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError("");
    try {
      const data = await getTimesheetDetail(id);
      setTimesheetDetail(data);
    } catch (err: unknown) {
      setDetailError(err instanceof Error ? err.message : "Gagal memuat detail timesheet.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleReviewTimesheet = async (decision: "approved" | "rejected") => {
    if (!timesheetDetail) return;
    const label = decision === "approved" ? "menyetujui" : "menolak";
    const ok = await confirm({
      title: decision === "approved" ? "Setujui Timesheet" : "Tolak Timesheet",
      description: `Apakah Anda yakin ingin ${label} timesheet ini?`,
      confirmLabel: decision === "approved" ? "Ya, Setujui" : "Ya, Tolak",
      variant: decision === "approved" ? "default" : "destructive",
    });
    if (!ok) return;

    setReviewLoading(true);
    try {
      const updated = await approveTimesheet(timesheetDetail.id, decision, approvalNote.trim() || undefined);
      setTimesheetDetail((prev) => (prev ? { ...prev, status: updated.status } : null));
      setApprovalNote("");
      await loadProjectData();
      if (selectedTimesheetId) {
        void loadTimesheetDetail(selectedTimesheetId);
      }
    } catch (err: unknown) {
      await confirm({
        title: "Gagal Memproses",
        description: err instanceof Error ? err.message : "Gagal memproses persetujuan timesheet.",
        confirmLabel: "Tutup",
        cancelLabel: "",
        variant: "destructive",
      });
    } finally {
      setReviewLoading(false);
    }
  };

  const handleCreateManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !manualDate || !manualDesc.trim()) return;

    const hrs = parseInt(manualHours || "0", 10);
    const mins = parseInt(manualMinutes || "0", 10);
    const totalMinutes = hrs * 60 + mins;

    if (totalMinutes <= 0) {
      setManualError("Durasi kerja harus lebih besar dari 0.");
      return;
    }

    setManualLoading(true);
    setManualError("");

    try {
      await createManualEntry(
        selectedProjectId,
        manualIssueId || null,
        totalMinutes,
        manualDesc.trim(),
        manualDate
      );
      // Reset form
      setManualHours("");
      setManualMinutes("");
      setManualIssueId("");
      setManualDesc("");
      await loadProjectData();
    } catch (err: unknown) {
      setManualError(err instanceof Error ? err.message : "Gagal membuat entri waktu manual.");
    } finally {
      setManualLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Timesheet &amp; Persetujuan Waktu
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Kelola pengajuan berkas jam kerja mingguan/bulanan dan catat entri waktu manual.
          </p>
        </div>

        {/* Project Selector */}
        <div className="flex flex-col gap-1 shrink-0">
          <Label className="text-[10px] font-bold text-muted-foreground uppercase">Pilih Proyek</Label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="h-8.5 rounded-md border border-border bg-card px-2.5 py-1 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-[200px]"
            disabled={loading && projects.length === 0}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs list */}
      <Tabs defaultValue="timesheets" className="w-full flex flex-col gap-4">
        <TabsList className="w-fit h-8.5 bg-muted/40 border border-border p-0.5 rounded-lg shrink-0">
          <TabsTrigger value="timesheets" className="text-[11.5px] font-medium px-3.5 rounded-md flex items-center gap-1.5">
            <FileCheck2 className="h-3.5 w-3.5" />
            Persetujuan Timesheet
          </TabsTrigger>
          <TabsTrigger value="manual" className="text-[11.5px] font-medium px-3.5 rounded-md flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Entri Waktu Manual
          </TabsTrigger>
        </TabsList>

        {/* Timesheets list tab content */}
        <TabsContent value="timesheets" className="mt-0 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-muted/20 p-3 rounded-lg border border-border">
            <div className="flex items-center gap-2">
              {isManagerOrAdmin ? (
                <div className="flex items-center bg-muted p-0.5 rounded border border-border">
                  <button
                    onClick={() => setViewMode("personal")}
                    className={`px-3 py-0.5 text-[11px] rounded transition-all font-semibold ${
                      viewMode === "personal" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Timesheet Saya
                  </button>
                  <button
                    onClick={() => setViewMode("team")}
                    className={`px-3 py-0.5 text-[11px] rounded transition-all font-semibold ${
                      viewMode === "team" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Persetujuan Tim
                  </button>
                </div>
              ) : (
                <span className="text-[12px] font-bold text-foreground uppercase tracking-wider">Berkas Timesheet Anda</span>
              )}
            </div>
            <Button size="sm" className="h-8 text-[12px] font-medium" onClick={() => setIsGenerateOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Buat Timesheet
            </Button>
          </div>

          {/* Mobile Card List View (visible on < sm, hidden on >= sm) */}
          <div className="flex flex-col gap-3 sm:hidden">
            {displayTimesheets.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground text-[12px] italic">
                Tidak ada berkas timesheet ditemukan.
              </div>
            ) : (
              displayTimesheets.map((ts) => (
                <div key={ts.id} className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 shadow-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-1 min-w-0">
                      {isManagerOrAdmin && viewMode === "team" && (
                        <div className="mb-1">
                          <div className="font-semibold text-foreground text-[13px]">{ts.user?.name || "Karyawan"}</div>
                          <div className="text-[10px] text-muted-foreground">{ts.user?.email}</div>
                        </div>
                      )}
                      <button
                        onClick={() => {
                          setSelectedTimesheetId(ts.id);
                          loadTimesheetDetail(ts.id);
                        }}
                        className="font-bold text-foreground text-left hover:underline text-[13px] truncate"
                      >
                        {new Date(ts.periodStart).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} - {new Date(ts.periodEnd).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </button>
                      <span className="text-[10px] text-muted-foreground">Dibuat {new Date(ts.createdAt).toLocaleDateString("id-ID")}</span>
                    </div>
                    <div className="shrink-0">
                      {getStatusBadge(ts.status)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border/60 pt-2.5">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-muted-foreground uppercase font-semibold">Total Durasi</span>
                      <span className="font-mono font-bold text-foreground text-[13px]">
                        {formatMinutes(ts.totalMinutes)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7.5 text-[11px] font-medium px-3"
                        onClick={() => {
                          setSelectedTimesheetId(ts.id);
                          loadTimesheetDetail(ts.id);
                        }}
                      >
                        Detail
                      </Button>
                      {ts.status === "draft" && ts.userId === session?.user?.id && (
                        <Button
                          size="sm"
                          className="h-7.5 text-[11px] font-medium px-3"
                          onClick={() => handleSubmitTimesheetTrigger(ts.id)}
                        >
                          Kirim
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View (hidden on < sm, visible on >= sm) */}
          <div className="hidden sm:block rounded-lg border border-border bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {isManagerOrAdmin && viewMode === "team" && <TableHead className="pl-4">Karyawan</TableHead>}
                  <TableHead className={isManagerOrAdmin && viewMode === "team" ? "" : "pl-4"}>Periode</TableHead>
                  <TableHead className="text-right">Total Durasi</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center pr-4">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayTimesheets.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={isManagerOrAdmin && viewMode === "team" ? 5 : 4} className="h-28 text-center text-muted-foreground">
                      Tidak ada berkas timesheet ditemukan.
                    </TableCell>
                  </TableRow>
                ) : (
                  displayTimesheets.map((ts) => (
                    <TableRow key={ts.id} className="hover:bg-muted/40 transition-colors">
                      {isManagerOrAdmin && viewMode === "team" && (
                        <TableCell className="pl-4">
                          <div className="font-semibold text-foreground text-[12.5px]">{ts.user?.name || "Karyawan"}</div>
                          <div className="text-[10px] text-muted-foreground">{ts.user?.email}</div>
                        </TableCell>
                      )}
                      <TableCell className={isManagerOrAdmin && viewMode === "team" ? "" : "pl-4"}>
                        <button
                          onClick={() => {
                            setSelectedTimesheetId(ts.id);
                            loadTimesheetDetail(ts.id);
                          }}
                          className="font-bold text-foreground hover:underline text-left cursor-pointer"
                        >
                          {new Date(ts.periodStart).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} - {new Date(ts.periodEnd).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </button>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Dibuat {new Date(ts.createdAt).toLocaleDateString("id-ID")}</div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-foreground text-[12.5px]">
                        {formatMinutes(ts.totalMinutes)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(ts.status)}
                      </TableCell>
                      <TableCell className="text-center pr-4">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] font-medium px-2.5"
                            onClick={() => {
                              setSelectedTimesheetId(ts.id);
                              loadTimesheetDetail(ts.id);
                            }}
                          >
                            Detail
                          </Button>
                          {ts.status === "draft" && ts.userId === session?.user?.id && (
                            <Button
                              size="sm"
                              className="h-7 text-[11px] font-medium px-2.5"
                              onClick={() => handleSubmitTimesheetTrigger(ts.id)}
                            >
                              Kirim
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Manual time entry tab content */}
        <TabsContent value="manual" className="mt-0 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left: manual entry form */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm flex flex-col gap-4 md:col-span-1 h-fit">
            <div>
              <h3 className="text-[13.5px] font-bold text-foreground">Catat Waktu Manual</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Kirim data jam kerja manual jika perekam otomatis tidak aktif.
              </p>
            </div>

            <form onSubmit={handleCreateManualEntry} className="flex flex-col gap-3.5">
              {manualError && (
                <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive leading-normal">
                  <AlertCircle className="h-3.5 w-3.5 mt-[1px] shrink-0" />
                  <span>{manualError}</span>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="man-date" className="text-[11px] font-medium text-muted-foreground">
                  Tanggal Entri <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="man-date"
                  type="date"
                  required
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="h-8 text-[12px]"
                  disabled={manualLoading}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Durasi Kerja <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-1.5">
                    <Input
                      type="number"
                      min="0"
                      placeholder="Jam"
                      value={manualHours}
                      onChange={(e) => setManualHours(e.target.value)}
                      className="h-8 text-[12px] text-right"
                      disabled={manualLoading}
                    />
                    <span className="text-[11px] text-muted-foreground font-semibold">j</span>
                  </div>
                  <div className="flex-1 flex items-center gap-1.5">
                    <Input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="Menit"
                      value={manualMinutes}
                      onChange={(e) => setManualMinutes(e.target.value)}
                      className="h-8 text-[12px] text-right"
                      disabled={manualLoading}
                    />
                    <span className="text-[11px] text-muted-foreground font-semibold">m</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="man-issue" className="text-[11px] font-medium text-muted-foreground">
                  Terkait Tiket/Issue (Opsional)
                </Label>
                <select
                  id="man-issue"
                  value={manualIssueId}
                  onChange={(e) => setManualIssueId(e.target.value)}
                  className="h-8 rounded-md border border-input bg-card px-2 text-[12px] outline-none"
                  disabled={manualLoading}
                >
                  <option value="">-- Pilih Issue --</option>
                  {issues.map((issue) => (
                    <option key={issue.id} value={issue.id}>
                      {issue.displayId ? `[${issue.displayId}] ${issue.title}` : issue.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="man-desc" className="text-[11px] font-medium text-muted-foreground">
                  Deskripsi Pekerjaan <span className="text-red-500">*</span>
                </Label>
                <textarea
                  id="man-desc"
                  placeholder="Jelaskan aktivitas pekerjaan yang dilakukan..."
                  required
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                  className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-[12px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  disabled={manualLoading}
                />
              </div>

              <Button type="submit" className="h-8.5 text-[12px] mt-1 font-semibold" disabled={manualLoading}>
                {manualLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Entri Waktu"
                )}
              </Button>
            </form>
          </div>

          {/* Right: manual time entries table */}
          <div className="md:col-span-2 flex flex-col gap-4">
            <h3 className="text-[12.5px] font-bold text-foreground uppercase tracking-wider">
              Riwayat Waktu Kerja Manual ({manualEntries.length})
            </h3>
            
            {/* Mobile View for Manual Entries (visible on < sm, hidden on >= sm) */}
            <div className="flex flex-col gap-2.5 sm:hidden">
              {manualEntries.length === 0 ? (
                <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground text-[12px] italic">
                  Belum ada entri waktu manual.
                </div>
              ) : (
                manualEntries.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-border bg-card p-3 flex flex-col gap-2 shadow-xs">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-foreground text-[12px]">
                        {new Date(entry.entryDate).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold border uppercase tracking-wider ${
                        entry.approvalStatus === "approved"
                          ? "bg-green-500/10 border-green-500/20 text-green-500"
                          : entry.approvalStatus === "rejected"
                          ? "bg-red-500/10 border-red-500/20 text-red-500"
                          : "bg-amber-500/10 border-amber-500/20 text-amber-500"
                      }`}>
                        {entry.approvalStatus}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-muted-foreground leading-relaxed line-clamp-2">
                      {entry.description}
                    </p>
                    <div className="flex items-center justify-between border-t border-border/50 pt-2 mt-0.5">
                      <span className="text-[9px] text-muted-foreground uppercase font-medium">Durasi</span>
                      <span className="font-mono font-bold text-foreground text-[12px]">
                        {formatMinutes(entry.durationMinutes)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop View for Manual Entries (hidden on < sm, visible on >= sm) */}
            <div className="hidden sm:block rounded-lg border border-border bg-card overflow-hidden shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">Tanggal</TableHead>
                    <TableHead>Deskripsi</TableHead>
                    <TableHead className="text-right">Durasi</TableHead>
                    <TableHead className="text-center pr-4">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manualEntries.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={4} className="h-28 text-center text-muted-foreground">
                        Belum ada entri waktu manual.
                      </TableCell>
                    </TableRow>
                  ) : (
                    manualEntries.map((entry) => (
                      <TableRow key={entry.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="pl-4 font-medium text-foreground">
                          {new Date(entry.entryDate).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-[12.5px]" title={entry.description}>
                          {entry.description}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-foreground text-[12.5px]">
                          {formatMinutes(entry.durationMinutes)}
                        </TableCell>
                        <TableCell className="text-center pr-4">
                          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9.5px] font-bold border uppercase tracking-wider ${
                            entry.approvalStatus === "approved"
                              ? "bg-green-500/10 border-green-500/20 text-green-500"
                              : entry.approvalStatus === "rejected"
                              ? "bg-red-500/10 border-red-500/20 text-red-500"
                              : "bg-amber-500/10 border-amber-500/20 text-amber-500"
                          }`}>
                            {entry.approvalStatus}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog: Create Timesheet */}
      <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
        <DialogContent className="sm:max-w-[340px]">
          <form onSubmit={handleGenerateTimesheet}>
            <DialogHeader>
              <DialogTitle className="text-[14px] font-semibold">Buat Berkas Timesheet</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-3.5 py-4">
              {generateError && (
                <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive leading-normal">
                  <AlertCircle className="h-3.5 w-3.5 mt-[1px] shrink-0" />
                  <span>{generateError}</span>
                </div>
              )}
              
              <p className="text-[11.5px] text-muted-foreground leading-relaxed">
                Buat timesheet baru dengan menentukan jangkauan tanggal. Seluruh perekaman jam kerja dan entri manual yang disetujui akan diakumulasikan otomatis.
              </p>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="period-start" className="text-[11px] font-medium text-muted-foreground">
                  Tanggal Mulai Periode
                </Label>
                <Input
                  id="period-start"
                  type="date"
                  required
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="h-8 text-[12px]"
                  disabled={generateLoading}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="period-end" className="text-[11px] font-medium text-muted-foreground">
                  Tanggal Akhir Periode
                </Label>
                <Input
                  id="period-end"
                  type="date"
                  required
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="h-8 text-[12px]"
                  disabled={generateLoading}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-8 text-[12px]"
                onClick={() => setIsGenerateOpen(false)}
                disabled={generateLoading}
              >
                Batal
              </Button>
              <Button type="submit" className="h-8 text-[12px]" disabled={generateLoading}>
                {generateLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Membuat...
                  </>
                ) : (
                  "Buat Timesheet"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Timesheet Detail & Manager Review */}
      <Dialog open={selectedTimesheetId !== null} onOpenChange={() => setSelectedTimesheetId(null)}>
        <DialogContent className="sm:max-w-[460px]">
          {detailLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            timesheetDetail && (
              <div className="flex flex-col gap-4 text-xs">
                <DialogHeader className="border-b border-border pb-3">
                  <div className="flex items-center justify-between mt-1 pr-8">
                    <DialogTitle className="text-[14px] font-semibold">
                      Detail Berkas Timesheet
                    </DialogTitle>
                    {getStatusBadge(timesheetDetail.status)}
                  </div>
                </DialogHeader>

                {detailError && (
                  <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive leading-normal">
                    <AlertCircle className="h-3.5 w-3.5 mt-[1px] shrink-0" />
                    <span>{detailError}</span>
                  </div>
                )}

                {/* Overview Information */}
                <div className="grid grid-cols-2 gap-4 border-b border-border/60 pb-3">
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Karyawan Pengaju</span>
                    <p className="font-semibold text-foreground text-[12.5px] mt-0.5">{timesheetDetail.user?.name}</p>
                    <p className="text-muted-foreground text-[11px]">{timesheetDetail.user?.email}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Total Jam Kerja</span>
                    <p className="font-bold text-primary text-[15px] mt-0.5">{formatMinutes(timesheetDetail.totalMinutes)}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-1 border-b border-border/60 pb-3">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Jangkauan Periode</span>
                  <div className="flex items-center gap-2 mt-0.5 text-foreground font-semibold text-[12px]">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {new Date(timesheetDetail.periodStart).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    {new Date(timesheetDetail.periodEnd).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </div>
                </div>

                {/* Historic Approval Logs */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Catatan Peninjauan (Logs)</span>
                  {(!timesheetDetail.approvals || timesheetDetail.approvals.length === 0) ? (
                    <span className="text-muted-foreground italic bg-muted/30 border border-border p-2 rounded">
                      Belum ada catatan review persetujuan.
                    </span>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-[120px] overflow-y-auto pr-1">
                      {timesheetDetail.approvals.map((app) => (
                        <div key={app.id} className="border border-border/80 p-2 rounded bg-muted/20 flex flex-col gap-1">
                          <div className="flex justify-between items-center text-[10.5px]">
                            <span className="font-bold text-foreground">Reviewed by: {app.reviewer?.name}</span>
                            <span className={`font-bold capitalize ${app.decision === "approved" ? "text-green-500" : "text-red-500"}`}>
                              {app.decision}
                            </span>
                          </div>
                          {app.note && (
                            <p className="text-muted-foreground leading-normal mt-0.5 italic flex gap-1 items-start">
                              <MessageSquare className="h-3 w-3 shrink-0 mt-[1.5px]" />
                              &ldquo;{app.note}&rdquo;
                            </p>
                          )}
                          <span className="text-[9.5px] text-muted-foreground text-right mt-1">
                            {new Date(app.reviewedAt).toLocaleString("id-ID")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Manager / Admin review section */}
                {isManagerOrAdmin && timesheetDetail.status === "submitted" && (
                  <div className="border-t border-border pt-3 mt-1 flex flex-col gap-2.5">
                    <span className="text-[10px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      Tinjau Pengajuan Jam Kerja (Manager View)
                    </span>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="app-note" className="text-[11px] font-medium text-muted-foreground">
                        Catatan Keputusan (Catatan review)
                      </Label>
                      <textarea
                        id="app-note"
                        placeholder="Tulis umpan balik, persetujuan, atau alasan penolakan jika diperlukan..."
                        value={approvalNote}
                        onChange={(e) => setApprovalNote(e.target.value)}
                        className="min-h-[50px] w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-[11.5px] text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        disabled={reviewLoading}
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:flex sm:justify-end gap-2 mt-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8 text-[11px] px-3 font-semibold bg-red-500 hover:bg-red-600"
                        onClick={() => handleReviewTimesheet("rejected")}
                        disabled={reviewLoading}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Tolak (Reject)
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 text-[11px] px-3 font-semibold bg-green-500 hover:bg-green-600 text-white"
                        onClick={() => handleReviewTimesheet("approved")}
                        disabled={reviewLoading}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Setujui (Approve)
                      </Button>
                    </div>
                  </div>
                )}

                <DialogFooter className="border-t border-border pt-3 mt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 text-[12px]"
                    onClick={() => setSelectedTimesheetId(null)}
                    disabled={reviewLoading}
                  >
                    Tutup
                  </Button>
                </DialogFooter>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
