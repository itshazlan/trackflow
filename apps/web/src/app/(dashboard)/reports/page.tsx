"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { getProjects, Project } from "@/lib/projects-service";
import { getProjectMembers, ProjectMember } from "@/lib/issues-service";
import { getReportPreview, downloadReport, ReportItem } from "@/lib/reports-service";
import { getSession } from "@/lib/auth-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  LineChart,
  AlertCircle,
  Calendar,
  Users,
  Folder,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function ReportsPage() {
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get("projectId") || "";
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  
  // Date range default to current month
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString("en-CA");
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toLocaleDateString("en-CA");
  });

  // Report Data
  const [reportItems, setReportItems] = useState<ReportItem[]>([]);
  const [totalMinutes, setTotalMinutes] = useState<number>(0);
  
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(15);

  const loadInitialConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      await getSession();

      const plist = await getProjects();
      setProjects(plist);

      // If projectId was in URL, verify and select it
      if (initialProjectId && plist.some((p) => p.id === initialProjectId)) {
        setSelectedProjectId(initialProjectId);
      }
    } catch (err) {
      console.error(err);
      setError("Gagal memuat konfigurasi awal halaman laporan.");
    } finally {
      setLoading(false);
    }
  }, [initialProjectId]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        void loadInitialConfig();
      }
    });
    return () => {
      active = false;
    };
  }, [loadInitialConfig]);

  // Load project members when project selection changes
  const loadMembers = useCallback(async () => {
    if (!selectedProjectId) {
      setMembers([]);
      setSelectedUserId("");
      return;
    }
    try {
      const data = await getProjectMembers(selectedProjectId);
      setMembers(data);
    } catch (err) {
      console.error(err);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        void loadMembers();
      }
    });
    return () => {
      active = false;
    };
  }, [loadMembers]);

  // Fetch Report Preview Data
  const loadReportPreview = useCallback(async () => {
    try {
      setPreviewLoading(true);
      setError("");
      const data = await getReportPreview(
        selectedProjectId || undefined,
        selectedUserId || undefined,
        startDate || undefined,
        endDate || undefined
      );
      setReportItems(data.rows || []);
      setTotalMinutes(data.totalMinutes);
      setCurrentPage(1);
    } catch (err: unknown) {
      console.error(err);
      setError("Gagal memuat pratinjau data laporan.");
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedProjectId, selectedUserId, startDate, endDate]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active && (projects.length > 0 || selectedProjectId === "")) {
        void loadReportPreview();
      }
    });
    return () => {
      active = false;
    };
  }, [loadReportPreview, projects, selectedProjectId]);

  const handleExport = async (format: "pdf" | "csv") => {
    try {
      setExportLoading(true);
      setError("");
      await downloadReport(
        format,
        selectedProjectId || undefined,
        selectedUserId || undefined,
        startDate || undefined,
        endDate || undefined
      );
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Gagal mengunduh laporan.");
    } finally {
      setExportLoading(false);
    }
  };

  const formatDuration = (mins: number) => {
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    return hrs > 0 ? `${hrs} jam ${m} menit` : `${m} menit`;
  };

  const formatMinutesShort = (mins: number) => {
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    return hrs > 0 ? `${hrs}j ${m}m` : `${m}m`;
  };

  // Paginated items calculations
  const totalItems = reportItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedItems = reportItems.slice(startIndex, endIndex);

  if (loading && projects.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 pb-20 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <LineChart className="h-5 w-5 text-primary" />
            Laporan Jam Kerja
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Analisis ringkasan jam kerja tim, buat filter terperinci, dan unduh laporan resmi.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-8.5 text-[12px] font-semibold border-border bg-card"
            onClick={() => handleExport("csv")}
            disabled={exportLoading || previewLoading || reportItems.length === 0}
          >
            {exportLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-green-500" />
            )}
            Export CSV
          </Button>
          <Button
            size="sm"
            className="h-8.5 text-[12px] font-semibold"
            onClick={() => handleExport("pdf")}
            disabled={exportLoading || previewLoading || reportItems.length === 0}
          >
            {exportLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <FileText className="h-3.5 w-3.5 mr-1.5" />
            )}
            Export PDF (Laporan)
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters Form Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-card border border-border p-4 rounded-xl shadow-xs">
        {/* Project Selector */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
            <Folder className="h-3 w-3" /> Proyek
          </Label>
          <select
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setSelectedUserId(""); // reset worker when project changes
            }}
            className="h-8.5 rounded-md border border-border bg-transparent px-2.5 py-1 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Semua Proyek</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Worker Selector */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
            <Users className="h-3 w-3" /> Pekerja
          </Label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="h-8.5 rounded-md border border-border bg-transparent px-2.5 py-1 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            disabled={!selectedProjectId}
          >
            <option value="">Semua Pekerja</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.role})
              </option>
            ))}
          </select>
        </div>

        {/* Start Date */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Tanggal Mulai
          </Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-8.5 text-[12px]"
          />
        </div>

        {/* End Date */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Tanggal Akhir
          </Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-8.5 text-[12px]"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 shadow-xs">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Jam Kerja Terakumulasi</span>
          <span className="text-2xl font-bold text-primary mt-1">
            {previewLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              formatDuration(totalMinutes)
            )}
          </span>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 shadow-xs">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Transaksi Log Kerja</span>
          <span className="text-2xl font-bold text-foreground mt-1">
            {previewLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              `${reportItems.length} Entri Log`
            )}
          </span>
        </div>
      </div>

      {/* Preview Table */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[12.5px] font-bold text-foreground uppercase tracking-wider">
            Pratinjau Rincian Log Aktivitas
          </h3>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Tanggal</TableHead>
                <TableHead>Pekerja</TableHead>
                <TableHead>Proyek</TableHead>
                <TableHead>Tiket / Issue</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-4">Durasi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewLoading ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="h-28 text-center">
                    <div className="flex justify-center items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Memuat pratinjau data...
                    </div>
                  </TableCell>
                </TableRow>
              ) : reportItems.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="h-28 text-center text-muted-foreground text-xs">
                    Tidak ada data log jam kerja yang cocok dengan kriteria filter.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((item, idx) => (
                  <TableRow key={startIndex + idx} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="pl-4 font-medium text-foreground text-[12.5px]">
                      {new Date(item.date).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-[12px] font-medium text-foreground">{item.user}</TableCell>
                    <TableCell className="text-[12px]">{item.project}</TableCell>
                    <TableCell className="text-[12px] font-semibold text-foreground max-w-[150px] truncate" title={item.issue}>
                      {item.issue}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold border uppercase tracking-wider ${
                        item.type === "Automatic"
                          ? "bg-blue-500/10 border-blue-500/20 text-blue-500"
                          : "bg-purple-500/10 border-purple-500/20 text-purple-500"
                      }`}>
                        {item.type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold border uppercase tracking-wider ${
                        item.status === "APPROVED" || item.status === "Paid"
                          ? "bg-green-500/10 border-green-500/20 text-green-500"
                          : item.status === "REJECTED" || item.status === "Unpaid"
                          ? "bg-red-500/10 border-red-500/20 text-red-500"
                          : "bg-amber-500/10 border-amber-500/20 text-amber-500"
                      }`}>
                        {item.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-4 font-mono font-bold text-foreground text-[12.5px]">
                      {formatMinutesShort(item.durationMins)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-2 px-1">
            {/* Info */}
            <div className="text-xs text-muted-foreground">
              Menampilkan <span className="font-semibold text-foreground">{totalItems === 0 ? 0 : startIndex + 1}</span> hingga{" "}
              <span className="font-semibold text-foreground">{endIndex}</span> dari{" "}
              <span className="font-semibold text-foreground">{totalItems}</span> entri log
            </div>

            {/* Pagination Controls & Page Size Selector */}
            <div className="flex items-center gap-4">
              {/* Page Size Select */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-muted-foreground uppercase">Baris per halaman:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-7.5 rounded border border-border bg-card px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                >
                  {[10, 15, 25, 50].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>

              {/* Prev/Next Buttons */}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7.5 w-7.5 border-border bg-card hover:bg-muted text-foreground disabled:opacity-50"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  <span className="sr-only">Previous Page</span>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                
                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const page = i + 1;
                    if (
                      page === 1 ||
                      page === totalPages ||
                      Math.abs(page - currentPage) <= 1
                    ) {
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="icon"
                          className={`h-7.5 w-7.5 border-border ${
                            currentPage === page
                              ? "bg-primary text-primary-foreground font-bold shadow-xs hover:brightness-110"
                              : "bg-card hover:bg-muted text-foreground"
                          } text-[11px]`}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      );
                    } else if (
                      (page === 2 && currentPage > 3) ||
                      (page === totalPages - 1 && currentPage < totalPages - 2)
                    ) {
                      return (
                        <span key={page} className="text-muted-foreground/60 text-xs px-1 select-none">
                          ...
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-7.5 w-7.5 border-border bg-card hover:bg-muted text-foreground disabled:opacity-50"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  <span className="sr-only">Next Page</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
