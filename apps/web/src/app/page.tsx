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
  Issue,
  IssueStatus,
  Tracker,
  ProjectMember
} from "@/lib/issues-service";
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
              {activeSection === "timebook" && <TimebookSection project={selectedProject} />}
              {activeSection === "reports" && <ReportsSection project={selectedProject} />}
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

function TimebookSection({ project }: { project: Project }) {
  // Activity contribution-like logs and trackings
  const logs = [
    { desc: "Mengerjakan redesign halaman login & layout baru", duration: "2j 15m", date: "Hari ini, 09:12", status: "Sudah Disinkronkan" },
    { desc: "Setting up database migration Drizzle adapter", duration: "1j 30m", date: "Kemarin, 14:22", status: "Sudah Disinkronkan" },
    { desc: "Diskusi PRD dan target design quality bar", duration: "45m", date: "12 Jul 2026, 10:00", status: "Sudah Disinkronkan" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Time Book — {project.name}</h2>
          <p className="text-xs text-muted-foreground">Catatan pelacakan waktu kerja dan screenshot log aktivitas kerja.</p>
        </div>
        <Button className="h-7 text-xs font-medium px-2.5 cursor-pointer">
          <Clock className="h-3.5 w-3.5 mr-1" /> Mulai Tracker
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tracker status card */}
        <div className="border border-border bg-card p-4 rounded-md flex flex-col justify-between h-32">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Tracker Status</span>
            <div className="h-2 w-2 rounded-full bg-muted animate-pulse" />
          </div>
          <div>
            <h3 className="text-2xl font-semibold tracking-tight">00:00:00</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Tidak ada pelacak yang sedang berjalan</p>
          </div>
        </div>

        {/* Daily Stats */}
        <div className="border border-border bg-card p-4 rounded-md flex flex-col justify-between h-32">
          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Total Hari Ini</span>
          <div>
            <h3 className="text-2xl font-semibold tracking-tight">2j 15m</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Target harian: 8 jam kerja</p>
          </div>
        </div>

        {/* Weekly Stats */}
        <div className="border border-border bg-card p-4 rounded-md flex flex-col justify-between h-32">
          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Total Minggu Ini</span>
          <div>
            <h3 className="text-2xl font-semibold tracking-tight">3j 0m</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Target mingguan: 40 jam kerja</p>
          </div>
        </div>
      </div>

      {/* Activity heat map mockup (Plane style) */}
      <div className="border border-border bg-card p-4 rounded-md">
        <h3 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">Aktivitas Pelacakan (Minggu Ini)</h3>
        <div className="grid grid-cols-7 gap-2 text-center text-[10px]">
          {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
            <div key={day} className="text-muted-foreground font-semibold py-1">{day}</div>
          ))}
          {/* Mock boxes representing time tracking densities */}
          <div className="h-8 rounded bg-emerald-500/40 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold" title="2j 15m">Tinggi</div>
          <div className="h-8 rounded bg-emerald-500/20 border border-emerald-500/10 flex items-center justify-center text-emerald-400/80 font-bold" title="1j 30m">Sedang</div>
          <div className="h-8 rounded bg-border/20 border border-border flex items-center justify-center text-muted-foreground font-bold">Kosong</div>
          <div className="h-8 rounded bg-border/20 border border-border flex items-center justify-center text-muted-foreground font-bold">Kosong</div>
          <div className="h-8 rounded bg-border/20 border border-border flex items-center justify-center text-muted-foreground font-bold">Kosong</div>
          <div className="h-8 rounded bg-border/20 border border-border flex items-center justify-center text-muted-foreground font-bold">Kosong</div>
          <div className="h-8 rounded bg-border/20 border border-border flex items-center justify-center text-muted-foreground font-bold">Kosong</div>
        </div>
      </div>

      {/* Time logs */}
      <div className="border border-border rounded-md overflow-hidden bg-card">
        <div className="py-2 px-3 bg-secondary/50 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Log Aktivitas Terakhir
        </div>
        <div className="divide-y divide-border">
          {logs.map((log, i) => (
            <div key={i} className="p-3 hover:bg-accent/40 transition-colors text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <p className="font-semibold text-foreground">{log.desc}</p>
                <p className="text-[11px] text-muted-foreground">{log.date}</p>
              </div>
              <div className="flex items-center gap-3 self-end sm:self-auto shrink-0 text-[11px]">
                <span className="font-mono font-bold text-foreground">{log.duration}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {log.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReportsSection({ project }: { project: Project }) {
  return (
    <div className="space-y-4">
      <SectionHeader
        title={`Reports — ${project.name}`}
        description="Analisis efisiensi kerja tim, distribusi waktu, dan progres issue."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Simple Progress chart mockup */}
        <div className="border border-border bg-card p-4 rounded-md">
          <h3 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">Pencapaian Milestone</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1 font-medium">
                <span className="text-foreground">Fase 1: Database &amp; Auth</span>
                <span className="text-muted-foreground">100%</span>
              </div>
              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: "100%" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1 font-medium">
                <span className="text-foreground">Fase 2: API &amp; Services</span>
                <span className="text-muted-foreground">90%</span>
              </div>
              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: "90%" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1 font-medium">
                <span className="text-foreground">Fase 3: Frontend Layout &amp; Auth Connection</span>
                <span className="text-muted-foreground">40%</span>
              </div>
              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: "40%" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Quick info list */}
        <div className="border border-border bg-card p-4 rounded-md flex flex-col justify-between">
          <h3 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">Distribusi Waktu Tim</h3>
          <div className="divide-y divide-border text-xs">
            <div className="flex justify-between py-1.5">
              <span className="text-muted-foreground">Engineering</span>
              <span className="font-semibold text-foreground">3j 45m</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted-foreground">UI/UX Design</span>
              <span className="font-semibold text-foreground">2j 0m</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted-foreground">Management &amp; Planning</span>
              <span className="font-semibold text-foreground">45m</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsSection({ project }: { project: Project }) {
  return (
    <div className="space-y-4">
      <SectionHeader
        title={`Settings — ${project.name}`}
        description="Konfigurasi detail proyek, manajemen anggota tim, dan perizinan alur kerja."
      />

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
            <Button size="sm" variant="outline" className="h-7 text-xs border-border bg-transparent hover:bg-accent cursor-pointer">
              <Plus className="h-3.5 w-3.5 mr-1" /> Tambahkan
            </Button>
          </div>
          <div className="border border-border rounded-md overflow-hidden bg-card text-xs">
            <div className="flex items-center justify-between p-2.5 border-b border-border bg-secondary/30 font-semibold text-muted-foreground">
              <span>Nama</span>
              <span>Peran</span>
            </div>
            <div className="divide-y divide-border">
              <div className="flex items-center justify-between p-2.5">
                <span className="font-semibold text-foreground">Hazlan (Anda)</span>
                <span className="text-muted-foreground font-mono text-[11px] capitalize">Manager</span>
              </div>
            </div>
          </div>
        </div>

        {/* Workflow setting row */}
        <div className="p-4 space-y-3">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Workflow &amp; Status</h3>
          <p className="text-xs text-muted-foreground leading-normal">
            Status alur kerja issues untuk proyek ini. Anggota tim dapat melakukan transisi issues di antara status ini.
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {["Backlog", "Belum Dimulai", "Dalam Proses", "Dalam Review", "Selesai"].map((status) => (
              <span key={status} className="px-2 py-1 rounded bg-secondary text-foreground font-medium border border-border">
                {status}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
