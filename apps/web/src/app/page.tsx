"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession, logout, UserSession } from "@/lib/auth-service";
import { getProjects, createProject, Project } from "@/lib/projects-service";
import {
  getIssues,
  createIssue,
  deleteIssue,
  getProjectStatuses,
  getTrackers,
  getProjectMembers,
  createProjectStatus,
  updateProjectStatus,
  deleteProjectStatus,
  reorderProjectStatuses,
  getProjectTemplates,
  createProjectTemplate,
  updateProjectTemplate,
  deleteProjectTemplate,
  Issue,
  IssueStatus,
  Tracker,
  ProjectMember,
  IssueTemplate,
  TemplateField
} from "@/lib/issues-service";
import {
  getTimeBlocks,
  deleteTimeBlock,
  overrideTimeBlock,
  TimeBlock
} from "@/lib/time-service";
import {
  getTimesheets,
  getTimesheetDetail,
  createTimesheet,
  submitTimesheet,
  approveTimesheet,
  getManualEntries,
  createManualEntry,
  Timesheet,
  ManualTimeEntry
} from "@/lib/timesheet-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
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
  LogOut,
  Folder,
  Briefcase,
  Clock,
  Settings,
  LineChart,
  CheckSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ChevronDown,
  Search,
  Sliders,
  Users,
  AlertCircle,
  Trash,
  ArrowUp,
  ArrowDown,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
} from "lucide-react";

