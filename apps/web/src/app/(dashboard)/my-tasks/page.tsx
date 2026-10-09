"use client";

import React, { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  ListTodo,
  LayoutList,
  Kanban,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  Folder,
  Filter,
  X,
  Users,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import { id as idLocale } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  getMyIssues,
  getTeamIssuesGlobal,
  updateIssueStatus,
  Issue,
  IssueStatus,
  MyTaskProject,
  MyTasksCalendarIssue,
} from "@/lib/issues-service";
import { getSession } from "@/lib/auth-service";
import { getProjects } from "@/lib/projects-service";

// Project Color Map Helper for Badges
const COLOR_PALETTES = [
  "bg-indigo-500/10 text-indigo-600 border-indigo-500/30 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/40",
  "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/40",
  "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/40",
  "bg-rose-500/10 text-rose-600 border-rose-500/30 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/40",
  "bg-sky-500/10 text-sky-600 border-sky-500/30 dark:bg-sky-500/20 dark:text-sky-400 dark:border-sky-500/40",
  "bg-purple-500/10 text-purple-600 border-purple-500/30 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/40",
  "bg-teal-500/10 text-teal-600 border-teal-500/30 dark:bg-teal-500/20 dark:text-teal-400 dark:border-teal-500/40",
];

const PROJECT_COLOR_MAP: Record<string, string> = {};

