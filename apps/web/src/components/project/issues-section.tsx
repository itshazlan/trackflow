"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  getIssues,
  createIssue,
  deleteIssue,
  getProjectStatuses,
  getTrackers,
  getProjectMembers,
  getProjectTemplates,
  updateIssueStatus,
  getIssueAttachments,
  createIssueAttachment,
  deleteIssueAttachment,
  Issue,
  IssueStatus,
  Tracker,
  ProjectMember,
  IssueTemplate,
  IssueAttachment,
} from "@/lib/issues-service";
import { getSession, UserSession } from "@/lib/auth-service";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  Loader2,
  Plus,
  Search,
  Sliders,
  AlertCircle,
  Trash2,
  Calendar,
  Paperclip,
  X,
} from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface IssuesSectionProps {
  projectId: string;
}

export default function IssuesSection({ projectId }: IssuesSectionProps) {
  const confirm = useConfirm();
  const [session, setSession] = useState<UserSession | null>(null);
  const [issuesList, setIssuesList] = useState<Issue[]>([]);
  const [statuses, setStatuses] = useState<IssueStatus[]>([]);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [templates, setTemplates] = useState<IssueTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create Issue Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTrackerId, setSelectedTrackerId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [statusId, setStatusId] = useState("");
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  // Create Issue Attachments state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Detail Issue Dialog state
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [attachments, setAttachments] = useState<IssueAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);

  // Filter states
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const s = await getSession();
      setSession(s);
      
      const [issuesData, statusesData, trackersData, membersData, templatesData] = await Promise.all([
        getIssues(projectId),
        getProjectStatuses(projectId),
        getTrackers(),
        getProjectMembers(projectId),
        getProjectTemplates(projectId),
      ]);

      setIssuesList(issuesData);
      setStatuses(statusesData);
      setTrackers(trackersData);
      setMembers(membersData);
      setTemplates(templatesData);

      if (statusesData.length > 0) setStatusId(statusesData[0].id);
      if (trackersData.length > 0) setSelectedTrackerId(trackersData[0].id);
    } catch (err) {
      console.error(err);
      setError("Gagal memuat data issues.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        void fetchData();
      }
    });
    return () => {
      active = false;
    };
  }, [fetchData]);

  useEffect(() => {
    if (selectedIssue && isDetailOpen) {
      setAttachmentsLoading(true);
      getIssueAttachments(selectedIssue.id)
        .then((data) => setAttachments(data))
        .catch((err) => console.error("Gagal mengambil lampiran:", err))
        .finally(() => setAttachmentsLoading(false));
    } else {
      setAttachments([]);
    }
  }, [selectedIssue, isDetailOpen]);

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!selectedIssue) return;
    const ok = await confirm({
      title: "Hapus Lampiran",
      description: "Apakah Anda yakin ingin menghapus lampiran ini? Tindakan ini tidak dapat dibatalkan.",
      confirmLabel: "Ya, Hapus",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      await deleteIssueAttachment(selectedIssue.id, attachmentId);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err: unknown) {
      setDetailError(err instanceof Error ? err.message : "Gagal menghapus lampiran.");
    }
  };

  // Find matching template
  const bugTemplate = templates.find((t) => t.trackerId === selectedTrackerId);

  const handleOpenCreateModal = () => {
    const defaultTrackerId = selectedTrackerId || (trackers.length > 0 ? trackers[0].id : "");
    if (defaultTrackerId && !selectedTrackerId) {
      setSelectedTrackerId(defaultTrackerId);
    }

    const template = templates.find((t) => t.trackerId === defaultTrackerId);
    if (template) {
      setTitle(template.titlePattern || "");
      setDescription(template.descriptionPattern || "");
    } else {
      setTitle("");
      setDescription("");
    }
    setSelectedFiles([]);
    setCreateError("");
    setIsCreateOpen(true);
  };

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrackerId) return;

    setCreateLoading(true);
    setCreateError("");

    try {
      if (!title.trim()) {
        throw new Error("Judul tiket wajib diisi.");
      }
      const newIssue = await createIssue(projectId, {
        trackerId: selectedTrackerId,
        title,
        description,
        statusId: statusId || undefined,
        priority,
        assigneeId: assigneeId || null,
        dueDate: dueDate || null,
      });

      // Upload selected files sequentially
      for (const file of selectedFiles) {
        const { uploadUrl } = await createIssueAttachment(
          newIssue.id,
          file.name,
          file.type || "application/octet-stream"
        );

        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error(`Gagal mengunggah lampiran: ${file.name}`);
        }
      }

      setIsCreateOpen(false);
      // Reset states
      setTitle("");
      setDescription("");
      setPriority("medium");
      setAssigneeId("");
      setDueDate("");
      setSelectedFiles([]);
      await fetchData();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Gagal membuat issue.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleStatusChange = async (issueId: string, newStatusId: string) => {
    setDetailLoading(true);
    setDetailError("");
    try {
      const updated = await updateIssueStatus(issueId, newStatusId);
      // Update in local state list
      setIssuesList((prev) =>
        prev.map((iss) => (iss.id === issueId ? { ...iss, statusId: newStatusId, status: updated.status } : iss))
      );
      if (selectedIssue && selectedIssue.id === issueId) {
        setSelectedIssue((prev) => prev ? { ...prev, statusId: newStatusId, status: updated.status } : null);
      }
    } catch (err: unknown) {
      setDetailError(err instanceof Error ? err.message : "Gagal memperbarui status tiket.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDeleteIssue = async (issueId: string) => {
    const ok = await confirm({
      title: "Hapus Tiket",
      description: "Apakah Anda yakin ingin menghapus tiket ini? Tindakan ini tidak dapat dibatalkan.",
      confirmLabel: "Ya, Hapus",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await deleteIssue(projectId, issueId);
      setIssuesList((prev) => prev.filter((iss) => iss.id !== issueId));
      setIsDetailOpen(false);
      setSelectedIssue(null);
    } catch (err) {
      console.error(err);
      await confirm({
        title: "Gagal Menghapus",
        description: "Gagal menghapus tiket. Silakan coba lagi.",
        confirmLabel: "Tutup",
        cancelLabel: "",
        variant: "destructive",
      });
    }
  };

  // Determine current user project role
  const currentMember = members.find(
    (m) => m.email === session?.user?.email || m.username === session?.user?.username
  );
  const userRole = currentMember?.role;
  const isAdmin = session?.user?.isAdmin;

  // Filter issues
  const filteredIssues = issuesList.filter((iss) => {
    const matchesStatus = filterStatus === "all" || iss.statusId === filterStatus;
    const matchesPriority = filterPriority === "all" || iss.priority === filterPriority;
    const matchesAssignee =
      filterAssignee === "all" ||
      (filterAssignee === "unassigned" && !iss.assigneeId) ||
      iss.assigneeId === filterAssignee;
    const matchesSearch =
      iss.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (iss.description && iss.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      iss.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesPriority && matchesAssignee && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar / Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Sliders className="h-3.5 w-3.5 text-muted-foreground mr-1" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-8 rounded-md border border-border bg-card px-2.5 py-1 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">Status: Semua</option>
            {statuses.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="h-8 rounded-md border border-border bg-card px-2.5 py-1 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">Prioritas: Semua</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>

          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="h-8 rounded-md border border-border bg-card px-2.5 py-1 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">Assignee: Semua</option>
            <option value="unassigned">Belum Ditugaskan</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-56">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari tiket atau ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-[12px]"
            />
          </div>
          <Button size="sm" className="h-8 text-[12px] shrink-0 font-medium" onClick={handleOpenCreateModal}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Buat Tiket
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Issues Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-20 pl-4">ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-24">Tracker</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-36">Assignee</TableHead>
              <TableHead className="w-24">Priority</TableHead>
              <TableHead className="w-28 pr-4">Due Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredIssues.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="h-28 text-center text-muted-foreground">
                  Tidak ada tiket ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              filteredIssues.map((issue) => (
                <TableRow
                  key={issue.id}
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => {
                    setSelectedIssue(issue);
                    setIsDetailOpen(true);
                    setDetailError("");
                  }}
                >
                  <TableCell className="font-mono text-[11px] text-muted-foreground pl-4">
                    #{issue.id.slice(0, 6)}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    <div className="flex items-center gap-1.5 max-w-[280px]">
                      {issue.displayId && (
                        <span className="shrink-0 inline-flex items-center rounded bg-muted/80 border border-border px-1.5 py-0.5 text-[9.5px] font-mono font-semibold text-muted-foreground uppercase">
                          {issue.displayId}
                        </span>
                      )}
                      <span className="truncate">{issue.title}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] font-medium bg-muted/30 text-muted-foreground select-none">
                      {issue.tracker?.name || "Task"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded bg-secondary px-2 py-0.5 text-[10px] font-semibold border border-border text-muted-foreground">
                      {issue.status?.name || "New"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-4.5 w-4.5">
                        <AvatarFallback className="text-[8px] font-bold">
                          {issue.assignee ? issue.assignee.name.slice(0, 2).toUpperCase() : "-"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate max-w-[100px] text-[12.5px]">
                        {issue.assignee?.name || "Unassigned"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-[11px] font-semibold capitalize ${
                        issue.priority === "urgent"
                          ? "text-red-500 font-bold"
                          : issue.priority === "high"
                          ? "text-red-400"
                          : issue.priority === "medium"
                          ? "text-amber-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {issue.priority}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-[12px] pr-4">
                    {issue.dueDate
                      ? new Date(issue.dueDate).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                        })
                      : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Issue Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[420px] max-h-[85vh] overflow-y-auto">
          <form onSubmit={handleCreateIssue}>
            <DialogHeader>
              <DialogTitle className="text-[14.5px] font-semibold">Buat Tiket Baru</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-3.5 py-4">
              {createError && (
                <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive leading-normal">
                  <AlertCircle className="h-3.5 w-3.5 mt-[1px] shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tracker-select" className="text-[11px] font-medium text-muted-foreground">
                  Tracker / Tipe Tiket
                </Label>
                <select
                  id="tracker-select"
                  value={selectedTrackerId}
                  onChange={(e) => {
                    const newTrackerId = e.target.value;
                    setSelectedTrackerId(newTrackerId);
                    const template = templates.find((t) => t.trackerId === newTrackerId);
                    if (template) {
                      setTitle(template.titlePattern || "");
                      setDescription(template.descriptionPattern || "");
                    } else {
                      setTitle("");
                      setDescription("");
                    }
                  }}
                  className="h-8 w-full rounded-md border border-input bg-card px-2 text-[12.5px] outline-none"
                  disabled={createLoading}
                >
                  {trackers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {bugTemplate && (
                <div className="rounded border border-primary/20 bg-primary/5 p-2.5 text-[11.5px] text-muted-foreground leading-relaxed">
                  Prefill teks dari template &quot;{bugTemplate.name}&quot; dimuat. Anda bebas mengubah judul dan deskripsi di bawah.
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="issue-title" className="text-[11px] font-medium text-muted-foreground">
                  Judul Tiket
                </Label>
                <Input
                  id="issue-title"
                  type="text"
                  placeholder="Masukkan judul singkat..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="h-8 text-[12.5px]"
                  disabled={createLoading}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="issue-desc" className="text-[11px] font-medium text-muted-foreground">
                  Deskripsi Masalah
                </Label>
                <textarea
                  id="issue-desc"
                  placeholder="Detail deskripsi tugas atau tiket..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-[12.5px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  disabled={createLoading}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />
                  Lampiran (Attachments)
                </Label>
                <div className="flex flex-col gap-2 rounded-md border border-input p-2 bg-card/30">
                  <input
                    type="file"
                    multiple
                    id="issue-files-input"
                    onChange={(e) => {
                      if (e.target.files) {
                        const filesArr = Array.from(e.target.files);
                        setSelectedFiles((prev) => [...prev, ...filesArr]);
                      }
                    }}
                    className="hidden"
                    disabled={createLoading}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      {selectedFiles.length === 0
                        ? "Pilih file untuk dilampirkan..."
                        : `${selectedFiles.length} file dipilih`}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10.5px] font-medium px-2"
                      onClick={() => document.getElementById("issue-files-input")?.click()}
                      disabled={createLoading}
                    >
                      Pilih File
                    </Button>
                  </div>
                  {selectedFiles.length > 0 && (
                    <div className="flex flex-col gap-1 mt-1 border-t border-border/50 pt-1.5 max-h-[100px] overflow-y-auto pr-1">
                      {selectedFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-muted/40 hover:bg-muted/70 px-2 py-0.5 rounded text-[11.5px] text-foreground group"
                        >
                          <span className="truncate max-w-[280px] font-medium">{file.name}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-2">
                            {(file.size / 1024).toFixed(1)} KB
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
                              onClick={() =>
                                setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))
                              }
                              disabled={createLoading}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="h-px bg-border my-1" />

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="issue-priority" className="text-[11px] font-medium text-muted-foreground">
                    Prioritas
                  </Label>
                  <select
                    id="issue-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high' | 'urgent')}
                    className="h-8 rounded-md border border-input bg-card px-2 text-[12.5px] outline-none"
                    disabled={createLoading}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="issue-assignee" className="text-[11px] font-medium text-muted-foreground">
                    Assignee
                  </Label>
                  <select
                    id="issue-assignee"
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="h-8 rounded-md border border-input bg-card px-2 text-[12.5px] outline-none"
                    disabled={createLoading}
                  >
                    <option value="">Belum Ditugaskan</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="issue-duedate" className="text-[11px] font-medium text-muted-foreground">
                  Due Date (Batas Waktu)
                </Label>
                <Input
                  id="issue-duedate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-8 text-[12.5px]"
                  disabled={createLoading}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-8 text-[12px]"
                onClick={() => setIsCreateOpen(false)}
                disabled={createLoading}
              >
                Batal
              </Button>
              <Button type="submit" className="h-8 text-[12px]" disabled={createLoading}>
                {createLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Membuat...
                  </>
                ) : (
                  "Buat Tiket"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Issue Dialog/Drawer */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[460px]">
          {selectedIssue && (
            <div className="flex flex-col gap-4">
              <DialogHeader className="border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">#{selectedIssue.id}</span>
                  <span className="rounded bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[9px] font-semibold text-primary uppercase">
                    {selectedIssue.tracker?.name || "Task"}
                  </span>
                </div>
                <DialogTitle className="text-[15px] font-semibold mt-1 leading-normal text-foreground flex items-center gap-2">
                  {selectedIssue.displayId && (
                    <span className="inline-flex items-center rounded bg-muted border border-border px-1.5 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground uppercase">
                      {selectedIssue.displayId}
                    </span>
                  )}
                  <span>{selectedIssue.title}</span>
                </DialogTitle>
              </DialogHeader>

              {detailError && (
                <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive leading-normal">
                  <AlertCircle className="h-3.5 w-3.5 mt-[1px] shrink-0" />
                  <span>{detailError}</span>
                </div>
              )}

              <div className="flex flex-col gap-4 py-2">
                {/* Description content */}
                <div className="flex flex-col gap-1.5 bg-muted/20 border border-border p-3 rounded-lg">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Deskripsi / Detail Tiket
                  </span>
                  <div className="text-[12.5px] leading-relaxed text-foreground whitespace-pre-wrap mt-1">
                    {selectedIssue.description || "Tidak ada deskripsi rinci untuk tiket ini."}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Status update with role validator */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[11px] font-medium text-muted-foreground">Status Tiket</Label>
                    <select
                      value={selectedIssue.statusId}
                      onChange={(e) => handleStatusChange(selectedIssue.id, e.target.value)}
                      disabled={detailLoading}
                      className="h-8 rounded-md border border-input bg-card px-2 text-[12.5px] outline-none"
                    >
                      {statuses.map((st) => {
                        // Sembunyikan atau disable jika restrictedToRole tidak sesuai
                        const isRestricted = st.restrictedToRole !== null;
                        const isRoleMatched = st.restrictedToRole === userRole;
                        const disabled = isRestricted && !isRoleMatched && !isAdmin;

                        return (
                          <option key={st.id} value={st.id} disabled={disabled}>
                            {st.name} {disabled ? "🔒 (Hanya QA)" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[11px] font-medium text-muted-foreground">Prioritas</Label>
                    <div className="h-8 border border-border bg-muted/20 rounded-md flex items-center px-2.5 text-[12.5px] capitalize font-medium">
                      {selectedIssue.priority}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[11px] font-medium text-muted-foreground">Ditugaskan Kepada</Label>
                    <div className="flex items-center gap-2 h-8">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[9px] font-bold">
                          {selectedIssue.assignee ? selectedIssue.assignee.name.slice(0, 2).toUpperCase() : "-"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[12.5px] truncate">
                        {selectedIssue.assignee?.name || "Belum ditugaskan"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[11px] font-medium text-muted-foreground">Batas Waktu (Due Date)</Label>
                    <div className="flex items-center gap-2 h-8 text-[12.5px] text-foreground font-medium">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      {selectedIssue.dueDate
                        ? new Date(selectedIssue.dueDate).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : "Tidak ditentukan"}
                    </div>
                  </div>
                </div>

                {/* Attachments Section */}
                <div className="flex flex-col gap-1.5 border-t border-border/60 pt-3 mt-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Paperclip className="h-3 w-3" />
                    Lampiran ({attachments.length})
                  </span>
                  {attachmentsLoading ? (
                    <div className="flex items-center gap-1.5 py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Memuat lampiran...
                    </div>
                  ) : attachments.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic py-1">
                      Tidak ada lampiran untuk tiket ini.
                    </span>
                  ) : (
                    <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-1 mt-1">
                      {attachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center justify-between border border-border/80 bg-muted/20 hover:bg-muted/40 px-2.5 py-1 rounded-md text-[12px] group"
                        >
                          <a
                            href={`/uploads/${att.r2ObjectKey}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={att.fileName}
                            className="font-medium text-foreground hover:underline truncate max-w-[320px] flex items-center gap-1.5"
                          >
                            <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                            {att.fileName}
                          </a>
                          {(att.uploadedBy === session?.user?.id || session?.user?.isAdmin) && (
                            <button
                              type="button"
                              onClick={() => handleDeleteAttachment(att.id)}
                              className="text-muted-foreground hover:text-destructive shrink-0 ml-2"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="border-t border-border pt-3 mt-2 flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 text-[12px] text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
                  onClick={() => handleDeleteIssue(selectedIssue.id)}
                  disabled={detailLoading}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Hapus Tiket
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 text-[12px]"
                  onClick={() => setIsDetailOpen(false)}
                  disabled={detailLoading}
                >
                  Tutup
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