type ActiveSection = "issues" | "timebook" | "reports" | "settings";

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>("issues");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  
  // Create Project State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [projName, setProjName] = useState("");
  const [projDesc, setProjDesc] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  // Logout state
  const [logoutLoading, setLogoutLoading] = useState(false);

  // Fetch initial session & projects
  useEffect(() => {
    async function init() {
      try {
        const sessionData = await getSession();
        if (!sessionData) {
          router.push("/auth");
          return;
        }
        setSession(sessionData);

        const projectList = await getProjects();
        setProjects(projectList);
        if (projectList.length > 0) {
          setSelectedProject(projectList[0]);
        }
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await logout();
      router.push("/auth");
    } catch (err) {
      console.error(err);
      setLogoutLoading(false);
    }
  };

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName.trim()) return;
    setCreateLoading(true);
    setCreateError("");
    try {
      const newProj = await createProject(projName, projDesc || undefined);
      setProjects((prev) => [...prev, newProj]);
      setSelectedProject(newProj);
      setIsCreateOpen(false);
      setProjName("");
      setProjDesc("");
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Gagal membuat proyek");
    } finally {
      setCreateLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground font-medium">Memuat TrackFlow...</p>
        </div>
      </div>
    );
  }

  const user = session?.user;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans antialiased">
      
      {/* ── LEFT COLLAPSIBLE SIDEBAR ── */}
      <aside
        className={`h-full border-r border-border bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-150 ease-in-out shrink-0 select-none ${
          sidebarOpen ? "w-60" : "w-14"
        }`}
      >
        {/* Sidebar Header: Project Switcher */}
        <div className="h-12 border-b border-sidebar-border flex items-center justify-between px-3">
          {sidebarOpen ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button className="flex items-center gap-2 text-left w-full hover:bg-sidebar-accent/50 p-1.5 rounded-md transition-colors text-[13px] font-medium truncate outline-none" />
                }
              >
                <div className="flex h-5.5 w-5.5 items-center justify-center rounded bg-primary text-primary-foreground font-bold text-xs uppercase shrink-0">
                  {selectedProject ? selectedProject.name.slice(0, 2) : "TF"}
                </div>
                <span className="truncate flex-1">
                  {selectedProject ? selectedProject.name : "Pilih Proyek"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 border-border bg-popover text-popover-foreground">
                <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-1.5 px-2">
                  Proyek Anda
                </DropdownMenuLabel>
                {projects.map((proj) => (
                  <DropdownMenuItem
                    key={proj.id}
                    onClick={() => setSelectedProject(proj)}
                    className="flex items-center gap-2 text-[13px] py-1.5 px-2 cursor-pointer focus:bg-accent focus:text-accent-foreground"
                  >
                    <div className="flex h-5 w-5 items-center justify-center rounded bg-secondary text-secondary-foreground font-bold text-[10px] uppercase shrink-0">
                      {proj.name.slice(0, 2)}
                    </div>
                    <span className="truncate flex-1">{proj.name}</span>
                  </DropdownMenuItem>
                ))}
                {projects.length === 0 && (
                  <div className="text-[12px] text-muted-foreground px-2 py-3 text-center">
                    Belum ada proyek.
                  </div>
                )}
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  onClick={() => setIsCreateOpen(true)}
                  className="flex items-center gap-2 text-[13px] py-1.5 px-2 cursor-pointer text-primary focus:bg-accent focus:text-accent-foreground"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span>Buat Proyek Baru</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex h-8 w-8 mx-auto items-center justify-center rounded bg-primary text-primary-foreground font-bold text-xs uppercase shrink-0">
              {selectedProject ? selectedProject.name.slice(0, 2) : "TF"}
            </div>
          )}
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 py-3 px-2 flex flex-col gap-0.5">
          {[
            { id: "issues", label: "Issues", icon: CheckSquare },
            { id: "timebook", label: "Time Book", icon: Clock },
            { id: "reports", label: "Reports", icon: LineChart },
            { id: "settings", label: "Settings", icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id as ActiveSection)}
                className={`flex items-center gap-2.5 rounded-md text-[13px] font-medium px-2.5 py-1.5 w-full text-left transition-colors cursor-pointer outline-none ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
                }`}
                title={item.label}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-sidebar-primary" : "text-muted-foreground"}`} />
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: User Profile dropdown */}
        <div className="border-t border-sidebar-border p-2">
          {sidebarOpen ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button className="flex items-center gap-2.5 w-full hover:bg-sidebar-accent/50 p-1.5 rounded-md transition-colors text-left outline-none" />
                }
              >
                <Avatar className="h-6.5 w-6.5 rounded-full border border-border">
                  <AvatarFallback className="text-[10px] font-bold bg-secondary text-secondary-foreground">
                    {user?.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold truncate leading-tight text-foreground">
                    {user?.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate leading-none mt-0.5 font-mono">
                    @{user?.username}
                  </p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 border-border bg-popover text-popover-foreground">
                <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-1 px-2">
                  Akun Anda
                </DropdownMenuLabel>
                <div className="px-2 py-1.5 text-[12px] text-foreground">
                  <div className="font-semibold">{user?.name}</div>
                  <div className="text-muted-foreground font-mono text-[10px] truncate">{user?.email}</div>
                  {user?.position && (
                    <div className="text-muted-foreground text-[11px] mt-1 italic flex items-center gap-1">
                      <Briefcase className="h-3 w-3 shrink-0" />
                      <span>{user.position}</span>
                    </div>
                  )}
                </div>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  disabled={logoutLoading}
                  className="flex items-center gap-2 text-[13px] py-1.5 px-2 cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  {logoutLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  ) : (
                    <LogOut className="h-4 w-4 shrink-0" />
                  )}
                  <span>Keluar Akun</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex justify-center">
              <Avatar className="h-7 w-7 rounded-full border border-border">
                <AvatarFallback className="text-[10px] font-bold bg-secondary text-secondary-foreground">
                  {user?.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background">
        
        {/* Top Header */}
        <header className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0 select-none">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-muted-foreground hover:text-foreground hover:bg-accent/40 p-1.5 rounded-md transition-colors cursor-pointer outline-none"
              title={sidebarOpen ? "Sembunyikan Sidebar" : "Tampilkan Sidebar"}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </button>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>TrackFlow</span>
              <span>/</span>
              {selectedProject && (
                <>
                  <span className="font-semibold text-foreground">{selectedProject.name}</span>
                  <span>/</span>
                </>
              )}
              <span className="capitalize">{activeSection}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick search input */}
            <div className="relative w-48 sm:w-60">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Cari..."
                className="w-full text-xs h-7 pl-8 pr-3 border border-border bg-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring text-foreground placeholder-muted-foreground"
              />
            </div>
          </div>
        </header>

        {/* Dynamic section body */}
        <div className="flex-1 overflow-y-auto">
          {!selectedProject ? (
            <div className="flex flex-col items-center justify-center h-full max-w-sm mx-auto text-center px-4">
              <div className="h-10 w-10 rounded-full border border-border flex items-center justify-center bg-card mb-4 text-muted-foreground">
                <Folder className="h-5 w-5" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Belum ada proyek</h2>
              <p className="text-xs text-muted-foreground mt-1 mb-4 leading-normal">
                Buat proyek baru terlebih dahulu untuk mulai mengelola task issues dan melacak waktu kerja.
              </p>
              <Button onClick={() => setIsCreateOpen(true)} className="h-8 text-xs font-medium cursor-pointer">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Buat Proyek Baru
              </Button>
            </div>
          ) : (
            <div className="p-5 max-w-7xl mx-auto space-y-6">
              {activeSection === "issues" && <IssuesSection project={selectedProject} />}
              {activeSection === "timebook" && <TimebookSection project={selectedProject} isAdmin={session?.user?.isAdmin || false} />}
              {activeSection === "reports" && <ReportsSection project={selectedProject} session={session} isAdmin={session?.user?.isAdmin || false} />}
              {activeSection === "settings" && <SettingsSection project={selectedProject} />}
            </div>
          )}
        </div>
      </main>

      {/* ── CREATE PROJECT DIALOG ── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[425px] border-border bg-popover text-popover-foreground p-5">
          <DialogHeader className="p-0 mb-4">
            <DialogTitle className="text-sm font-semibold">Buat Proyek Baru</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProjectSubmit} className="space-y-4">
            {createError && (
              <div className="flex items-start gap-2 text-xs border border-destructive/20 bg-destructive/10 p-2.5 rounded text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-[1px]" />
                <span>{createError}</span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="proj-name" className="text-xs text-muted-foreground">Nama Proyek</Label>
              <Input
                id="proj-name"
                required
                placeholder="Contoh: TrackFlow Frontend"
                value={projName}
                onChange={(e) => setProjName(e.target.value)}
                className="text-xs h-8 border-border bg-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-desc" className="text-xs text-muted-foreground">Deskripsi (Opsional)</Label>
              <Input
                id="proj-desc"
                placeholder="Deskripsi singkat proyek..."
                value={projDesc}
                onChange={(e) => setProjDesc(e.target.value)}
                className="text-xs h-8 border-border bg-input"
              />
            </div>
            <DialogFooter className="p-0 mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="h-8 text-xs border-border bg-transparent hover:bg-accent hover:text-accent-foreground cursor-pointer"
              >
                Batal
              </Button>
              <Button type="submit" disabled={createLoading} className="h-8 text-xs font-medium cursor-pointer">
                {createLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Proyek"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// -----------------------------------------------------------------------------
// SUB-SECTIONS (Skeletons/Mocks following Linear/Plane high-density spec)
// -----------------------------------------------------------------------------

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border pb-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function IssuesSection({ project }: { project: Project }) {
  const [issuesList, setIssuesList] = useState<Issue[]>([]);
  const [statuses, setStatuses] = useState<IssueStatus[]>([]);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create Issue state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [statusId, setStatusId] = useState("");
  const [trackerId, setTrackerId] = useState("");
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>("medium");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  // Filter states
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Load issues and configuration details helper
  const fetchProjectData = React.useCallback(() => {
    return Promise.all([
      getIssues(project.id),
      getProjectStatuses(project.id),
      getTrackers(),
      getProjectMembers(project.id),
    ]).then(([issuesData, statusesData, trackersData, membersData]) => {
      setIssuesList(issuesData);
      setStatuses(statusesData);
      setTrackers(trackersData);
      setMembers(membersData);
      return { statusesData, trackersData };
    });
  }, [project.id]);

  useEffect(() => {
    let active = true;

    // Use asynchronous promise chain to avoid synchronous setState inside useEffect body
    Promise.resolve().then(() => {
      if (!active) return;
      setLoading(true);
      setError("");
      return fetchProjectData();
    })
    .then((res) => {
      if (!res || !active) return;
      const { statusesData, trackersData } = res;
      if (statusesData.length > 0) setStatusId(statusesData[0].id);
      if (trackersData.length > 0) setTrackerId(trackersData[0].id);
    })
    .catch((err) => {
      if (!active) return;
      console.error(err);
      setError("Gagal memuat data issues.");
    })
    .finally(() => {
      if (!active) return;
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [project.id, fetchProjectData]);

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !statusId || !trackerId) return;
    setCreateLoading(true);
    setCreateError("");
    try {
      await createIssue(project.id, {
        title,
        description: description || undefined,
        statusId,
        trackerId,
        priority,
        assigneeId: assigneeId || null,
        dueDate: dueDate || null,
      });
      setIsCreateOpen(false);
      // Reset form
      setTitle("");
      setDescription("");
      setPriority("medium");
      setAssigneeId("");
      setDueDate("");
      // Reload issues
      await fetchProjectData();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Gagal membuat issue");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteIssue = async (issueId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus issue ini?")) return;
    try {
      await deleteIssue(project.id, issueId);
      setIssuesList((prev) => prev.filter((iss) => iss.id !== issueId));
    } catch (err) {
      console.error(err);
      alert("Gagal menghapus issue");
    }
  };

  const filteredIssues = issuesList.filter((iss) => {
    const matchesStatus = filterStatus === "all" || iss.statusId === filterStatus;
    const matchesPriority = filterPriority === "all" || iss.priority === filterPriority;
    const matchesAssignee =
      filterAssignee === "all" ||
      (filterAssignee === "unassigned" && !iss.assigneeId) ||
      iss.assigneeId === filterAssignee;
    const matchesSearch =
      iss.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (iss.description && iss.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesPriority && matchesAssignee && matchesSearch;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-7 w-20 bg-muted animate-pulse rounded" />
        </div>
        <div className="h-9 w-full bg-muted animate-pulse rounded" />
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-10 w-full bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Issues Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Issues — {project.name}</h2>
          <p className="text-xs text-muted-foreground">Kelola backlog tugas dan status development proyek.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="h-7 text-xs font-medium px-2.5 cursor-pointer">
          <Plus className="h-3.5 w-3.5 mr-1" /> Buat Issue
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs border border-destructive/20 bg-destructive/10 p-2.5 rounded text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-[1px]" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 text-xs border border-border bg-card/40 p-2 rounded-md justify-between items-start sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <Sliders className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground mr-1">Filter:</span>
          
          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-input border border-border text-[11px] rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">Status: Semua</option>
            {statuses.map((st) => (
              <option key={st.id} value={st.id}>{st.name}</option>
            ))}
          </select>

          {/* Priority filter */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="bg-input border border-border text-[11px] rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">Prioritas: Semua</option>
            <option value="low">Rendah</option>
            <option value="medium">Sedang</option>
            <option value="high">Tinggi</option>
            <option value="urgent">Mendesak</option>
          </select>

          {/* Assignee filter */}
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="bg-input border border-border text-[11px] rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">Assignee: Semua</option>
            <option value="unassigned">Belum Ditugaskan</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Local search in issues */}
        <div className="relative w-full sm:w-48 shrink-0 mt-1 sm:mt-0">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cari issue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-[11px] h-6 pl-7 pr-2 border border-border bg-input rounded focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* High Density Issue List */}
      <div className="border border-border rounded-md overflow-hidden bg-card">
        {filteredIssues.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            Tidak ada issue yang cocok dengan filter atau pencarian Anda.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredIssues.map((issue) => (
              <div
                key={issue.id}
                className="flex items-center justify-between py-2 px-3 hover:bg-accent/40 transition-colors text-xs group cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-[10px] text-muted-foreground select-all w-16 shrink-0 font-medium">
                    #{issue.id.slice(0, 6)}
                  </span>
                  {/* Tracker indicator */}
                  <span className="text-[10px] text-muted-foreground border border-border px-1 py-0.25 rounded bg-muted/30 shrink-0 select-none">
                    {issue.tracker?.name || "Task"}
                  </span>
                  <span className="font-medium text-foreground truncate">{issue.title}</span>
                </div>
                
                <div className="flex items-center gap-4 shrink-0 ml-4 text-[11px]">
                  {/* Status Badge */}
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold border border-border bg-secondary text-muted-foreground">
                    {issue.status?.name || "Baru"}
                  </span>
                  
                  {/* Priority indicator */}
                  <span className={`font-semibold capitalize text-[10px] ${
                    issue.priority === "urgent" ? "text-red-500 font-bold" :
                    issue.priority === "high" ? "text-red-400" :
                    issue.priority === "medium" ? "text-amber-400" :
                    "text-muted-foreground"
                  }`}>
                    {issue.priority}
                  </span>

                  {/* Assignee initials */}
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-[9px] font-bold border border-border" title={issue.assignee?.name || "Belum Ditugaskan"}>
                    {issue.assignee ? issue.assignee.name.slice(0, 2).toUpperCase() : "-"}
                  </div>

                  {/* Due date */}
                  <span className="text-muted-foreground/80 font-mono text-[10px] hidden sm:inline select-none">
                    {issue.dueDate ? new Date(issue.dueDate).toLocaleDateString("id-ID", { day: 'numeric', month: 'short' }) : "-"}
                  </span>

                  {/* Delete action visible on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteIssue(issue.id);
                    }}
                    className="p-1 hover:bg-destructive/10 hover:text-destructive text-muted-foreground rounded transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                    title="Hapus Issue"
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── CREATE ISSUE DIALOG ── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[480px] border-border bg-popover text-popover-foreground p-5">
          <DialogHeader className="p-0 mb-4">
            <DialogTitle className="text-sm font-semibold">Buat Issue Baru</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateIssue} className="space-y-4">
            {createError && (
              <div className="flex items-start gap-2 text-xs border border-destructive/20 bg-destructive/10 p-2.5 rounded text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-[1px]" />
                <span>{createError}</span>
              </div>
            )}
            
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="issue-title" className="text-xs text-muted-foreground">Judul Issue <span className="text-destructive">*</span></Label>
              <Input
                id="issue-title"
                required
                placeholder="Contoh: Perbaikan UI/UX Input Form"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-xs h-8 border-border bg-input"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="issue-desc" className="text-xs text-muted-foreground">Deskripsi (Opsional)</Label>
              <textarea
                id="issue-desc"
                placeholder="Masukkan rincian deskripsi issue..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-border bg-input p-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring placeholder-muted-foreground resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Tracker */}
              <div className="space-y-1.5">
                <Label htmlFor="issue-tracker" className="text-xs text-muted-foreground">Tracker <span className="text-destructive">*</span></Label>
                <select
                  id="issue-tracker"
                  required
                  value={trackerId}
                  onChange={(e) => setTrackerId(e.target.value)}
                  className="w-full text-xs h-8 rounded-md border border-border bg-input px-2.5 focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {trackers.map((tr) => (
                    <option key={tr.id} value={tr.id}>{tr.name}</option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <Label htmlFor="issue-status" className="text-xs text-muted-foreground">Status <span className="text-destructive">*</span></Label>
                <select
                  id="issue-status"
                  required
                  value={statusId}
                  onChange={(e) => setStatusId(e.target.value)}
                  className="w-full text-xs h-8 rounded-md border border-border bg-input px-2.5 focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {statuses.map((st) => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <Label htmlFor="issue-priority" className="text-xs text-muted-foreground">Prioritas</Label>
                <select
                  id="issue-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high' | 'urgent')}
                  className="w-full text-xs h-8 rounded-md border border-border bg-input px-2.5 focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="low">Rendah</option>
                  <option value="medium">Sedang</option>
                  <option value="high">Tinggi</option>
                  <option value="urgent">Mendesak</option>
                </select>
              </div>

              {/* Assignee */}
              <div className="space-y-1.5">
                <Label htmlFor="issue-assignee" className="text-xs text-muted-foreground">Assignee</Label>
                <select
                  id="issue-assignee"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full text-xs h-8 rounded-md border border-border bg-input px-2.5 focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Belum Ditugaskan</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Due date */}
            <div className="space-y-1.5">
              <Label htmlFor="issue-due" className="text-xs text-muted-foreground">Tanggal Tenggat (Due Date)</Label>
              <Input
                id="issue-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="text-xs h-8 border-border bg-input block w-full"
              />
            </div>

            <DialogFooter className="p-0 mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="h-8 text-xs border-border bg-transparent hover:bg-accent hover:text-accent-foreground cursor-pointer"
              >
                Batal
              </Button>
              <Button type="submit" disabled={createLoading} className="h-8 text-xs font-medium cursor-pointer">
                {createLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Buat Issue"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TimebookSection({ project, isAdmin }: { project: Project; isAdmin: boolean }) {
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeDate, setActiveDate] = useState<string>(() => {
    return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
  });

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Self-delete block state
  const [deleteModalBlockId, setDeleteModalBlockId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteActionLoading, setDeleteActionLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Admin override block state
  const [overrideModalBlock, setOverrideModalBlock] = useState<TimeBlock | null>(null);
  const [overrideAction, setOverrideAction] = useState<"delete" | "mark_unpaid">("delete");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideActionLoading, setOverrideActionLoading] = useState(false);
  const [overrideError, setOverrideError] = useState("");

  // Helper: Get Monday and Sunday date strings for the week of activeDate
  const getWeekRangeOfDate = React.useCallback((dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    // Adjust to Monday (1) as start of week. If Sunday (0), shift by -6
    const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diffToMonday));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return {
      startDate: monday.toLocaleDateString("en-CA"),
      endDate: sunday.toLocaleDateString("en-CA"),
    };
  }, []);

  const fetchTimeBookData = React.useCallback(() => {
    const { startDate, endDate } = getWeekRangeOfDate(activeDate);
    // Fetch time blocks for the selected week
    return getTimeBlocks(project.id, startDate, endDate).then((blocks) => {
      setTimeBlocks(blocks);
    });
  }, [project.id, activeDate, getWeekRangeOfDate]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setLoading(true);
      setError("");
      return fetchTimeBookData();
    })
    .catch((err) => {
      if (!active) return;
      console.error(err);
      setError("Gagal memuat catatan pelacakan waktu.");
    })
    .finally(() => {
      if (!active) return;
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [fetchTimeBookData]);

  // Generate calendar days (Mon to Sun) of current activeDate week
  const getWeekDays = () => {
    const d = new Date(activeDate);
    const day = d.getDay();
    const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diffToMonday));

    return Array.from({ length: 7 }).map((_, idx) => {
      const current = new Date(monday);
      current.setDate(monday.getDate() + idx);
      const dateStr = current.toLocaleDateString("en-CA");
      const name = current.toLocaleDateString("id-ID", { weekday: "short" });
      const num = current.getDate();
      return { dateStr, name, num };
    });
  };

  // Filter blocks for activeDate
  const activeDateBlocks = timeBlocks.filter((b) => b.blockStart.startsWith(activeDate));

  // Compute daily hours text
  const getDailyHoursText = () => {
    const mins = activeDateBlocks.length * 10;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}j ${m}m` : `${m}m`;
  };

  // Compute weekly hours text
  const getWeeklyHoursText = () => {
    const mins = timeBlocks.length * 10;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}j ${m}m` : `${m}m`;
  };

  // self-delete submission
  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteModalBlockId || !deleteReason.trim()) return;

    setDeleteActionLoading(true);
    setDeleteError("");

    try {
      await deleteTimeBlock(deleteModalBlockId, deleteReason.trim());
      setDeleteModalBlockId(null);
      setDeleteReason("");
      await fetchTimeBookData();
    } catch (err: unknown) {
      console.error(err);
      setDeleteError(err instanceof Error ? err.message : "Gagal menghapus blok waktu");
    } finally {
      setDeleteActionLoading(false);
    }
  };

  // admin override submission
  const handleConfirmOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideModalBlock || !overrideReason.trim()) return;

    setOverrideActionLoading(true);
    setOverrideError("");

    try {
      await overrideTimeBlock(overrideModalBlock.id, overrideAction, overrideReason.trim());
      setOverrideModalBlock(null);
      setOverrideReason("");
      await fetchTimeBookData();
    } catch (err: unknown) {
      console.error(err);
      setOverrideError(err instanceof Error ? err.message : "Gagal menyimpan aksi override");
    } finally {
      setOverrideActionLoading(false);
    }
  };

  // Filter only blocks containing screenshots
  const screenshotBlocks = activeDateBlocks.filter((b) => b.screenshot !== null);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        </div>
        <div className="space-y-4">
          <div className="h-32 w-full bg-muted animate-pulse rounded-md" />
          <div className="h-44 w-full bg-muted animate-pulse rounded-md" />
          <div className="h-56 w-full bg-muted animate-pulse rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12">
      {/* Timebook Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Time Book — {project.name}</h2>
          <p className="text-xs text-muted-foreground">Catatan pelacakan waktu kerja dan screenshot log aktivitas kerja.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs border border-destructive/20 bg-destructive/10 p-2.5 rounded text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-[1px]" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Active Date Card */}
        <div className="border border-border bg-card p-4 rounded-md flex flex-col justify-between h-28">
          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Tanggal Terpilih</span>
          <div>
            <h3 className="text-lg font-semibold tracking-tight">
              {new Date(activeDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Klik kalender strip di bawah untuk ganti hari</p>
          </div>
        </div>

        {/* Daily Stats */}
        <div className="border border-border bg-card p-4 rounded-md flex flex-col justify-between h-28">
          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Total Hari Ini</span>
          <div>
            <h3 className="text-2xl font-semibold tracking-tight">{getDailyHoursText()}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Dari total 10-menit slot tersinkronisasi</p>
          </div>
        </div>

        {/* Weekly Stats */}
        <div className="border border-border bg-card p-4 rounded-md flex flex-col justify-between h-28">
          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Total Minggu Ini</span>
          <div>
            <h3 className="text-2xl font-semibold tracking-tight">{getWeeklyHoursText()}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Senin - Minggu minggu ini</p>
          </div>
        </div>
      </div>

      {/* Week Calendar Strip (Linear/Plane style) */}
      <div className="border border-border bg-card p-4 rounded-md">
        <h3 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">Pilih Hari Kerja</h3>
        <div className="grid grid-cols-7 gap-2">
          {getWeekDays().map((day) => {
            const isActive = day.dateStr === activeDate;
            // Count blocks for this specific day to display indicator
            const dayBlocks = timeBlocks.filter((b) => b.blockStart.startsWith(day.dateStr));
            const hasData = dayBlocks.length > 0;
            return (
              <button
                key={day.dateStr}
                onClick={() => setActiveDate(day.dateStr)}
                className={`py-2 px-1 rounded border text-center flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  isActive
                    ? "bg-primary border-primary text-primary-foreground font-bold"
                    : "bg-secondary/20 border-border text-foreground hover:bg-secondary/40"
                }`}
              >
                <span className="text-[10px] uppercase opacity-80">{day.name}</span>
                <span className="text-sm font-semibold">{day.num}</span>
                {hasData && (
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-primary-foreground" : "bg-emerald-500 animate-pulse"}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Activity Timeline Strip */}
      <div className="border border-border bg-card p-4 rounded-md">
        <h3 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">
          Garis Waktu Aktivitas ({activeDateBlocks.length} slot terdeteksi)
        </h3>
        {activeDateBlocks.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground italic">
            Tidak ada rekaman pelacakan waktu untuk hari terpilih.
          </div>
        ) : (
          <div className="flex gap-1.5 items-end h-20 overflow-x-auto pb-2 scrollbar-thin">
            {activeDateBlocks.map((block) => {
              const startLocal = new Date(block.blockStart).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
              const endLocal = new Date(block.blockEnd).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
              const totalInputs = block.activity.keyboardCount + block.activity.mouseCount;

              // Height calculated based on keystroke counts (capped at max 80px)
              const height = Math.min(12 + (totalInputs / 10), 60);

              // Color based on activity level
              let colorClass = "bg-secondary border-border/40 text-muted-foreground";
              if (block.activity.activityLevel === "high") {
                colorClass = "bg-emerald-500/30 border-emerald-500/20 text-emerald-400";
              } else if (block.activity.activityLevel === "medium") {
                colorClass = "bg-emerald-500/20 border-emerald-500/10 text-emerald-400/80";
              } else if (block.activity.activityLevel === "low") {
                colorClass = "bg-amber-500/20 border-amber-500/10 text-amber-500/80";
              }

              return (
                <div
                  key={block.id}
                  style={{ height: `${height}px` }}
                  className={`w-14 rounded-t border text-center flex flex-col justify-end text-[9px] font-mono p-1 font-semibold group relative shrink-0 transition-all hover:scale-x-105 ${colorClass}`}
                >
                  <span>{startLocal}</span>
                  
                  {/* Timeline Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-popover border border-border text-popover-foreground rounded-md p-2.5 shadow-md hidden group-hover:block z-50 text-left normal-case font-sans">
                    <p className="font-semibold text-xs border-b border-border pb-1 mb-1.5 text-foreground flex justify-between">
                      <span>{startLocal} - {endLocal}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">Level: {block.activity.activityLevel}</span>
                    </p>
                    <div className="space-y-1 text-[11px] leading-relaxed">
                      <p><span className="text-muted-foreground">Aplikasi:</span> <span className="font-medium text-foreground">{block.activity.activeAppName || "-"}</span></p>
                      <p className="truncate"><span className="text-muted-foreground">Judul:</span> <span className="text-foreground">{block.activity.activeWindowTitle || "-"}</span></p>
                      <div className="flex justify-between border-t border-border/40 pt-1 mt-1 text-[10px] font-mono text-muted-foreground">
                        <span>⌨️ Ketukan: {block.activity.keyboardCount}</span>
                        <span>🖱️ Klik: {block.activity.mouseCount}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground border-t border-border/40 pt-1 mt-1 flex justify-between">
                        <span>Status Gaji:</span>
                        <span className={block.isPaid ? "text-emerald-500 font-semibold" : "text-destructive font-semibold"}>
                          {block.isPaid ? "Paid" : "Unpaid (Override)"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Screenshot Gallery Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Galeri Screenshot Kerja</h3>
        {screenshotBlocks.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-md text-xs text-muted-foreground bg-card/20 italic">
            Tidak ada tangkapan layar (screenshot) untuk hari terpilih.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
            {screenshotBlocks.map((block, index) => {
              const startLocal = new Date(block.blockStart).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
              const endLocal = new Date(block.blockEnd).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
              const imageUrl = block.screenshot!.r2ObjectKey.startsWith("http")
                ? block.screenshot!.r2ObjectKey
                : `/${block.screenshot!.r2ObjectKey}`;

              return (
                <div
                  key={block.id}
                  className="border border-border bg-card rounded-md overflow-hidden flex flex-col group relative transition-all hover:border-muted-foreground/40 shadow-sm"
                >
                  {/* Thumbnail Image Container */}
                  <div className="aspect-video w-full bg-secondary/30 relative overflow-hidden flex items-center justify-center border-b border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt={`Screenshot ${startLocal}`}
                      className="object-cover h-full w-full transition-transform duration-200 group-hover:scale-105"
                    />
                    
                    {/* Hover Overlay Controls */}
                    <div className="absolute inset-0 bg-background/70 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 z-10">
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={() => setLightboxIndex(index)}
                        className="h-8 w-8 rounded-full border border-border bg-background/80 hover:bg-background cursor-pointer"
                        title="Perbesar"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </Button>
                      
                      {/* Self-delete option */}
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => {
                          setDeleteModalBlockId(block.id);
                          setDeleteReason("");
                          setDeleteError("");
                        }}
                        className="h-8 w-8 rounded-full bg-destructive/80 hover:bg-destructive cursor-pointer border border-border"
                        title="Hapus Blok Waktu"
                      >
                        <Trash className="h-3.5 w-3.5 text-destructive-foreground" />
                      </Button>

                      {/* Admin Override option */}
                      {isAdmin && (
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => {
                            setOverrideModalBlock(block);
                            setOverrideAction("delete");
                            setOverrideReason("");
                            setOverrideError("");
                          }}
                          className="h-8 w-8 rounded-full border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 cursor-pointer"
                          title="Admin Override"
                        >
                          <Sliders className="h-3.5 w-3.5 text-amber-500" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Metadata block */}
                  <div className="p-2.5 space-y-1 text-[11px] leading-tight flex-1 flex flex-col justify-between bg-card">
                    <div>
                      <p className="font-bold text-foreground">{startLocal} - {endLocal}</p>
                      <p className="text-muted-foreground truncate mt-0.5" title={block.activity.activeAppName}>
                        {block.activity.activeAppName || "Unknown App"}
                      </p>
                    </div>
                    
                    <div className="flex justify-between items-center border-t border-border/40 pt-1.5 mt-1.5 text-[10px] font-mono text-muted-foreground">
                      <span>⌨️ {block.activity.keyboardCount}</span>
                      <span>🖱️ {block.activity.mouseCount}</span>
                    </div>

                    {!block.isPaid && (
                      <div className="mt-1 px-1 py-0.5 border border-destructive/20 bg-destructive/10 text-destructive text-[9px] font-semibold text-center rounded font-mono">
                        UNPAID OVERRIDE
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* LIGHTBOX MODAL */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 bg-background/95 z-[100] flex flex-col justify-between p-4 animate-fade-in">
          {/* Top Bar */}
          <div className="flex justify-between items-center text-foreground border-b border-border/40 pb-3">
            <div>
              <p className="font-semibold text-sm">
                Screenshot {new Date(screenshotBlocks[lightboxIndex].blockStart).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-xs text-muted-foreground">
                {screenshotBlocks[lightboxIndex].activity.activeAppName} &mdash; {screenshotBlocks[lightboxIndex].activity.activeWindowTitle}
              </p>
            </div>
            <button
              onClick={() => setLightboxIndex(null)}
              className="h-8 w-8 rounded-full border border-border bg-secondary/20 hover:bg-secondary/40 cursor-pointer flex items-center justify-center"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Main Visual Image Area */}
          <div className="flex-1 flex items-center justify-center relative my-4">
            {/* Left Navigate */}
            <button
              disabled={lightboxIndex === 0}
              onClick={() => setLightboxIndex((prev) => prev! - 1)}
              className="absolute left-2 h-10 w-10 rounded-full border border-border bg-secondary/35 hover:bg-secondary/60 cursor-pointer flex items-center justify-center text-foreground disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>

            {/* Real Screenshot Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                screenshotBlocks[lightboxIndex].screenshot!.r2ObjectKey.startsWith("http")
                  ? screenshotBlocks[lightboxIndex].screenshot!.r2ObjectKey
                  : `/${screenshotBlocks[lightboxIndex].screenshot!.r2ObjectKey}`
              }
              alt="Lightbox Screenshot"
              className="max-h-[75vh] max-w-[85vw] object-contain rounded-md border border-border shadow-xl"
            />

            {/* Right Navigate */}
            <button
              disabled={lightboxIndex === screenshotBlocks.length - 1}
              onClick={() => setLightboxIndex((prev) => prev! + 1)}
              className="absolute right-2 h-10 w-10 rounded-full border border-border bg-secondary/35 hover:bg-secondary/60 cursor-pointer flex items-center justify-center text-foreground disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>

          {/* Bottom Bar Details */}
          <div className="border-t border-border/40 pt-3 text-center text-xs text-muted-foreground font-mono flex justify-center gap-6">
            <span>⌨️ Keyboard Keystrokes: {screenshotBlocks[lightboxIndex].activity.keyboardCount}</span>
            <span>🖱️ Mouse Clicks: {screenshotBlocks[lightboxIndex].activity.mouseCount}</span>
            <span>Level: {screenshotBlocks[lightboxIndex].activity.activityLevel}</span>
          </div>
        </div>
      )}

      {/* DIALOG SELF-DELETE TIMEBLOCK */}
      <Dialog open={deleteModalBlockId !== null} onOpenChange={(open) => !open && setDeleteModalBlockId(null)}>
        <DialogContent className="sm:max-w-[425px] bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Hapus Blok Waktu Kerja</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleConfirmDelete} className="space-y-4">
            {deleteError && (
              <div className="flex items-start gap-2 text-xs border border-destructive/20 bg-destructive/10 p-2.5 rounded text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-[1px]" />
                <span>{deleteError}</span>
              </div>
            )}
            
            <p className="text-xs text-muted-foreground leading-normal">
              Menghapus blok waktu ini juga akan menghapus screenshot yang bersangkutan. Waktu kerja terhapus tidak akan dihitung dalam pembayaran/gaji. Tindakan ini tidak bisa dibatalkan.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="del-reason" className="text-xs text-muted-foreground">Alasan Penghapusan <span className="text-destructive">*</span></Label>
              <textarea
                id="del-reason"
                required
                placeholder="Tulis alasan penghapusan (mis. Membuka perbankan pribadi / urusan pribadi)"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-border bg-input p-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring placeholder-muted-foreground resize-none"
              />
            </div>

            <DialogFooter className="p-0 mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteModalBlockId(null)}
                className="h-8 text-xs border-border bg-transparent hover:bg-accent cursor-pointer"
              >
                Batal
              </Button>
              <Button type="submit" variant="destructive" disabled={deleteActionLoading} className="h-8 text-xs font-medium cursor-pointer">
                {deleteActionLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  "Hapus Waktu Kerja"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG ADMIN OVERRIDE TIMEBLOCK */}
      <Dialog open={overrideModalBlock !== null} onOpenChange={(open) => !open && setOverrideModalBlock(null)}>
        <DialogContent className="sm:max-w-[425px] bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-amber-500">Admin Override Blok Waktu</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleConfirmOverride} className="space-y-4">
            {overrideError && (
              <div className="flex items-start gap-2 text-xs border border-destructive/20 bg-destructive/10 p-2.5 rounded text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-[1px]" />
                <span>{overrideError}</span>
              </div>
            )}
            
            <div className="space-y-1.5">
              <Label htmlFor="ovr-action" className="text-xs text-muted-foreground">Tindakan Override <span className="text-destructive">*</span></Label>
              <select
                id="ovr-action"
                required
                value={overrideAction}
                onChange={(e) => setOverrideAction(e.target.value as "delete" | "mark_unpaid")}
                className="w-full text-xs h-8 rounded-md border border-border bg-input px-2.5 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="delete">Hapus Blok Waktu Permanen</option>
                <option value="mark_unpaid">Tandai Tidak Dibayar (Unpaid)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ovr-reason" className="text-xs text-muted-foreground">Alasan Admin Override <span className="text-destructive">*</span></Label>
              <textarea
                id="ovr-reason"
                required
                placeholder="Tulis alasan administratif override (mis. Terdeteksi idle / tidak ada aktivitas)"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-border bg-input p-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring placeholder-muted-foreground resize-none"
              />
            </div>

            <DialogFooter className="p-0 mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOverrideModalBlock(null)}
                className="h-8 text-xs border-border bg-transparent hover:bg-accent cursor-pointer"
              >
                Batal
              </Button>
              <Button type="submit" disabled={overrideActionLoading} className="h-8 text-xs font-medium cursor-pointer bg-amber-600 text-white hover:bg-amber-700 border-amber-600">
                {overrideActionLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Terapkan Override"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReportsSection({
  project,
  session,
  isAdmin,
}: {
  project: Project;
  session: UserSession | null;
  isAdmin: boolean;
}) {
  const [subTab, setSubTab] = useState<"timesheets" | "manual">("timesheets");
  const [timesheetsList, setTimesheetsList] = useState<Timesheet[]>([]);
  const [manualEntries, setManualEntries] = useState<ManualTimeEntry[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create timesheet dialog state
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState("");

  // Create manual entry state
  const [manualDate, setManualDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [manualHours, setManualHours] = useState("");
  const [manualMinutes, setManualMinutes] = useState("");
  const [manualDesc, setManualDesc] = useState("");
  const [manualIssueId, setManualIssueId] = useState("");
  const [manualActionLoading, setManualActionLoading] = useState(false);
  const [manualError, setManualError] = useState("");

  // Timesheet Detail Modal state
  const [selectedTimesheetId, setSelectedTimesheetId] = useState<string | null>(null);
  const [timesheetDetail, setTimesheetDetail] = useState<Timesheet | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  // Approval Action state
  const [approvalNote, setApprovalNote] = useState("");
  const [approvalActionLoading, setApprovalActionLoading] = useState(false);
  const [approvalError, setApprovalError] = useState("");

  // Toggle for personal vs team views (for managers)
  const [viewMode, setViewMode] = useState<"personal" | "team">("personal");

  const fetchReportsData = React.useCallback(async () => {
    try {
      const [tsData, manualData, membersData, issuesData] = await Promise.all([
        getTimesheets(project.id),
        getManualEntries(project.id),
        getProjectMembers(project.id),
        getIssues(project.id),
      ]);
      setTimesheetsList(tsData);
      setManualEntries(manualData);
      setMembers(membersData);
      setIssues(issuesData);
    } catch (err: unknown) {
      console.error(err);
      setError("Gagal memuat data timesheet.");
    }
  }, [project.id]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setLoading(true);
      setError("");
      return fetchReportsData();
    })
    .catch((err) => {
      if (!active) return;
      console.error(err);
      setError("Gagal memuat data.");
    })
    .finally(() => {
      if (!active) return;
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [project.id, fetchReportsData]);

  // Load timesheet detail
  const loadTimesheetDetail = React.useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError("");
    setApprovalNote("");
    setApprovalError("");
    try {
      const data = await getTimesheetDetail(id);
      setTimesheetDetail(data);
    } catch (err: unknown) {
      console.error(err);
      setDetailError("Gagal memuat detail timesheet.");
    } finally {
      setDetailLoading(false);
    }
  }, []);



  const myMember = members.find((m) => m.email === session?.user?.email);
  const myRole = myMember ? myMember.role : null;
  const isManagerOrAdmin = myRole === "manager" || isAdmin;

  // Filter timesheets list based on tab toggle
  const displayTimesheets = isManagerOrAdmin && viewMode === "team"
    ? timesheetsList
    : timesheetsList.filter((t) => t.userId === session?.user?.id);

  // Formatting helper
  const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}j ${m}m` : `${m}m`;
  };

  const handleCreateManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualHours && !manualMinutes) {
      setManualError("Masukkan durasi jam atau menit.");
      return;
    }
    const hrs = parseInt(manualHours || "0", 10);
    const mins = parseInt(manualMinutes || "0", 10);
    const totalMins = hrs * 60 + mins;
    if (totalMins <= 0) {
      setManualError("Durasi harus lebih dari 0 menit.");
      return;
    }
    if (!manualDesc.trim()) {
      setManualError("Tuliskan deskripsi aktivitas.");
      return;
    }

    setManualActionLoading(true);
    setManualError("");

    try {
      await createManualEntry(
        project.id,
        manualIssueId || null,
        totalMins,
        manualDesc.trim(),
        manualDate
      );
      setManualHours("");
      setManualMinutes("");
      setManualDesc("");
      setManualIssueId("");
      await fetchReportsData();
    } catch (err: unknown) {
      console.error(err);
      setManualError(err instanceof Error ? err.message : "Gagal menyimpan entri manual.");
    } finally {
      setManualActionLoading(false);
    }
  };

  const handleGenerateTimesheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodStart || !periodEnd) {
      setGenerateError("Pilih tanggal awal dan akhir periode.");
      return;
    }
    if (new Date(periodStart) > new Date(periodEnd)) {
      setGenerateError("Tanggal awal tidak boleh melebihi tanggal akhir.");
      return;
    }

    setGenerateLoading(true);
    setGenerateError("");

    try {
      await createTimesheet(project.id, periodStart, periodEnd);
      setIsGenerateOpen(false);
      setPeriodStart("");
      setPeriodEnd("");
      await fetchReportsData();
    } catch (err: unknown) {
      console.error(err);
      setGenerateError(err instanceof Error ? err.message : "Gagal membuat timesheet.");
    } finally {
      setGenerateLoading(false);
    }
  };

  const handleSubmitTimesheetTrigger = async (tsId: string) => {
    if (!confirm("Kirim timesheet ini untuk diajukan ke manajer proyek?")) return;
    try {
      await submitTimesheet(tsId);
      await fetchReportsData();
    } catch (err: unknown) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Gagal mengirimkan timesheet.");
    }
  };

  const handleReviewTimesheet = async (decision: "approved" | "rejected") => {
    if (!timesheetDetail) return;
    if (!confirm(`Apakah Anda yakin ingin ${decision === "approved" ? "menyetujui" : "menolak"} timesheet ini?`)) return;

    setApprovalActionLoading(true);
    setApprovalError("");

    try {
      const updated = await approveTimesheet(timesheetDetail.id, decision, approvalNote.trim() || undefined);
      setTimesheetDetail((prev) => (prev ? { ...prev, status: updated.status } : null));
      await fetchReportsData();
      if (selectedTimesheetId) {
        await loadTimesheetDetail(selectedTimesheetId);
      }
    } catch (err: unknown) {
      console.error(err);
      setApprovalError(err instanceof Error ? err.message : "Gagal memproses persetujuan.");
    } finally {
      setApprovalActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Approved</span>;
      case "rejected":
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/20">Rejected</span>;
      case "submitted":
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">Submitted</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-secondary/80 text-muted-foreground border border-border">Draft</span>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        </div>
        <div className="space-y-4">
          <div className="h-32 w-full bg-muted animate-pulse rounded-md" />
          <div className="h-44 w-full bg-muted animate-pulse rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Sub-Tabs Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-3 gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Timesheets — {project.name}</h2>
          <p className="text-xs text-muted-foreground">Kelola entri waktu kerja manual dan persetujuan berkas timesheet.</p>
        </div>
        <div className="flex items-center bg-secondary/15 p-0.5 rounded-md border border-border shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setSubTab("timesheets")}
            className={`px-3 py-1 text-xs rounded-sm font-medium transition-all cursor-pointer ${
              subTab === "timesheets" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Timesheet &amp; Approval
          </button>
          <button
            onClick={() => setSubTab("manual")}
            className={`px-3 py-1 text-xs rounded-sm font-medium transition-all cursor-pointer ${
              subTab === "manual" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Waktu Manual (Manual Entry)
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs border border-destructive/20 bg-destructive/10 p-2.5 rounded text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-[1px]" />
          <span>{error}</span>
        </div>
      )}

      {/* --- SUB-TAB: TIMESHEETS --- */}
      {subTab === "timesheets" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-secondary/5 p-3 rounded-md border border-border">
            <div className="flex items-center gap-2">
              {isManagerOrAdmin ? (
                <div className="flex items-center bg-secondary/25 p-0.5 rounded border border-border">
                  <button
                    onClick={() => setViewMode("personal")}
                    className={`px-2.5 py-0.5 text-[11px] rounded transition-all cursor-pointer ${
                      viewMode === "personal" ? "bg-background text-foreground shadow-sm font-semibold" : "text-muted-foreground"
                    }`}
                  >
                    Timesheet Saya
                  </button>
                  <button
                    onClick={() => setViewMode("team")}
                    className={`px-2.5 py-0.5 text-[11px] rounded transition-all cursor-pointer ${
                      viewMode === "team" ? "bg-background text-foreground shadow-sm font-semibold" : "text-muted-foreground"
                    }`}
                  >
                    Persetujuan Tim
                  </button>
                </div>
              ) : (
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Berkas Timesheet Anda</span>
              )}
            </div>
            <Button
              onClick={() => {
                setGenerateError("");
                setIsGenerateOpen(true);
              }}
              className="h-8 text-xs font-medium cursor-pointer self-start sm:self-auto"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Buat Timesheet
            </Button>
          </div>

          {/* List display */}
          <div className="border border-border rounded-md overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-secondary/40 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                    {isManagerOrAdmin && viewMode === "team" && <th className="p-3">Karyawan</th>}
                    <th className="p-3">Periode</th>
                    <th className="p-3 text-right">Total Durasi</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayTimesheets.length === 0 ? (
                    <tr>
                      <td colSpan={isManagerOrAdmin && viewMode === "team" ? 5 : 4} className="p-6 text-center text-muted-foreground italic">
                        Tidak ada berkas timesheet ditemukan.
                      </td>
                    </tr>
                  ) : (
                    displayTimesheets.map((ts) => (
                      <tr key={ts.id} className="hover:bg-accent/20 transition-colors">
                        {isManagerOrAdmin && viewMode === "team" && (
                          <td className="p-3 font-medium text-foreground">
                            <div>{ts.user?.name || "Karyawan"}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{ts.user?.email}</div>
                          </td>
                        )}
                        <td className="p-3">
                          <button
                            onClick={() => {
                              setSelectedTimesheetId(ts.id);
                              loadTimesheetDetail(ts.id);
                            }}
                            className="font-semibold text-foreground hover:underline text-left cursor-pointer"
                          >
                            {new Date(ts.periodStart).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} - {new Date(ts.periodEnd).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                          </button>
                          <div className="text-[10px] text-muted-foreground mt-0.5">Dibuat pada {new Date(ts.createdAt).toLocaleDateString("id-ID")}</div>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-foreground">
                          {formatMinutes(ts.totalMinutes)}
                        </td>
                        <td className="p-3 text-center">
                          {getStatusBadge(ts.status)}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedTimesheetId(ts.id);
                                loadTimesheetDetail(ts.id);
                              }}
                              className="h-7 text-[10px] border-border bg-transparent hover:bg-accent cursor-pointer"
                            >
                              Detail
                            </Button>
                            {ts.status === "draft" && ts.userId === session?.user?.id && (
                              <Button
                                size="sm"
                                onClick={() => handleSubmitTimesheetTrigger(ts.id)}
                                className="h-7 text-[10px] cursor-pointer"
                              >
                                Kirim
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- SUB-TAB: MANUAL ENTRIES --- */}
      {subTab === "manual" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Form Create Manual Entry */}
          <div className="border border-border bg-card p-4 rounded-md space-y-4 h-fit">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider border-b border-border pb-2">
              Input Waktu Manual
            </h3>
            <form onSubmit={handleCreateManualEntry} className="space-y-3.5">
              {manualError && (
                <div className="flex items-start gap-2 text-xs border border-destructive/20 bg-destructive/10 p-2.5 rounded text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-[1px]" />
                  <span>{manualError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="man-date" className="text-xs text-muted-foreground">Tanggal Entri <span className="text-destructive">*</span></Label>
                <Input
                  id="man-date"
                  type="date"
                  required
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="text-xs h-8 border-border bg-input"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Durasi Kerja <span className="text-destructive">*</span></Label>
                <div className="flex gap-2 items-center">
                  <div className="flex-1 flex items-center gap-1.5">
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={manualHours}
                      onChange={(e) => setManualHours(e.target.value)}
                      className="text-xs h-8 border-border bg-input text-right"
                    />
                    <span className="text-[11px] text-muted-foreground">Jam</span>
                  </div>
                  <div className="flex-1 flex items-center gap-1.5">
                    <Input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="0"
                      value={manualMinutes}
                      onChange={(e) => setManualMinutes(e.target.value)}
                      className="text-xs h-8 border-border bg-input text-right"
                    />
                    <span className="text-[11px] text-muted-foreground">Menit</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="man-issue" className="text-xs text-muted-foreground">Terkait Issue (Opsional)</Label>
                <select
                  id="man-issue"
                  value={manualIssueId}
                  onChange={(e) => setManualIssueId(e.target.value)}
                  className="w-full text-xs h-8 rounded-md border border-border bg-input px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">-- Pilih Issue --</option>
                  {issues.map((issue) => (
                    <option key={issue.id} value={issue.id}>
                      {issue.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="man-desc" className="text-xs text-muted-foreground">Aktivitas Pekerjaan <span className="text-destructive">*</span></Label>
                <textarea
                  id="man-desc"
                  required
                  rows={3}
                  placeholder="Redesign layout navbar, meeting mingguan dev, dll."
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                  className="w-full rounded-md border border-border bg-input p-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none placeholder-muted-foreground"
                />
              </div>

              <Button type="submit" disabled={manualActionLoading} className="w-full h-8 text-xs font-semibold cursor-pointer">
                {manualActionLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Entri"
                )}
              </Button>
            </form>
          </div>

          {/* List Manual Entries */}
          <div className="md:col-span-2 border border-border rounded-md overflow-hidden bg-card flex flex-col">
            <div className="py-2 px-3 bg-secondary/50 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Daftar Entri Waktu Manual Anda
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-secondary/20 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                    <th className="p-2.5">Tanggal</th>
                    <th className="p-2.5">Deskripsi</th>
                    <th className="p-2.5 text-right">Durasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {manualEntries.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-muted-foreground italic">
                        Belum ada entri waktu manual.
                      </td>
                    </tr>
                  ) : (
                    manualEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-accent/10 transition-colors">
                        <td className="p-2.5 font-medium text-foreground">
                          {new Date(entry.entryDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="p-2.5">
                          <p className="text-foreground">{entry.description}</p>
                          {entry.issueId && (
                            <span className="inline-block mt-0.5 text-[10px] font-semibold text-primary">
                              ID Tiket: {issues.find((i) => i.id === entry.issueId)?.title || "Terlampir"}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-foreground">
                          {formatMinutes(entry.durationMinutes)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- DIALOG: GENERATE TIMESHEET (Buat baru) --- */}
      <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
        <DialogContent className="sm:max-w-[400px] bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Buat Berkas Timesheet Baru</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleGenerateTimesheet} className="space-y-4">
            {generateError && (
              <div className="flex items-start gap-2 text-xs border border-destructive/20 bg-destructive/10 p-2.5 rounded text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-[1px]" />
                <span>{generateError}</span>
              </div>
            )}

            <p className="text-xs text-muted-foreground leading-normal">
              Sistem akan otomatis menghitung dan mengagregasikan seluruh total jam kerja dari pelacakan otomatis desktop (*time blocks*) ditambah dengan *manual entries* Anda di proyek ini dalam rentang periode yang ditentukan.
            </p>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="start-date" className="text-xs text-muted-foreground">Mulai Periode <span className="text-destructive">*</span></Label>
                <Input
                  id="start-date"
                  type="date"
                  required
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="text-xs h-8 border-border bg-input"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="end-date" className="text-xs text-muted-foreground">Akhir Periode <span className="text-destructive">*</span></Label>
                <Input
                  id="end-date"
                  type="date"
                  required
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="text-xs h-8 border-border bg-input"
                />
              </div>
            </div>

            <DialogFooter className="p-0 mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsGenerateOpen(false)}
                className="h-8 text-xs border-border bg-transparent hover:bg-accent cursor-pointer"
              >
                Batal
              </Button>
              <Button type="submit" disabled={generateLoading} className="h-8 text-xs font-semibold cursor-pointer">
                {generateLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Menyusun...
                  </>
                ) : (
                  "Generate Timesheet"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- LIGHTBOX MODAL: DETAIL TIMESHEET & PERSATUJUAN --- */}
      <Dialog
        open={selectedTimesheetId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTimesheetId(null);
            setTimesheetDetail(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px] bg-background border-border text-foreground max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Detail Berkas Timesheet</DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : detailError ? (
            <div className="flex items-start gap-2 text-xs border border-destructive/20 bg-destructive/10 p-2.5 rounded text-destructive my-4">
              <AlertCircle className="h-4 w-4 shrink-0 mt-[1px]" />
              <span>{detailError}</span>
            </div>
          ) : timesheetDetail ? (
            <div className="space-y-5">
              {/* Profile Block */}
              <div className="flex justify-between items-start border-b border-border/60 pb-3">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Pengaju Timesheet</p>
                  <p className="font-bold text-sm text-foreground">{timesheetDetail.user?.name || "Karyawan"}</p>
                  <p className="text-xs text-muted-foreground">{timesheetDetail.user?.email}</p>
                </div>
                <div>
                  <p className="text-xs text-right text-muted-foreground mb-1">Status</p>
                  {getStatusBadge(timesheetDetail.status)}
                </div>
              </div>

              {/* Aggregation hours details */}
              <div className="grid grid-cols-2 gap-4 bg-secondary/15 p-3 rounded border border-border">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Periode Laporan</p>
                  <p className="text-xs font-semibold text-foreground mt-0.5">
                    {new Date(timesheetDetail.periodStart).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} - {new Date(timesheetDetail.periodEnd).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Akumulasi Jam Kerja</p>
                  <p className="text-xs font-mono font-bold text-primary mt-0.5">
                    {formatMinutes(timesheetDetail.totalMinutes)} ({timesheetDetail.totalMinutes} Menit)
                  </p>
                </div>
              </div>

              {/* Review History */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold text-foreground uppercase tracking-wider border-b border-border pb-1">
                  Log Riwayat Persetujuan
                </h4>
                {timesheetDetail.approvals && timesheetDetail.approvals.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">Belum ada keputusan peninjauan.</p>
                ) : (
                  <div className="space-y-2">
                    {timesheetDetail.approvals?.map((appr) => (
                      <div key={appr.id} className="p-2.5 bg-secondary/10 border border-border rounded text-xs space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-foreground">{appr.reviewer?.name || "Reviewer"}</span>
                          <span className={`text-[10px] font-bold ${appr.decision === "approved" ? "text-emerald-500" : "text-destructive"}`}>
                            {appr.decision === "approved" ? "SETUJU" : "DITOLAK"}
                          </span>
                        </div>
                        {appr.note && (
                          <p className="text-muted-foreground italic border-t border-border/40 pt-1 mt-1 text-[11px]">
                            &ldquo;{appr.note}&rdquo;
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground text-right mt-1">
                          Ditinjau pada {new Date(appr.reviewedAt).toLocaleString("id-ID")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Manager Panel Action Form */}
              {timesheetDetail.status === "submitted" && isManagerOrAdmin && timesheetDetail.userId !== session?.user?.id && (
                <div className="border-t border-border pt-4 space-y-4">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider text-amber-500">
                    Aksi Persetujuan Manajer
                  </h4>

                  {approvalError && (
                    <div className="flex items-start gap-2 text-xs border border-destructive/20 bg-destructive/10 p-2.5 rounded text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-[1px]" />
                      <span>{approvalError}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="appr-note" className="text-xs text-muted-foreground">Catatan / Komentar Peninjauan (Opsional)</Label>
                    <textarea
                      id="appr-note"
                      placeholder="Masukkan catatan persetujuan atau alasan penolakan..."
                      value={approvalNote}
                      onChange={(e) => setApprovalNote(e.target.value)}
                      rows={2}
                      className="w-full rounded-md border border-border bg-input p-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring placeholder-muted-foreground resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="destructive"
                      disabled={approvalActionLoading}
                      onClick={() => handleReviewTimesheet("rejected")}
                      className="h-8 text-xs font-semibold cursor-pointer border border-destructive"
                    >
                      Tolak
                    </Button>
                    <Button
                      disabled={approvalActionLoading}
                      onClick={() => handleReviewTimesheet("approved")}
                      className="h-8 text-xs font-semibold cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                    >
                      {approvalActionLoading ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Memproses...
                        </>
                      ) : (
                        "Setujui Timesheet"
                      )}
                    </Button>
                  </div>
                </div>
              )}

              <DialogFooter className="p-0 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedTimesheetId(null)}
                  className="h-8 text-xs border-border bg-transparent hover:bg-accent cursor-pointer"
                >
                  Tutup
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingsSection({ project }: { project: Project }) {
  const [statuses, setStatuses] = useState<IssueStatus[]>([]);
  const [templates, setTemplates] = useState<IssueTemplate[]>([]);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modals state for Statuses
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusEditing, setStatusEditing] = useState<IssueStatus | null>(null);
  const [statusName, setStatusName] = useState("");
  const [statusRoleRestriction, setStatusRoleRestriction] = useState<string>("");
  const [statusActionLoading, setStatusActionLoading] = useState(false);
  const [statusError, setStatusError] = useState("");

  // Modals state for Templates
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateEditing, setTemplateEditing] = useState<IssueTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateTrackerId, setTemplateTrackerId] = useState("");
  const [templateTitlePattern, setTemplateTitlePattern] = useState("");
  const [templateFields, setTemplateFields] = useState<TemplateField[]>([]);
  const [templateActionLoading, setTemplateActionLoading] = useState(false);
  const [templateError, setTemplateError] = useState("");

  const fetchSettingsData = React.useCallback(() => {
    return Promise.all([
      getProjectStatuses(project.id),
      getProjectTemplates(project.id),
      getTrackers(),
      getProjectMembers(project.id),
    ]).then(([statusesData, templatesData, trackersData, membersData]) => {
      setStatuses(statusesData);
      setTemplates(templatesData);
      setTrackers(trackersData);
      setMembers(membersData);
    });
  }, [project.id]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setLoading(true);
      setError("");
      return fetchSettingsData();
    })
    .catch((err) => {
      if (!active) return;
      console.error(err);
      setError("Gagal memuat konfigurasi settings.");
    })
    .finally(() => {
      if (!active) return;
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [project.id, fetchSettingsData]);

  // --- Status Actions ---
  const handleReorderStatus = async (index: number, direction: "up" | "down") => {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= statuses.length) return;

    const newStatuses = [...statuses];
    const temp = newStatuses[index];
    newStatuses[index] = newStatuses[nextIndex];
    newStatuses[nextIndex] = temp;

    // Optimistically update the UI
    setStatuses(newStatuses);

    try {
      const statusIds = newStatuses.map((s) => s.id);
      await reorderProjectStatuses(project.id, statusIds);
    } catch (err) {
      console.error(err);
      alert("Gagal memperbarui urutan status.");
      fetchSettingsData();
    }
  };

  const handleDeleteStatus = async (statusId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus status ini?")) return;
    try {
      await deleteProjectStatus(project.id, statusId);
      setStatuses((prev) => prev.filter((s) => s.id !== statusId));
    } catch (err) {
      console.error(err);
      alert("Gagal menghapus status. Pastikan tidak ada issue yang dikaitkan dengan status ini.");
    }
  };

  const handleOpenStatusModal = (status?: IssueStatus) => {
    if (status) {
      setStatusEditing(status);
      setStatusName(status.name);
      setStatusRoleRestriction(status.restrictedToRole || "");
    } else {
      setStatusEditing(null);
      setStatusName("");
      setStatusRoleRestriction("");
    }
    setStatusError("");
    setIsStatusModalOpen(true);
  };

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusName.trim()) return;

    setStatusActionLoading(true);
    setStatusError("");

    try {
      const payload = {
        name: statusName.trim(),
        restrictedToRole: (statusRoleRestriction || null) as 'manager' | 'developer' | 'reporter_qa' | null,
      };

      if (statusEditing) {
        const updated = await updateProjectStatus(project.id, statusEditing.id, payload);
        setStatuses((prev) => prev.map((s) => (s.id === statusEditing.id ? updated : s)));
      } else {
        const nextOrderIndex = statuses.length > 0 ? Math.max(...statuses.map((s) => s.orderIndex)) + 1 : 0;
        const newStatus = await createProjectStatus(project.id, {
          ...payload,
          orderIndex: nextOrderIndex,
        });
        setStatuses((prev) => [...prev, newStatus]);
      }
      setIsStatusModalOpen(false);
    } catch (err: unknown) {
      console.error(err);
      setStatusError(err instanceof Error ? err.message : "Gagal menyimpan status");
    } finally {
      setStatusActionLoading(false);
    }
  };

  // --- Template Actions ---
  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus template ini?")) return;
    try {
      await deleteProjectTemplate(project.id, templateId);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    } catch (err) {
      console.error(err);
      alert("Gagal menghapus template.");
    }
  };

  const handleOpenTemplateModal = (template?: IssueTemplate) => {
    if (template) {
      setTemplateEditing(template);
      setTemplateName(template.name);
      setTemplateTrackerId(template.trackerId);
      setTemplateTitlePattern(template.titlePattern || "");
      setTemplateFields(template.fields || []);
    } else {
      setTemplateEditing(null);
      setTemplateName("");
      setTemplateTrackerId(trackers.length > 0 ? trackers[0].id : "");
      setTemplateTitlePattern("");
      setTemplateFields([]);
    }
    setTemplateError("");
    setIsTemplateModalOpen(true);
  };

  const handleAddFieldRow = () => {
    setTemplateFields((prev) => [...prev, { label: "", required: false, helperText: "" }]);
  };

  const handleRemoveFieldRow = (idx: number) => {
    setTemplateFields((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleFieldRowChange = (idx: number, key: keyof TemplateField, val: string | boolean) => {
    setTemplateFields((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, [key]: val } : f))
    );
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim() || !templateTrackerId) return;

    const validFields = templateFields.filter((f) => f.label.trim() !== "");

    setTemplateActionLoading(true);
    setTemplateError("");

    try {
      const payload = {
        name: templateName.trim(),
        trackerId: templateTrackerId,
        titlePattern: templateTitlePattern.trim() || undefined,
        fields: validFields.map((f) => ({
          label: f.label.trim(),
          required: f.required,
          helperText: f.helperText?.trim() || undefined,
        })),
      };

      if (templateEditing) {
        const updated = await updateProjectTemplate(project.id, templateEditing.id, {
          name: payload.name,
          trackerId: payload.trackerId,
          titlePattern: payload.titlePattern || null,
          fields: payload.fields,
        });
        setTemplates((prev) => prev.map((t) => (t.id === templateEditing.id ? updated : t)));
      } else {
        const newTemplate = await createProjectTemplate(project.id, payload);
        setTemplates((prev) => [...prev, newTemplate]);
      }
      setIsTemplateModalOpen(false);
    } catch (err: unknown) {
      console.error(err);
      setTemplateError(err instanceof Error ? err.message : "Gagal menyimpan template");
    } finally {
      setTemplateActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <SectionHeader
          title={`Settings — ${project.name}`}
          description="Konfigurasi detail proyek, manajemen anggota tim, dan perizinan alur kerja."
        />
        <div className="space-y-4">
          <div className="h-28 w-full bg-muted animate-pulse rounded-md" />
          <div className="h-40 w-full bg-muted animate-pulse rounded-md" />
          <div className="h-44 w-full bg-muted animate-pulse rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12">
      <SectionHeader
        title={`Settings — ${project.name}`}
        description="Konfigurasi detail proyek, manajemen anggota tim, dan perizinan alur kerja."
      />

      {error && (
        <div className="flex items-start gap-2 text-xs border border-destructive/20 bg-destructive/10 p-2.5 rounded text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-[1px]" />
          <span>{error}</span>
        </div>
      )}

      <div className="border border-border rounded-md bg-card divide-y divide-border">
        {/* Project detail setting row */}
        <div className="p-4 space-y-3">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Detail Proyek</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nama Proyek</Label>
              <Input defaultValue={project.name} disabled className="text-xs h-8 border-border bg-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Deskripsi</Label>
              <Input defaultValue={project.description || "Tidak ada deskripsi"} disabled className="text-xs h-8 border-border bg-input" />
            </div>
          </div>
        </div>

        {/* Project members row */}
        <div className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>Anggota Proyek</span>
            </h3>
          </div>
          <div className="border border-border rounded-md overflow-hidden bg-card text-xs">
            <div className="grid grid-cols-12 p-2.5 border-b border-border bg-secondary/30 font-semibold text-muted-foreground">
              <span className="col-span-6">Nama / Email</span>
              <span className="col-span-6 text-right">Peran</span>
            </div>
            <div className="divide-y divide-border">
              {members.length === 0 ? (
                <div className="p-2.5 text-center text-muted-foreground italic">Tidak ada anggota proyek</div>
              ) : (
                members.map((member) => (
                  <div key={member.id} className="grid grid-cols-12 p-2.5 items-center">
                    <div className="col-span-6 flex flex-col gap-0.5">
                      <span className="font-semibold text-foreground">{member.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{member.email}</span>
                    </div>
                    <span className="col-span-6 text-right text-muted-foreground font-mono text-[10px] capitalize">
                      {member.role.replace("_", " & ")}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Workflow setting row (CRUD Statuses) */}
        <div className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <span>Workflow &amp; Status</span>
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenStatusModal()}
              className="h-7 text-xs border-border bg-transparent hover:bg-accent cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Tambahkan Status
            </Button>
          </div>
          <p className="text-xs text-muted-foreground leading-normal">
            Status alur kerja issues untuk proyek ini. Anggota tim dapat melakukan transisi issues di antara status ini.
          </p>

          <div className="border border-border rounded-md overflow-hidden bg-card text-xs">
            <div className="grid grid-cols-12 p-2.5 border-b border-border bg-secondary/30 font-semibold text-muted-foreground">
              <span className="col-span-5">Nama Status</span>
              <span className="col-span-4">Batasan Peran</span>
              <span className="col-span-3 text-right">Aksi</span>
            </div>
            <div className="divide-y divide-border">
              {statuses.map((status, index) => (
                <div key={status.id} className="grid grid-cols-12 items-center p-2.5 group hover:bg-accent/10">
                  <span className="col-span-5 font-semibold text-foreground">{status.name}</span>
                  <span className="col-span-4 text-muted-foreground">
                    {status.restrictedToRole ? (
                      <span className="px-1.5 py-0.5 text-[10px] rounded border border-amber-500/20 bg-amber-500/10 text-amber-500 font-mono capitalize">
                        {status.restrictedToRole.replace("_", " ")}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground font-mono italic">None</span>
                    )}
                  </span>
                  <div className="col-span-3 flex justify-end gap-1 items-center">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleReorderStatus(index, "up")}
                      disabled={index === 0}
                      className="h-6 w-6 border-0 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleReorderStatus(index, "down")}
                      disabled={index === statuses.length - 1}
                      className="h-6 w-6 border-0 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleOpenStatusModal(status)}
                      className="h-6 w-6 border-0 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteStatus(status.id)}
                      className="h-6 w-6 border-0 text-muted-foreground hover:text-destructive cursor-pointer"
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Issue Templates setting row (CRUD Templates) */}
        <div className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <span>Issue Templates</span>
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenTemplateModal()}
              className="h-7 text-xs border-border bg-transparent hover:bg-accent cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Buat Template
            </Button>
          </div>
          <p className="text-xs text-muted-foreground leading-normal">
            Template kustom untuk mempercepat pembuatan issue baru berdasarkan kategori Tracker tertentu.
          </p>

          <div className="border border-border rounded-md overflow-hidden bg-card text-xs">
            <div className="grid grid-cols-12 p-2.5 border-b border-border bg-secondary/30 font-semibold text-muted-foreground">
              <span className="col-span-4">Nama Template</span>
              <span className="col-span-3">Tracker</span>
              <span className="col-span-2">Jumlah Fields</span>
              <span className="col-span-3 text-right">Aksi</span>
            </div>
            <div className="divide-y divide-border">
              {templates.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground italic">
                  Belum ada template kustom proyek ini.
                </div>
              ) : (
                templates.map((tpl) => {
                  const tr = trackers.find((t) => t.id === tpl.trackerId);
                  return (
                    <div key={tpl.id} className="grid grid-cols-12 items-center p-2.5 group hover:bg-accent/10">
                      <span className="col-span-4 font-semibold text-foreground">{tpl.name}</span>
                      <span className="col-span-3 text-muted-foreground">
                        <span className="px-1.5 py-0.5 text-[10px] rounded border border-border bg-secondary text-foreground font-mono">
                          {tr ? tr.name : "Unknown"}
                        </span>
                      </span>
                      <span className="col-span-2 text-muted-foreground">{tpl.fields?.length || 0} fields</span>
                      <div className="col-span-3 flex justify-end gap-1 items-center">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenTemplateModal(tpl)}
                          className="h-6 w-6 border-0 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteTemplate(tpl.id)}
                          className="h-6 w-6 border-0 text-muted-foreground hover:text-destructive cursor-pointer"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dialog Status CRUD */}
      <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              {statusEditing ? "Edit Status Alur Kerja" : "Tambah Status Alur Kerja"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveStatus} className="space-y-4">
            {statusError && (
              <div className="flex items-start gap-2 text-xs border border-destructive/20 bg-destructive/10 p-2.5 rounded text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-[1px]" />
                <span>{statusError}</span>
              </div>
            )}
            
            <div className="space-y-1.5">
              <Label htmlFor="status-name" className="text-xs text-muted-foreground">Nama Status <span className="text-destructive">*</span></Label>
              <Input
                id="status-name"
                required
                placeholder="Contoh: Ready for Test"
                value={statusName}
                onChange={(e) => setStatusName(e.target.value)}
                className="text-xs h-8 border-border bg-input"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status-restriction" className="text-xs text-muted-foreground">Batasan Peran Transisi</Label>
              <select
                id="status-restriction"
                value={statusRoleRestriction}
                onChange={(e) => setStatusRoleRestriction(e.target.value)}
                className="w-full text-xs h-8 rounded-md border border-border bg-input px-2.5 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Tidak Ada Batasan (Bisa diubah siapa saja)</option>
                <option value="manager">Hanya Manager</option>
                <option value="developer">Hanya Developer &amp; Manager</option>
                <option value="reporter_qa">Hanya Reporter / QA &amp; Manager</option>
              </select>
              <p className="text-[10px] text-muted-foreground leading-normal">
                Membatasi anggota tim dengan peran tertentu untuk memindahkan tiket ke status ini.
              </p>
            </div>

            <DialogFooter className="p-0 mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsStatusModalOpen(false)}
                className="h-8 text-xs border-border bg-transparent hover:bg-accent hover:text-accent-foreground cursor-pointer"
              >
                Batal
              </Button>
              <Button type="submit" disabled={statusActionLoading} className="h-8 text-xs font-medium cursor-pointer">
                {statusActionLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Template Builder */}
      <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
        <DialogContent className="sm:max-w-[550px] bg-background border-border text-foreground max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              {templateEditing ? "Edit Issue Template" : "Buat Issue Template Baru"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveTemplate} className="space-y-4">
            {templateError && (
              <div className="flex items-start gap-2 text-xs border border-destructive/20 bg-destructive/10 p-2.5 rounded text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-[1px]" />
                <span>{templateError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="template-name" className="text-xs text-muted-foreground">Nama Template <span className="text-destructive">*</span></Label>
                <Input
                  id="template-name"
                  required
                  placeholder="Contoh: Bug Report Mobile"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="text-xs h-8 border-border bg-input"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="template-tracker" className="text-xs text-muted-foreground">Tracker Terkait <span className="text-destructive">*</span></Label>
                <select
                  id="template-tracker"
                  required
                  value={templateTrackerId}
                  onChange={(e) => setTemplateTrackerId(e.target.value)}
                  className="w-full text-xs h-8 rounded-md border border-border bg-input px-2.5 focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {trackers.map((tr) => (
                    <option key={tr.id} value={tr.id}>{tr.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="template-pattern" className="text-xs text-muted-foreground">Pola Judul Otomatis (Optional)</Label>
              <Input
                id="template-pattern"
                placeholder="Contoh: [BUG] {feature} - {bugName}"
                value={templateTitlePattern}
                onChange={(e) => setTemplateTitlePattern(e.target.value)}
                className="text-xs h-8 border-border bg-input"
              />
              <p className="text-[10px] text-muted-foreground leading-normal">
                Gunakan tag variabel `{`nama_field`}` untuk menghasilkan judul tiket otomatis.
              </p>
            </div>

            {/* Custom fields builder */}
            <div className="space-y-2 border-t border-border pt-4">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-semibold text-foreground">Custom Fields (Konstruktor Form)</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddFieldRow}
                  className="h-6 text-[10px] border-border bg-transparent hover:bg-accent cursor-pointer"
                >
                  <Plus className="h-3 w-3 mr-1" /> Tambah Field
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground leading-normal">
                Buat kolom isian terstruktur yang harus diisi pengguna saat membuat issue dengan template ini.
              </p>

              {templateFields.length === 0 ? (
                <div className="text-center py-4 text-[11px] text-muted-foreground border border-dashed border-border rounded bg-secondary/10">
                  Tidak ada custom fields. Klik &quot;+ Tambah Field&quot; untuk membuat field baru.
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {templateFields.map((field, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-secondary/15 p-2 rounded border border-border">
                      <div className="flex-1 space-y-1">
                        <Input
                          placeholder="Label Field (mis. OS Version)"
                          required
                          value={field.label}
                          onChange={(e) => handleFieldRowChange(idx, "label", e.target.value)}
                          className="text-[11px] h-7 border-border bg-input"
                        />
                        <Input
                          placeholder="Petunjuk (mis. Android 13/iOS 16)"
                          value={field.helperText || ""}
                          onChange={(e) => handleFieldRowChange(idx, "helperText", e.target.value)}
                          className="text-[10px] h-6 border-border bg-input/50"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 px-2">
                        <input
                          type="checkbox"
                          id={`req-${idx}`}
                          checked={field.required}
                          onChange={(e) => handleFieldRowChange(idx, "required", e.target.checked)}
                          className="rounded border-border text-primary focus:ring-0 cursor-pointer h-3.5 w-3.5"
                        />
                        <Label htmlFor={`req-${idx}`} className="text-[10px] cursor-pointer text-muted-foreground select-none">Wajib</Label>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemoveFieldRow(idx)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="p-0 mt-6 flex justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTemplateModalOpen(false)}
                className="h-8 text-xs border-border bg-transparent hover:bg-accent hover:text-accent-foreground cursor-pointer"
              >
                Batal
              </Button>
              <Button type="submit" disabled={templateActionLoading} className="h-8 text-xs font-medium cursor-pointer">
                {templateActionLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