function getProjectColor(projectKey: string): string {
  if (!projectKey) return COLOR_PALETTES[0];
  if (!PROJECT_COLOR_MAP[projectKey]) {
    let hash = 0;
    for (let i = 0; i < projectKey.length; i++) {
      hash = projectKey.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % COLOR_PALETTES.length;
    PROJECT_COLOR_MAP[projectKey] = COLOR_PALETTES[index];
  }
  return PROJECT_COLOR_MAP[projectKey];
}

// Draggable Kanban Card Component
function KanbanCard({
  issue,
  onClick,
  showAssignee = false,
}: {
  issue: Issue;
  onClick: () => void;
  showAssignee?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: issue.id,
      data: { issue },
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        className="p-3 rounded-lg border border-primary/40 bg-primary/5 opacity-40 h-[100px] w-full"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className="p-3 rounded-lg border border-border/80 bg-card shadow-2xs hover:border-border hover:shadow-xs transition-all flex flex-col gap-2 relative group cursor-grab active:cursor-grabbing select-none"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[9.5px] font-semibold text-muted-foreground bg-muted/80 border border-border/80 px-1.5 py-0.5 rounded uppercase">
          {issue.displayId || `#${issue.id.slice(0, 6)}`}
        </span>
        <span
          className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-full capitalize select-none ${
            issue.priority === "urgent"
              ? "bg-destructive/10 border border-destructive/20 text-destructive font-bold"
              : issue.priority === "high"
              ? "bg-red-400/10 border border-red-400/20 text-red-500"
              : issue.priority === "medium"
              ? "bg-amber-400/10 border border-amber-400/20 text-amber-600 dark:text-amber-400"
              : "bg-muted border border-border text-muted-foreground"
          }`}
        >
          {issue.priority}
        </span>
      </div>

      <h4 className="text-[12px] font-medium text-foreground line-clamp-2 leading-snug">
        {issue.title}
      </h4>

      <div className="flex items-center justify-between border-t border-border/40 pt-2 mt-1 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[9px] font-medium bg-muted/20 text-muted-foreground select-none shrink-0">
            {issue.tracker?.name || "Task"}
          </span>

          {issue.dueDate && (
            <span className="text-[10px] text-muted-foreground truncate">
              {new Date(issue.dueDate).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
              })}
            </span>
          )}
        </div>

        {showAssignee && issue.assignee && (
          <div
            className="flex items-center gap-1 shrink-0 ml-auto"
            title={`Assignee: ${issue.assignee.name || issue.assignee.email}`}
          >
            <Avatar className="h-4.5 w-4.5 border border-border/80 shadow-2xs">
              <AvatarImage src={issue.assignee.image || undefined} alt={issue.assignee.name} />
              <AvatarFallback className="text-[8px] font-bold bg-muted text-muted-foreground">
                {issue.assignee.name ? issue.assignee.name.slice(0, 2).toUpperCase() : "U"}
              </AvatarFallback>
            </Avatar>
            <span className="text-[9.5px] font-medium text-muted-foreground truncate max-w-[65px]">
              {issue.assignee.name?.split(" ")[0]}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Droppable Kanban Column Component
function KanbanColumn({
  status,
  issues,
  onCardClick,
  showAssignee = false,
  maxHeight = "420px",
}: {
  status: IssueStatus;
  issues: Issue[];
  onCardClick: (id: string) => void;
  showAssignee?: boolean;
  maxHeight?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status.id,
  });

  const columnBg = isOver
    ? "bg-accent/20 border-accent/40"
    : "bg-muted/10 border-border/60";

  return (
    <div
      ref={setNodeRef}
      style={{ maxHeight }}
      className={`flex flex-col rounded-xl border min-w-[260px] max-w-[280px] h-full transition-all shrink-0 overflow-hidden ${columnBg}`}
    >
      {/* Sticky Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/50 sticky top-0 bg-card z-10 rounded-t-xl shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-[12px] font-semibold text-foreground truncate max-w-[150px]">
            {status.name}
          </h3>
          <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-muted/80 px-1 text-[9px] font-semibold text-muted-foreground border border-border">
            {issues.length}
          </span>
        </div>
        {status.restrictedToRole && (
          <span className="rounded bg-destructive/10 border border-destructive/20 text-destructive text-[8px] px-1.5 py-0.25 uppercase font-bold tracking-wider">
            {status.restrictedToRole.replace("_", " ")}
          </span>
        )}
      </div>

      {/* Scrollable Card Container */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 scrollbar-thin select-none">
        {issues.length === 0 ? (
          <div className="flex-1 flex items-center justify-center border border-dashed border-border/30 rounded-lg p-4 bg-card/10">
            <span className="text-[10px] text-muted-foreground/60 italic text-center">
              Kosong
            </span>
          </div>
        ) : (
          issues.map((issue) => (
            <KanbanCard
              key={issue.id}
              issue={issue}
              onClick={() => onCardClick(issue.id)}
              showAssignee={showAssignee}
            />
          ))
        )}
      </div>
    </div>
  );
}

function MyTasksContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const isOverdueFiltered =
    searchParams.get("filter") === "overdue" ||
    searchParams.get("overdue") === "true";

  const [scope, setScope] = useState<"mine" | "team">("mine");
  const [includeEmpty, setIncludeEmpty] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"list" | "kanban" | "calendar">("list");
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date());
  const [activeDragIssue, setActiveDragIssue] = useState<Issue | null>(null);

  // Fetch current user session & project memberships to determine manager/admin role
  const { data: session } = useQuery({
    queryKey: ["auth-session"],
    queryFn: getSession,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", session?.user?.id],
    queryFn: getProjects,
    enabled: !!session?.user,
  });



  // Initialize view mode from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("trackflow_mytasks_view");
      if (saved === "list" || saved === "kanban" || saved === "calendar") {
        setViewMode(saved);
      }
    }
  }, []);

  const changeViewMode = (mode: "list" | "kanban" | "calendar") => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("trackflow_mytasks_view", mode);
    }
  };

  // Fetch Tasks (My Issues vs Global Team Issues)
  const { data, isLoading, error } = useQuery({
    queryKey: ["aggregated-issues", scope, viewMode, includeEmpty],
    queryFn: () =>
      scope === "team"
        ? getTeamIssuesGlobal(viewMode, includeEmpty)
        : getMyIssues(viewMode),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const toggleProjectCollapse = (projectId: string) => {
    setCollapsedProjects((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  const todayDateStr = useMemo(
    () => new Date().toISOString().split("T")[0],
    []
  );

  const isIssueOverdue = useCallback(
    (dueDate?: string | null, isFinal?: boolean) => {
      if (!dueDate) return false;
      if (isFinal) return false;
      const issueDateStr = dueDate.split("T")[0];
      return issueDateStr < todayDateStr;
    },
    [todayDateStr]
  );

  const rawProjectsList = data?.projects || [];

  // Filter projects if overdue filter is active
  const projectsList = useMemo(() => {
    if (!isOverdueFiltered) return rawProjectsList;
    return rawProjectsList
      .map((proj) => {
        const filteredIssues = proj.issues.filter((iss) => {
          const st = proj.statuses?.find(
            (s) => s.id === iss.statusId || s.id === iss.status?.id
          );
          return isIssueOverdue(iss.dueDate, st?.isFinal);
        });
        return {
          ...proj,
          issues: filteredIssues,
        };
      })
      .filter((proj) => proj.issues.length > 0);
  }, [rawProjectsList, isOverdueFiltered, isIssueOverdue]);

  const allIssuesList = useMemo(() => {
    const list = projectsList.flatMap((proj) =>
      (proj.issues || []).map((issue) => ({
        ...issue,
        projectId: issue.projectId || proj.projectId,
        projectName: issue.projectName || proj.projectName,
        projectKey: issue.projectKey || proj.projectKey,
      }))
    );

    return list.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [projectsList]);

  // Calendar dates calculation
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonthDate);
    const monthEnd = endOfMonth(monthStart);
    const weekStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [currentMonthDate]);

  // Group calendar issues by due date
  const calendarIssuesByDate = useMemo(() => {
    if (!data?.issues) return {};
    const map: Record<string, MyTasksCalendarIssue[]> = {};
    data.issues.forEach((iss) => {
      if (iss.dueDate) {
        if (
          isOverdueFiltered &&
          !isIssueOverdue(iss.dueDate, iss.status?.isFinal)
        ) {
          return;
        }
        const dateKey = iss.dueDate.split("T")[0];
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(iss);
      }
    });
    return map;
  }, [data?.issues, isOverdueFiltered, isIssueOverdue]);

  // Handle Drag End in Kanban mode
  const handleDragEnd = async (event: DragEndEvent, project: MyTaskProject) => {
    const { active, over } = event;
    setActiveDragIssue(null);

    if (!over) return;
    const issueId = active.id as string;
    const targetStatusId = over.id as string;

    const issue = project.issues.find((i) => i.id === issueId);
    if (!issue || issue.statusId === targetStatusId) return;

    try {
      await updateIssueStatus(issueId, targetStatusId);
      queryClient.invalidateQueries({ queryKey: ["aggregated-issues"] });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["issues"] });
    } catch (err: any) {
      alert(err.message || "Gagal mengubah status issue");
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const issue = event.active.data.current?.issue as Issue;
    if (issue) setActiveDragIssue(issue);
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-100px)] w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalAssignedIssues = projectsList.reduce(
    (acc, p) => acc + (p.issues?.length || 0),
    0
  );

  return (
    <div className="flex flex-col min-h-full w-full max-w-[1400px] mx-auto p-6 gap-5 pb-24">
      {/* Header Row (Baris 1) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <ListTodo className="h-4.5 w-4.5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              Issues
            </h1>
            <p className="text-xs text-muted-foreground">
              {scope === "team"
                ? "Agregasi semua tiket dari seluruh anggota tim di proyek yang Anda ikuti"
                : "Agregasi tugas yang ditugaskan ke Anda di semua proyek"}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Bar & Action Toolbar (Baris 2 - Gaya Linear/Plane) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        {/* Left: Scope Switcher Tabs (Accessible for all roles) */}
        <Tabs
          value={scope}
          onValueChange={(val) => setScope(val as "mine" | "team")}
        >
          <TabsList className="h-8.5 bg-muted/40 border border-border p-0.5 rounded-lg">
            <TabsTrigger
              value="mine"
              className="text-xs font-medium px-3.5 h-7.5 rounded-md flex items-center gap-1.5 cursor-pointer data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
            >
              <ListTodo className="h-3.5 w-3.5" />
              Tugas Saya
            </TabsTrigger>
            <TabsTrigger
              value="team"
              className="text-xs font-medium px-3.5 h-7.5 rounded-md flex items-center gap-1.5 cursor-pointer data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
            >
              <Users className="h-3.5 w-3.5" />
              Semua Tim
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Right: Controls Cluster (Toggle Proyek Kosong + View Mode Switcher) */}
        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {/* Toggle Proyek Kosong (khusus mode Semua Tim) */}
          {scope === "team" && viewMode !== "calendar" && (
            <Button
              variant="outline"
              size="sm"
              className={`h-8 text-xs gap-1.5 px-2.5 font-medium cursor-pointer border-border shadow-2xs transition-all ${
                includeEmpty
                  ? "bg-accent text-accent-foreground border-accent-foreground/30 font-semibold"
                  : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
              onClick={() => setIncludeEmpty(!includeEmpty)}
              title={
                includeEmpty
                  ? "Klik untuk menyembunyikan proyek tanpa tiket"
                  : "Klik untuk menampilkan proyek tanpa tiket"
              }
            >
              {includeEmpty ? (
                <Eye className="h-3.5 w-3.5 text-primary" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
              <span>
                {includeEmpty
                  ? "Proyek Kosong: Muncul"
                  : "Proyek Kosong: Sembunyi"}
              </span>
            </Button>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center border border-border rounded-lg bg-card p-0.5 shadow-2xs">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs gap-1.5 px-2.5 font-medium cursor-pointer"
              onClick={() => changeViewMode("list")}
            >
              <LayoutList className="h-3.5 w-3.5" />
              List
            </Button>
            <Button
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs gap-1.5 px-2.5 font-medium cursor-pointer"
              onClick={() => changeViewMode("kanban")}
            >
              <Kanban className="h-3.5 w-3.5" />
              Kanban
            </Button>
            <Button
              variant={viewMode === "calendar" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs gap-1.5 px-2.5 font-medium cursor-pointer"
              onClick={() => changeViewMode("calendar")}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              Calendar
            </Button>
          </div>
        </div>
      </div>

      {/* Active Filter Banner */}
      {isOverdueFiltered && (
        <div className="flex items-center justify-between p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 shrink-0" />
            <span>
              Filter Aktif: Menampilkan hanya tugas Overdue (melewati tenggat
              waktu &amp; belum selesai)
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2 gap-1 cursor-pointer hover:bg-amber-500/20 text-amber-600 dark:text-amber-400"
            onClick={() => router.push("/my-tasks")}
          >
            <X className="h-3.5 w-3.5" />
            Hapus Filter
          </Button>
        </div>
      )}

      {/* Error View */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          Gagal mengambil data tugas: {(error as Error).message}
        </div>
      )}

      {/* LIST / KANBAN VIEWS */}
      {viewMode !== "calendar" && (
        <>
          {projectsList.length === 0 || totalAssignedIssues === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border bg-card/40 my-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground mb-3 border border-border/80">
                <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {isOverdueFiltered
                  ? "Tidak Ada Tugas Overdue"
                  : scope === "team"
                  ? "Tidak Ada Tiket Tim"
                  : "Belum Ada Tugas"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {isOverdueFiltered
                  ? "Tidak ada tugas yang melewati tenggat waktu."
                  : scope === "team"
                  ? "Belum ada tiket di proyek yang Anda kelola, atau semua proyek saat ini kosong."
                  : "Belum ada tugas yang ditugaskan ke Anda saat ini."}
              </p>
              {isOverdueFiltered && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 text-xs cursor-pointer"
                  onClick={() => router.push("/my-tasks")}
                >
                  Tampilkan Semua Tugas
                </Button>
              )}
            </div>
          ) : viewMode === "list" ? (
            /* Single Unified Table for All Project Issues */
            <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden pb-16">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-muted/20 border-b border-border/60">
                      <TableHead className="w-20 pl-4 whitespace-nowrap">
                        ID
                      </TableHead>
                      <TableHead className="min-w-[240px]">
                        Title
                      </TableHead>
                      <TableHead className="w-40 whitespace-nowrap">
                        Project
                      </TableHead>
                      <TableHead className="w-36 whitespace-nowrap">
                        Assignee
                      </TableHead>
                      <TableHead className="w-28 whitespace-nowrap">
                        Tracker
                      </TableHead>
                      <TableHead className="w-28 whitespace-nowrap">
                        Status
                      </TableHead>
                      <TableHead className="w-24 whitespace-nowrap">
                        Priority
                      </TableHead>
                      <TableHead className="w-32 pr-4 whitespace-nowrap">
                        Due Date
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allIssuesList.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="h-32 text-center text-muted-foreground text-xs"
                        >
                          Tidak ada tiket yang ditemukan
                        </TableCell>
                      </TableRow>
                    ) : (
                      allIssuesList.map((issue) => {
                        const badgeColor = getProjectColor(issue.projectKey);
                        return (
                          <TableRow
                            key={issue.id}
                            className="cursor-pointer hover:bg-muted/40 transition-colors"
                            onClick={() =>
                              router.push(
                                `/projects/${issue.projectId}/issues/${issue.id}`
                              )
                            }
                          >
                            <TableCell className="font-mono text-[11px] text-muted-foreground pl-4 whitespace-nowrap">
                              #{issue.id.slice(0, 6)}
                            </TableCell>
                            <TableCell className="font-medium text-foreground">
                              <div className="flex items-center gap-1.5 max-w-[500px]">
                                {issue.displayId && (
                                  <span className="shrink-0 inline-flex items-center rounded bg-muted/80 border border-border px-1.5 py-0.5 text-[9.5px] font-mono font-semibold text-muted-foreground uppercase">
                                    {issue.displayId}
                                  </span>
                                )}
                                <span className="truncate">
                                  {issue.title}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/projects/${issue.projectId}`);
                                }}
                                className="inline-flex items-center gap-1.5 hover:underline text-left group cursor-pointer"
                                title={issue.projectName}
                              >
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold border ${badgeColor}`}
                                >
                                  {issue.projectKey}
                                </span>
                                <span className="text-xs text-muted-foreground group-hover:text-foreground truncate max-w-[120px]">
                                  {issue.projectName}
                                </span>
                              </button>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {issue.assignee ? (
                                <div className="flex items-center gap-1.5">
                                  <Avatar className="h-5 w-5 border border-border/80">
                                    <AvatarImage
                                      src={
                                        issue.assignee.image ||
                                        undefined
                                      }
                                    />
                                    <AvatarFallback className="text-[9px] font-bold bg-muted text-muted-foreground">
                                      {issue.assignee.name
                                        ? issue.assignee.name
                                            .slice(0, 2)
                                            .toUpperCase()
                                        : "U"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs text-foreground truncate max-w-[110px]">
                                    {issue.assignee.name}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">
                                  Belum ada
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <span className="inline-flex items-center rounded border border-border px-2 py-0.5 text-[10px] font-medium bg-muted/30 text-muted-foreground whitespace-nowrap">
                                {issue.tracker?.name || "Task"}
                              </span>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <span className="inline-flex items-center rounded bg-secondary px-2 py-0.5 text-[10px] font-semibold border border-border text-muted-foreground whitespace-nowrap">
                                {issue.status?.name || "New"}
                              </span>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <span
                                className={`text-[11px] font-semibold capitalize whitespace-nowrap ${
                                  issue.priority === "urgent"
                                    ? "text-red-500 font-bold"
                                    : issue.priority === "high"
                                    ? "text-red-400"
                                    : issue.priority === "medium"
                                    ? "text-amber-500 dark:text-amber-400"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {issue.priority}
                              </span>
                            </TableCell>
                            <TableCell className="text-[12px] pr-4 whitespace-nowrap">
                              <span
                                className={
                                  isIssueOverdue(
                                    issue.dueDate,
                                    issue.status?.isFinal
                                  )
                                    ? "text-destructive font-bold"
                                    : "text-muted-foreground"
                                }
                              >
                                {issue.dueDate
                                  ? new Date(
                                      issue.dueDate
                                    ).toLocaleDateString("id-ID", {
                                      day: "numeric",
                                      month: "short",
                                    })
                                  : "—"}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            /* Kanban View Per-Project Boards */
            <div className="flex flex-col gap-6 pb-16">
              {projectsList.map((project) => {
                const isCollapsed = !!collapsedProjects[project.projectId];
                const badgeColor = getProjectColor(project.projectKey);

                return (
                  <div
                    key={project.projectId}
                    className="flex flex-col rounded-xl border border-border bg-card shadow-2xs overflow-hidden"
                  >
                    {/* Collapsible Section Header */}
                    <div
                      onClick={() => toggleProjectCollapse(project.projectId)}
                      className="flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer border-b border-border/60 select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <button className="text-muted-foreground hover:text-foreground">
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                        <span
                          className={`px-2 py-0.5 rounded text-[10.5px] font-mono font-bold border ${badgeColor}`}
                        >
                          {project.projectKey}
                        </span>
                        <h2 className="text-sm font-semibold text-foreground">
                          {project.projectName}
                        </h2>
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted border border-border px-1.5 text-[10px] font-medium text-muted-foreground">
                          {project.issues.length} tiket
                        </span>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/projects/${project.projectId}`);
                        }}
                      >
                        <Folder className="h-3.5 w-3.5 mr-1" />
                        Buka Proyek
                      </Button>
                    </div>

                    {/* Section Body */}
                    {!isCollapsed && (
                      <div className="p-4">
                        <DndContext
                          sensors={sensors}
                          onDragStart={handleDragStart}
                          onDragEnd={(e) => handleDragEnd(e, project)}
                        >
                          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin max-w-full">
                            {(project.statuses || []).map((status) => {
                              const columnIssues = project.issues.filter(
                                (iss) =>
                                  iss.statusId === status.id ||
                                  iss.status?.id === status.id
                              );
                              return (
                                <KanbanColumn
                                  key={status.id}
                                  status={status}
                                  issues={columnIssues}
                                  maxHeight="420px"
                                  showAssignee={true}
                                  onCardClick={(id) =>
                                    router.push(
                                      `/projects/${project.projectId}/issues/${id}`
                                    )
                                  }
                                />
                              );
                            })}
                          </div>
                          <DragOverlay>
                            {activeDragIssue ? (
                              <div className="p-3 rounded-lg border border-border bg-card shadow-lg w-[260px] opacity-90 rotate-2">
                                <span className="font-mono text-[9.5px] font-semibold text-muted-foreground bg-muted border px-1.5 py-0.5 rounded">
                                  {activeDragIssue.displayId}
                                </span>
                                <h4 className="text-[12px] font-medium text-foreground mt-1 truncate">
                                  {activeDragIssue.title}
                                </h4>
                              </div>
                            ) : null}
                          </DragOverlay>
                        </DndContext>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* CALENDAR VIEW */}
      {viewMode === "calendar" && (
        <div className="flex flex-col gap-3 pb-16">
          {/* Calendar Month Controls */}
          <div className="flex items-center justify-between border border-border bg-card p-3 rounded-xl shadow-2xs select-none">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5 font-medium cursor-pointer"
                onClick={() => setCurrentMonthDate(new Date())}
              >
                Hari Ini
              </Button>
              <div className="flex items-center border border-border rounded-md overflow-hidden bg-muted/40 p-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-background rounded-sm cursor-pointer"
                  onClick={() =>
                    setCurrentMonthDate(subMonths(currentMonthDate, 1))
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-background rounded-sm cursor-pointer"
                  onClick={() =>
                    setCurrentMonthDate(addMonths(currentMonthDate, 1))
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <h2 className="text-sm font-semibold text-foreground capitalize">
              {format(currentMonthDate, "MMMM yyyy", { locale: idLocale })}
            </h2>
          </div>

          {/* Calendar Month Grid */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 border-b border-border bg-muted/30 select-none">
              {[
                "Minggu",
                "Senin",
                "Selasa",
                "Rabu",
                "Kamis",
                "Jumat",
                "Sabtu",
              ].map((dayName) => (
                <div
                  key={dayName}
                  className="py-2 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-r border-border last:border-r-0"
                >
                  {dayName}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 auto-rows-[100px] md:auto-rows-[120px]">
              {calendarDays.map((day, idx) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const dayIssues = calendarIssuesByDate[dateKey] || [];
                const isCurrentMonth = isSameMonth(day, currentMonthDate);
                const isTodayDate = isSameDay(day, new Date());
                const displayedIssues = dayIssues.slice(0, 3);
                const hiddenCount = dayIssues.length - 3;

                return (
                  <div
                    key={idx}
                    className={`flex flex-col p-1.5 border-r border-b border-border/60 transition-colors ${
                      !isCurrentMonth
                        ? "bg-muted/10 text-muted-foreground/40"
                        : "bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 select-none">
                      <span
                        className={`text-[11px] font-semibold h-5 w-5 flex items-center justify-center rounded-full ${
                          isTodayDate
                            ? "bg-primary text-primary-foreground font-bold"
                            : isCurrentMonth
                            ? "text-foreground"
                            : "text-muted-foreground/40"
                        }`}
                      >
                        {format(day, "d")}
                      </span>
                    </div>

                    <div className="flex-1 flex flex-col gap-1 overflow-y-auto scrollbar-none">
                      {displayedIssues.map((issue) => {
                        const badgeColor = getProjectColor(issue.projectKey);
                        return (
                          <div
                            key={issue.id}
                            onClick={() =>
                              router.push(
                                `/projects/${issue.projectId}/issues/${issue.id}`
                              )
                            }
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-border/80 bg-muted/40 hover:bg-accent transition-colors cursor-pointer text-[10px] truncate shadow-2xs group"
                            title={`${issue.displayId}: ${issue.title} (${
                              issue.statusName
                            })${
                              issue.assignee?.name
                                ? ` • ${issue.assignee.name}`
                                : ""
                            }`}
                          >
                            <span
                              className={`px-1 py-0.25 rounded text-[8.5px] font-mono font-bold shrink-0 border ${badgeColor}`}
                            >
                              {issue.displayId}
                            </span>
                            {scope === "team" && issue.assignee && (
                              <span className="text-[8.5px] px-1 py-0.2 rounded bg-muted border border-border/60 text-muted-foreground font-semibold shrink-0 truncate max-w-[55px]">
                                {issue.assignee.name?.split(" ")[0]}
                              </span>
                            )}
                            <span className="truncate font-medium text-foreground">
                              {issue.title}
                            </span>
                          </div>
                        );
                      })}

                      {hiddenCount > 0 && (
                        <span className="text-[9.5px] font-medium text-muted-foreground pl-1">
                          +{hiddenCount} tugas lainnya
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MyTasksPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-100px)] w-full items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <MyTasksContent />
    </Suspense>
  );
}
