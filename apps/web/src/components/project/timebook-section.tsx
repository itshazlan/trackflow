"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  getTimeBlocks,
  deleteTimeBlock,
  overrideTimeBlock,
  TimeBlock,
} from "@/lib/time-service";
import { getProjectMembers, ProjectMember } from "@/lib/issues-service";
import { getSession, UserSession } from "@/lib/auth-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  Trash2,
  Lock,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Eye,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

interface TimeBookSectionProps {
  projectId: string;
}

export default function TimeBookSection({ projectId }: TimeBookSectionProps) {
  const [session, setSession] = useState<UserSession | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters state
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [activeDate, setActiveDate] = useState<string>(() => {
    return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
  });

  // Lightbox index
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Self-delete states
  const [deleteBlockId, setDeleteBlockId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Admin override states
  const [overrideBlock, setOverrideBlock] = useState<TimeBlock | null>(null);
  const [overrideAction, setOverrideAction] = useState<"delete" | "mark_unpaid">("delete");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideError, setOverrideError] = useState("");

  // Helper: get Mon-Sun week range dates for a given date
  const getWeekRange = useCallback((dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    // Monday is 1st day. If Sunday (0), shift by -6
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return {
      startDate: monday.toLocaleDateString("en-CA"),
      endDate: sunday.toLocaleDateString("en-CA"),
    };
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const s = await getSession();
      setSession(s);
      
      const projMembers = await getProjectMembers(projectId);
      setMembers(projMembers);

      // Default to current user's timebook
      const currentUsr = projMembers.find(
        (m) => m.email === s?.user?.email || m.username === s?.user?.username
      );
      const initialUserId = currentUsr?.id || s?.user?.id || "";
      setSelectedUserId(initialUserId);
    } catch (err) {
      console.error(err);
      setError("Gagal memuat konfigurasi halaman timebook.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

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

  const loadTimeBlocks = useCallback(async () => {
    if (!selectedUserId) return;
    try {
      setLoading(true);
      setError("");
      const { startDate, endDate } = getWeekRange(activeDate);
      const blocks = await getTimeBlocks(projectId, startDate, endDate, selectedUserId);
      setTimeBlocks(blocks);
    } catch (err) {
      console.error(err);
      setError("Gagal memuat data pencatatan waktu.");
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedUserId, activeDate, getWeekRange]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active && selectedUserId) {
        void loadTimeBlocks();
      }
    });
    return () => {
      active = false;
    };
  }, [loadTimeBlocks, selectedUserId]);

  // Calendar week generator
  const getWeekDays = () => {
    const d = new Date(activeDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));

    return Array.from({ length: 7 }).map((_, idx) => {
      const current = new Date(monday);
      current.setDate(monday.getDate() + idx);
      const dateStr = current.toLocaleDateString("en-CA");
      const name = current.toLocaleDateString("id-ID", { weekday: "short" });
      const num = current.getDate();
      return { dateStr, name, num };
    });
  };

  const handlePrevWeek = () => {
    const current = new Date(activeDate);
    current.setDate(current.getDate() - 7);
    setActiveDate(current.toLocaleDateString("en-CA"));
  };

  const handleNextWeek = () => {
    const current = new Date(activeDate);
    current.setDate(current.getDate() + 7);
    setActiveDate(current.toLocaleDateString("en-CA"));
  };

  // Filter blocks for activeDate
  const activeDateBlocks = timeBlocks.filter((b) => b.blockStart.startsWith(activeDate));
  const screenshotBlocks = activeDateBlocks.filter((b) => b.screenshot !== null);

  const getDailyHoursText = () => {
    const mins = activeDateBlocks.length * 10;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h} jam ${m} menit` : `${m} menit`;
  };

  const getWeeklyHoursText = () => {
    const mins = timeBlocks.length * 10;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h} jam ${m} menit` : `${m} menit`;
  };

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteBlockId || !deleteReason.trim()) return;

    setDeleteLoading(true);
    setDeleteError("");
    try {
      await deleteTimeBlock(deleteBlockId, deleteReason.trim());
      setDeleteBlockId(null);
      setDeleteReason("");
      await loadTimeBlocks();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Gagal menghapus blok waktu.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleConfirmOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideBlock || !overrideReason.trim()) return;

    setOverrideLoading(true);
    setOverrideError("");
    try {
      await overrideTimeBlock(overrideBlock.id, overrideAction, overrideReason.trim());
      setOverrideBlock(null);
      setOverrideReason("");
      await loadTimeBlocks();
    } catch (err: unknown) {
      setOverrideError(err instanceof Error ? err.message : "Gagal melakukan override blok waktu.");
    } finally {
      setOverrideLoading(false);
    }
  };

  const isAdmin = session?.user?.isAdmin;

  if (loading && timeBlocks.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase">Anggota Tim</Label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="h-8.5 rounded-md border border-border bg-card px-2.5 py-1 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-[150px]"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.role})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase">Tanggal Terpilih</Label>
            <Input
              type="date"
              value={activeDate}
              onChange={(e) => setActiveDate(e.target.value)}
              className="h-8.5 text-[12px]"
            />
          </div>
        </div>

        {/* Weekly range stats */}
        <div className="flex flex-col text-right justify-center shrink-0">
          <span className="text-[11px] text-muted-foreground">Total Jam Kerja Terpilih</span>
          <span className="text-[14px] font-bold text-foreground mt-0.5">
            Hari ini: {getDailyHoursText()} | Minggu ini: {getWeeklyHoursText()}
          </span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Week Calendar Picker */}
      <div className="flex items-center justify-between bg-card border border-border rounded-lg p-2.5 shadow-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md shrink-0" onClick={handlePrevWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 grid grid-cols-7 gap-1.5 px-3">
          {getWeekDays().map((day) => {
            const isToday = day.dateStr === activeDate;
            return (
              <button
                key={day.dateStr}
                onClick={() => setActiveDate(day.dateStr)}
                className={`flex flex-col items-center justify-center py-1.5 rounded-md transition-all border ${
                  isToday
                    ? "bg-primary border-primary text-primary-foreground shadow-sm font-semibold scale-102"
                    : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <span className="text-[9.5px] uppercase tracking-wider font-semibold opacity-80">
                  {day.name}
                </span>
                <span className="text-[14px] font-bold mt-0.5">{day.num}</span>
              </button>
            );
          })}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md shrink-0" onClick={handleNextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Screenshot Gallery Grid */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[12.5px] font-bold text-foreground uppercase tracking-wider">
            Galeri Screenshot Kerja ({screenshotBlocks.length})
          </h3>
        </div>

        {screenshotBlocks.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-lg text-muted-foreground text-xs bg-card/10">
            Tidak ada screenshot log aktivitas untuk hari terpilih ({new Date(activeDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}).
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {screenshotBlocks.map((block, idx) => {
              const startLocal = new Date(block.blockStart).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              });
              
              const imageUrl = block.screenshot!.r2ObjectKey.startsWith("http")
                ? block.screenshot!.r2ObjectKey
                : `/api/uploads/${block.screenshot!.r2ObjectKey}`;

              // Chart data for activity level
              const chartData = [
                {
                  name: "Aktivitas",
                  Keyboard: block.activity.keyboardCount,
                  Mouse: block.activity.mouseCount,
                },
              ];

              return (
                <div
                  key={block.id}
                  className="rounded-lg border border-border bg-card overflow-hidden shadow-sm flex flex-col group/item"
                >
                  {/* Screenshot Image Container */}
                  <div className="relative aspect-video bg-muted border-b border-border overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt={`Screenshot ${startLocal}`}
                      className="object-cover w-full h-full group-hover/item:scale-101 duration-150"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/item:opacity-100 flex items-center justify-center transition-all gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7.5 text-[11px] font-semibold"
                        onClick={() => setLightboxIndex(idx)}
                      >
                        <Eye className="h-3 w-3 mr-1" /> Preview
                      </Button>
                      
                      {/* Owner self-delete button */}
                      {session?.user?.id === selectedUserId && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7.5 text-[11px] font-semibold"
                          onClick={() => {
                            setDeleteBlockId(block.id);
                            setDeleteReason("");
                            setDeleteError("");
                          }}
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Hapus
                        </Button>
                      )}

                      {/* Admin override button */}
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7.5 text-[11px] font-semibold bg-popover hover:bg-muted text-foreground border-border"
                          onClick={() => {
                            setOverrideBlock(block);
                            setOverrideAction("delete");
                            setOverrideReason("");
                            setOverrideError("");
                          }}
                        >
                          <Lock className="h-3 w-3 mr-1" /> Override
                        </Button>
                      )}
                    </div>
                    {/* Unpaid Badge */}
                    {!block.isPaid && (
                      <span className="absolute top-2 left-2 bg-destructive border border-destructive/20 text-destructive-foreground text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                        UNPAID
                      </span>
                    )}
                    <span className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                      {startLocal}
                    </span>
                  </div>

                  {/* Activity Bar Chart under screenshot */}
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <div className="h-14 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                          <XAxis dataKey="name" hide />
                          <YAxis hide />
                          <RechartsTooltip cursor={{ fill: "transparent" }} />
                          <Bar dataKey="Keyboard" fill="var(--primary)" radius={[2, 2, 0, 0]} barSize={14} />
                          <Bar dataKey="Mouse" fill="var(--success)" radius={[2, 2, 0, 0]} barSize={14} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-muted-foreground border-t border-border/60 pt-2 font-medium">
                      <span>⌨️ Keyboard: {block.activity.keyboardCount}</span>
                      <span>🖱️ Mouse: {block.activity.mouseCount}</span>
                      <span className="capitalize font-semibold text-foreground">
                        Level: {block.activity.activityLevel}
                      </span>
                    </div>

                    {/* Active App Log */}
                    <div className="rounded bg-muted/40 border border-border/50 p-2 text-[11px] flex flex-col gap-0.5 min-h-[44px]">
                      <span className="font-semibold text-foreground text-[10.5px] truncate">
                        💻 {block.activity.activeAppName || "Unknown App"}
                      </span>
                      <span className="text-muted-foreground truncate leading-normal">
                        {block.activity.activeWindowTitle || "—"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox Preview Dialog */}
      <Dialog open={lightboxIndex !== null} onOpenChange={() => setLightboxIndex(null)}>
        {lightboxIndex !== null && (
          <DialogContent className="max-w-[70vw] p-1.5 overflow-hidden">
            <div className="flex flex-col bg-card relative">
              <div className="aspect-video relative bg-black overflow-hidden flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    screenshotBlocks[lightboxIndex].screenshot!.r2ObjectKey.startsWith("http")
                      ? screenshotBlocks[lightboxIndex].screenshot!.r2ObjectKey
                      : `/api/uploads/${screenshotBlocks[lightboxIndex].screenshot!.r2ObjectKey}`
                  }
                  alt="Lightbox screenshot preview"
                  className="max-h-[70vh] object-contain"
                />
                
                {/* Navigation arrows inside lightbox */}
                <Button
                  variant="ghost"
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 rounded-full h-8 w-8 text-white p-0 border border-white/10"
                  disabled={lightboxIndex === 0}
                  onClick={() => setLightboxIndex(lightboxIndex - 1)}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 rounded-full h-8 w-8 text-white p-0 border border-white/10"
                  disabled={lightboxIndex === screenshotBlocks.length - 1}
                  onClick={() => setLightboxIndex(lightboxIndex + 1)}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>

              <div className="p-3 border-t border-border flex justify-between items-center text-xs">
                <div>
                  <span className="font-semibold text-foreground">
                    Screenshot - {new Date(screenshotBlocks[lightboxIndex].blockStart).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[350px]">
                    {screenshotBlocks[lightboxIndex].activity.activeAppName} &mdash; {screenshotBlocks[lightboxIndex].activity.activeWindowTitle}
                  </p>
                </div>
                <div className="flex gap-3 text-[11px] text-muted-foreground font-semibold bg-muted/60 border border-border px-2.5 py-1.5 rounded-lg">
                  <span>⌨️ Keyboard: {screenshotBlocks[lightboxIndex].activity.keyboardCount}</span>
                  <span>🖱️ Mouse: {screenshotBlocks[lightboxIndex].activity.mouseCount}</span>
                  <span className="uppercase text-primary">Level: {screenshotBlocks[lightboxIndex].activity.activityLevel}</span>
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Self-delete confirmation dialog */}
      <Dialog open={deleteBlockId !== null} onOpenChange={() => setDeleteBlockId(null)}>
        <DialogContent className="sm:max-w-[340px]">
          <form onSubmit={handleConfirmDelete}>
            <DialogHeader>
              <DialogTitle className="text-[14px] font-semibold text-destructive">Hapus Blok Waktu Kerja</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-3 py-3 text-xs leading-relaxed text-muted-foreground">
              {deleteError && (
                <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive leading-normal">
                  <AlertCircle className="h-3.5 w-3.5 mt-[1px] shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}
              <p>
                Menghapus blok waktu ini juga akan menghapus screenshot yang bersangkutan. Blok waktu kerja yang terhapus tidak akan dihitung dalam timesheet pembayaran.
              </p>

              <div className="flex flex-col gap-1.5 mt-1">
                <Label htmlFor="del-reason" className="text-[11px] font-medium text-foreground">
                  Alasan Penghapusan
                </Label>
                <textarea
                  id="del-reason"
                  placeholder="Tulis alasan mengapa Anda menghapus blok waktu ini..."
                  required
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-[12px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                  disabled={deleteLoading}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-8 text-[12px]"
                onClick={() => setDeleteBlockId(null)}
                disabled={deleteLoading}
              >
                Batal
              </Button>
              <Button type="submit" variant="destructive" className="h-8 text-[12px]" disabled={deleteLoading}>
                {deleteLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  "Hapus Blok Waktu"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Admin override dialog */}
      <Dialog open={overrideBlock !== null} onOpenChange={() => setOverrideBlock(null)}>
        <DialogContent className="sm:max-w-[340px]">
          <form onSubmit={handleConfirmOverride}>
            <DialogHeader>
              <DialogTitle className="text-[14px] font-semibold">Override Jam Kerja (Admin)</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-3.5 py-3 text-xs text-muted-foreground">
              {overrideError && (
                <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive leading-normal">
                  <AlertCircle className="h-3.5 w-3.5 mt-[1px] shrink-0" />
                  <span>{overrideError}</span>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] font-semibold text-foreground">Pilih Tindakan Override</Label>
                <div className="flex items-center gap-4 mt-0.5">
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-foreground">
                    <input
                      type="radio"
                      name="override-act"
                      checked={overrideAction === "delete"}
                      onChange={() => setOverrideAction("delete")}
                      className="accent-primary h-3.5 w-3.5"
                    />
                    Hapus Blok
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-foreground">
                    <input
                      type="radio"
                      name="override-act"
                      checked={overrideAction === "mark_unpaid"}
                      onChange={() => setOverrideAction("mark_unpaid")}
                      className="accent-primary h-3.5 w-3.5"
                    />
                    Tandai Unpaid (Tidak Dibayar)
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 mt-1">
                <Label htmlFor="over-reason" className="text-[11px] font-semibold text-foreground">
                  Alasan Override <span className="text-red-500">*</span>
                </Label>
                <textarea
                  id="over-reason"
                  placeholder="Tulis alasan audit override..."
                  required
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-[12px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                  disabled={overrideLoading}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-8 text-[12px]"
                onClick={() => setOverrideBlock(null)}
                disabled={overrideLoading}
              >
                Batal
              </Button>
              <Button type="submit" className="h-8 text-[12px]" disabled={overrideLoading}>
                {overrideLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Konfirmasi Override"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
