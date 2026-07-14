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
  Issue,
  IssueStatus,
  Tracker,
  ProjectMember,
  IssueTemplate,
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
} from "lucide-react";

interface IssuesSectionProps {
  projectId: string;
}

export default function IssuesSection({ projectId }: IssuesSectionProps) {
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

  // Dynamic template fields state
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [titleValues, setTitleValues] = useState<Record<string, string>>({});

  // Detail Issue Dialog state
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

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

  // Find the selected tracker
  const activeTracker = trackers.find((t) => t.id === selectedTrackerId);
  const isBugTracker = activeTracker?.name === "Bug";
  // Find matching template
  const bugTemplate = templates.find((t) => t.trackerId === selectedTrackerId);

  // Extract placeholder keys from titlePattern
  const getTitlePatternPlaceholders = (pattern: string | null) => {
    if (!pattern) return [];
    const regex = /\{([a-zA-Z0-9_-]+)\}/g;
    const placeholders = [];
    let match;
    while ((match = regex.exec(pattern)) !== null) {
      placeholders.push(match[1]);
    }
    return placeholders;
  };

  const titlePlaceholders = bugTemplate ? getTitlePatternPlaceholders(bugTemplate.titlePattern) : [];

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrackerId) return;

    setCreateLoading(true);
    setCreateError("");

    try {
      if (isBugTracker && bugTemplate) {
        // Validate required template fields
        for (const field of bugTemplate.fields) {
          if (field.required && !fieldValues[field.label]?.trim()) {
            throw new Error(`Field "${field.label}" wajib diisi.`);
          }
        }
        // Validate title placeholders
        for (const placeholder of titlePlaceholders) {
          if (!titleValues[placeholder]?.trim()) {
            throw new Error(`Field judul "${placeholder}" wajib diisi.`);
          }
        }

        await createIssue(projectId, {
          trackerId: selectedTrackerId,
          statusId: statusId || undefined,
          templateId: bugTemplate.id,
          titleValues,
          fieldValues,
          priority,
          assigneeId: assigneeId || null,
          dueDate: dueDate || null,
        });
      } else {
        if (!title.trim()) {
          throw new Error("Judul tiket wajib diisi.");
        }
        await createIssue(projectId, {
          trackerId: selectedTrackerId,
          title,
          description,
          statusId: statusId || undefined,
          priority,
          assigneeId: assigneeId || null,
          dueDate: dueDate || null,
        });
      }

      setIsCreateOpen(false);
      // Reset states
      setTitle("");
      setDescription("");
      setFieldValues({});
      setTitleValues({});
      setPriority("medium");
      setAssigneeId("");
      setDueDate("");
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
    if (!confirm("Apakah Anda yakin ingin menghapus tiket ini?")) return;
    try {
      await deleteIssue(projectId, issueId);
      setIssuesList((prev) => prev.filter((iss) => iss.id !== issueId));
      setIsDetailOpen(false);
      setSelectedIssue(null);
    } catch (err) {
      console.error(err);
      alert("Gagal menghapus tiket.");
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
          <Button size="sm" className="h-8 text-[12px] shrink-0 font-medium" onClick={() => setIsCreateOpen(true)}>
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
                  <TableCell className="font-medium text-foreground truncate max-w-[220px]">
                    {issue.title}
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
                    setSelectedTrackerId(e.target.value);
                    setFieldValues({});
                    setTitleValues({});
                    setTitle("");
                    setDescription("");
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

              {/* Dynamic form from template if Bug tracker and bugTemplate exists */}
              {isBugTracker && bugTemplate ? (
                <>
                  <div className="rounded border border-primary/20 bg-primary/5 p-2.5 text-[11.5px] text-muted-foreground leading-relaxed">
                    Menampilkan form laporan Bug kustom. Judul akan otomatis digenerate dari pattern template.
                  </div>

                  {/* Title Placeholders Inputs */}
                  {titlePlaceholders.map((ph) => (
                    <div key={ph} className="flex flex-col gap-1.5">
                      <Label htmlFor={`title-ph-${ph}`} className="text-[11px] font-medium text-muted-foreground capitalize">
                        {ph} <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id={`title-ph-${ph}`}
                        type="text"
                        placeholder={`Masukkan ${ph}...`}
                        value={titleValues[ph] || ""}
                        onChange={(e) => setTitleValues({ ...titleValues, [ph]: e.target.value })}
                        required
                        className="h-8 text-[12.5px]"
                        disabled={createLoading}
                      />
                    </div>
                  ))}

                  {/* Dynamic Template Fields */}
                  {bugTemplate.fields.map((field) => (
                    <div key={field.label} className="flex flex-col gap-1.5">
                      <Label htmlFor={`field-${field.label}`} className="text-[11px] font-medium text-muted-foreground">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </Label>
                      {field.label.toLowerCase().includes("reproduce") || field.label.toLowerCase().includes("result") || field.label.toLowerCase().includes("description") ? (
                        <textarea
                          id={`field-${field.label}`}
                          placeholder={field.helperText || `Masukkan ${field.label}...`}
                          required={field.required}
                          value={fieldValues[field.label] || ""}
                          onChange={(e) => setFieldValues({ ...fieldValues, [field.label]: e.target.value })}
                          className="min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-[12.5px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          disabled={createLoading}
                        />
                      ) : (
                        <Input
                          id={`field-${field.label}`}
                          type="text"
                          placeholder={field.helperText || `Masukkan ${field.label}...`}
                          required={field.required}
                          value={fieldValues[field.label] || ""}
                          onChange={(e) => setFieldValues({ ...fieldValues, [field.label]: e.target.value })}
                          className="h-8 text-[12.5px]"
                          disabled={createLoading}
                        />
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <>
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
                </>
              )}

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
                <DialogTitle className="text-[15px] font-semibold mt-1 leading-normal text-foreground">
                  {selectedIssue.title}
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
