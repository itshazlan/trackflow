"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import {
  getIssues,
  createIssue,
  updateIssue,
  deleteIssue,
  getProjectStatuses,
  getTrackers,
  getProjectMembers,
  getProjectTemplates,
  updateIssueStatus,
  getIssueAttachments,
  createIssueAttachment,
  deleteIssueAttachment,
  getIssueComments,
  createIssueComment,
  updateIssueComment,
  deleteIssueComment,
  Issue,
  IssueStatus,
  Tracker,
  ProjectMember,
  IssueTemplate,
  IssueAttachment,
  IssueComment,
} from "@/lib/issues-service";
import { getSession, UserSession } from "@/lib/auth-service";
import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor,
  DragEndEvent,
  DragStartEvent,
  useDroppable,
  useDraggable,
  DragOverlay,
} from "@dnd-kit/core";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  FileImage,
  FileText,
  FileVideo,
  FileAudio,
  FileCode,
  Archive,
  File,
  MessageSquare,
  Send,
  Edit2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
    case "svg":
      return <FileImage className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
    case "pdf":
    case "doc":
    case "docx":
    case "txt":
    case "md":
      return <FileText className="h-3.5 w-3.5 text-orange-500 shrink-0" />;
    case "mp4":
    case "mov":
    case "avi":
    case "mkv":
      return <FileVideo className="h-3.5 w-3.5 text-purple-500 shrink-0" />;
    case "mp3":
    case "wav":
    case "ogg":
      return <FileAudio className="h-3.5 w-3.5 text-pink-500 shrink-0" />;
    case "zip":
    case "rar":
    case "tar":
    case "gz":
    case "7z":
      return <Archive className="h-3.5 w-3.5 text-yellow-600 shrink-0" />;
    case "js":
    case "ts":
    case "tsx":
    case "json":
    case "html":
    case "css":
      return <FileCode className="h-3.5 w-3.5 text-green-500 shrink-0" />;
    default:
      return <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  }
};

function KanbanCard({ issue, onClick }: { issue: Issue; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: issue.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`p-3 rounded-lg border border-border bg-card shadow-xs hover:border-muted-foreground/30 transition-all cursor-grab active:cursor-grabbing flex flex-col gap-2 relative ${
        isDragging ? "opacity-20 border-dashed border-muted-foreground/30 bg-muted/30 text-transparent select-none pointer-events-none *" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[9.5px] font-semibold text-muted-foreground bg-muted/80 border border-border/80 px-1.5 py-0.25 rounded uppercase">
          {issue.displayId || `#${issue.id.slice(0, 6)}`}
        </span>
        <span
          className={`text-[9.5px] font-bold px-1.5 py-0.25 rounded-full capitalize select-none ${
            issue.priority === "urgent"
              ? "bg-destructive/10 border border-destructive/20 text-destructive font-bold"
              : issue.priority === "high"
              ? "bg-red-400/10 border border-red-400/20 text-red-500"
              : issue.priority === "medium"
              ? "bg-amber-400/10 border border-amber-400/20 text-amber-600"
              : "bg-muted border border-border text-muted-foreground"
          }`}
        >
          {issue.priority}
        </span>
      </div>

      <h4 className="text-[12px] font-medium text-foreground line-clamp-2 leading-snug">
        {issue.title}
      </h4>

      <div className="flex items-center justify-between border-t border-border/40 pt-2 mt-1">
        <span className="inline-flex items-center rounded border border-border px-1.5 py-0.25 text-[9px] font-medium bg-muted/20 text-muted-foreground select-none">
          {issue.tracker?.name || "Task"}
        </span>

        <div className="flex items-center gap-1.5">
          <Avatar className="h-4.5 w-4.5">
            {issue.assignee?.image ? (
              <img src={issue.assignee.image} alt={issue.assignee.name} className="h-full w-full object-cover rounded-full" />
            ) : (
              <AvatarFallback className="text-[7.5px] font-bold bg-primary/10 border border-primary/20 text-primary uppercase">
                {issue.assignee ? issue.assignee.name.slice(0, 2).toUpperCase() : "-"}
              </AvatarFallback>
            )}
          </Avatar>
        </div>
      </div>
    </div>
  );
}

function KanbanCardOverlay({ issue }: { issue: Issue }) {
  if (!issue) return null;
  return (
    <div
      className="p-3 rounded-lg border border-border bg-card shadow-md flex flex-col gap-2 relative w-[252px] select-none cursor-grabbing opacity-95 rotate-2 scale-[1.02] z-50 pointer-events-none"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[9.5px] font-semibold text-muted-foreground bg-muted/80 border border-border/80 px-1.5 py-0.25 rounded uppercase">
          {issue.displayId || `#${issue.id.slice(0, 6)}`}
        </span>
        <span
          className={`text-[9.5px] font-bold px-1.5 py-0.25 rounded-full capitalize select-none ${
            issue.priority === "urgent"
              ? "bg-destructive/10 border border-destructive/20 text-destructive font-bold"
              : issue.priority === "high"
              ? "bg-red-400/10 border border-red-400/20 text-red-500"
              : issue.priority === "medium"
              ? "bg-amber-400/10 border border-amber-400/20 text-amber-600"
              : "bg-muted border border-border text-muted-foreground"
          }`}
        >
          {issue.priority}
        </span>
      </div>

      <h4 className="text-[12px] font-medium text-foreground line-clamp-2 leading-snug">
        {issue.title}
      </h4>

      <div className="flex items-center justify-between border-t border-border/40 pt-2 mt-1">
        <span className="inline-flex items-center rounded border border-border px-1.5 py-0.25 text-[9px] font-medium bg-muted/20 text-muted-foreground select-none">
          {issue.tracker?.name || "Task"}
        </span>

        <div className="flex items-center gap-1.5">
          <Avatar className="h-4.5 w-4.5">
            {issue.assignee?.image ? (
              <img src={issue.assignee.image} alt={issue.assignee.name} className="h-full w-full object-cover rounded-full" />
            ) : (
              <AvatarFallback className="text-[7.5px] font-bold bg-primary/10 border border-primary/20 text-primary uppercase">
                {issue.assignee ? issue.assignee.name.slice(0, 2).toUpperCase() : "-"}
              </AvatarFallback>
            )}
          </Avatar>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({
  status,
  issues,
  isDragging,
  isDropAllowed,
  onCardClick,
}: {
  status: IssueStatus;
  issues: Issue[];
  isDragging: boolean;
  isDropAllowed: boolean;
  onCardClick: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status.id,
    disabled: isDragging && !isDropAllowed,
  });

  const columnBg = isOver && isDropAllowed
    ? "bg-accent/20 border-accent/40"
    : isDragging && !isDropAllowed
    ? "opacity-50 border-destructive/20 bg-destructive/5 cursor-not-allowed"
    : "bg-muted/10 border-border/60";

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-3 p-3.5 rounded-xl border min-w-[280px] max-w-[300px] h-[calc(100vh-270px)] min-h-[480px] transition-all shrink-0 ${columnBg}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-[12px] font-semibold text-foreground truncate max-w-[150px]">
            {status.name}
          </h3>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted/80 px-1 text-[9.5px] font-semibold text-muted-foreground border border-border">
            {issues.length}
          </span>
        </div>
        {status.restrictedToRole && (
          <span className="rounded bg-destructive/10 border border-destructive/20 text-destructive text-[8px] px-1.5 py-0.25 uppercase font-bold tracking-wider">
            {status.restrictedToRole.replace("_", " ")}
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto pr-1 scrollbar-thin select-none">
        {issues.length === 0 ? (
          <div className="flex-1 flex items-center justify-center border border-dashed border-border/30 rounded-lg p-6 bg-card/10">
            <span className="text-[10.5px] text-muted-foreground/60 italic text-center">
              Belum ada tiket
            </span>
          </div>
        ) : (
          issues.map((issue) => (
            <KanbanCard
              key={issue.id}
              issue={issue}
              onClick={() => onCardClick(issue.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface IssuesSectionProps {
  projectId: string;
}

export default function IssuesSection({ projectId }: IssuesSectionProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"list" | "kanban" | "calendar">("list");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedMode = localStorage.getItem("trackflow:issues-view-mode");
      if (savedMode === "list" || savedMode === "kanban" || savedMode === "calendar") {
        if (window.innerWidth >= 640) {
          setViewMode(savedMode);
        }
      }
    }
  }, []);

  const changeViewMode = (mode: "list" | "kanban" | "calendar") => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("trackflow:issues-view-mode", mode);
    }
  };
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

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

  // Edit Issue Modal state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTrackerId, setEditTrackerId] = useState("");
  const [editStatusId, setEditStatusId] = useState("");
  const [editPriority, setEditPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>("medium");
  const [editAssigneeId, setEditAssigneeId] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSelectedFiles, setEditSelectedFiles] = useState<File[]>([]);
  const [editDragging, setEditDragging] = useState(false);

  // Create Issue Attachments state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isDetailDragging, setIsDetailDragging] = useState(false);

  // Detail Issue Dialog state
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [attachments, setAttachments] = useState<IssueAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);

  // Comments state
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [newCommentText, setNewCommentText] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");

  // Filter states
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setViewMode("list");
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // TanStack Query queries
  const { data: session = null } = useQuery<UserSession | null>({
    queryKey: ["session"],
    queryFn: () => getSession(),
  });

  const { data: issuesList = [], isLoading: issuesLoading, error: issuesError } = useQuery<Issue[]>({
    queryKey: ["issues", projectId],
    queryFn: () => getIssues(projectId),
  });

  const { data: statuses = [], isLoading: statusesLoading } = useQuery<IssueStatus[]>({
    queryKey: ["issue-statuses", projectId],
    queryFn: () => getProjectStatuses(projectId),
  });

  const { data: trackers = [] } = useQuery<Tracker[]>({
    queryKey: ["trackers"],
    queryFn: () => getTrackers(),
  });

  const { data: members = [] } = useQuery<ProjectMember[]>({
    queryKey: ["members", projectId],
    queryFn: () => getProjectMembers(projectId),
  });

  const { data: templates = [] } = useQuery<IssueTemplate[]>({
    queryKey: ["templates", projectId],
    queryFn: () => getProjectTemplates(projectId),
  });

  const loading = issuesLoading || statusesLoading;
  const error = issuesError ? "Gagal memuat data issues." : "";

  // Auto-set defaults when data becomes available
  useEffect(() => {
    if (statuses.length > 0 && !statusId) {
      setStatusId(statuses[0].id);
    }
  }, [statuses, statusId]);

  useEffect(() => {
    if (trackers.length > 0 && !selectedTrackerId) {
      setSelectedTrackerId(trackers[0].id);
    }
  }, [trackers, selectedTrackerId]);

  // dnd-kit configuration
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const sortedStatuses = useMemo(() => {
    return [...statuses].sort((a, b) => a.orderIndex - b.orderIndex);
  }, [statuses]);

  const issuesByStatus = useMemo(() => {
    const map: Record<string, Issue[]> = {};
    statuses.forEach((s) => {
      map[s.id] = [];
    });
    issuesList.forEach((iss) => {
      const sId = iss.statusId || iss.status?.id;
      if (sId && map[sId]) {
        map[sId].push(iss);
      }
    });
    return map;
  }, [statuses, issuesList]);

  const issuesByDueDate = useMemo(() => {
    const map: Record<string, Issue[]> = {};
    issuesList.forEach((iss) => {
      if (iss.dueDate) {
        try {
          const dateKey = format(new Date(iss.dueDate), "yyyy-MM-dd");
          if (!map[dateKey]) map[dateKey] = [];
          map[dateKey].push(iss);
        } catch (err) {
          console.error("Gagal memformat tanggal due date:", err);
        }
      }
    });
    return map;
  }, [issuesList]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonthDate);
    const monthEnd = endOfMonth(monthStart);
    const weekStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [currentMonthDate]);

  // Determine current user project role
  const currentMember = members.find(
    (m) => m.email === session?.user?.email || m.username === session?.user?.username
  );
  const userRole = currentMember?.role;
  const isAdmin = session?.user?.isAdmin;

  // Determine if a status is allowed for dropping
  const isDropAllowed = useCallback((status: IssueStatus) => {
    if (isAdmin) return true;
    if (!status.restrictedToRole) return true;
    return userRole === status.restrictedToRole;
  }, [isAdmin, userRole]);

  // Mutation for updating status with optimistic updates
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, statusId }: { id: string; statusId: string }) =>
      updateIssueStatus(id, statusId),
    onMutate: async ({ id, statusId }) => {
      await queryClient.cancelQueries({ queryKey: ["issues", projectId] });
      const previousIssues = queryClient.getQueryData<Issue[]>(["issues", projectId]);

      if (previousIssues) {
        const nextStatus = statuses.find((s) => s.id === statusId);
        queryClient.setQueryData<Issue[]>(
          ["issues", projectId],
          previousIssues.map((iss) =>
            iss.id === id
              ? {
                  ...iss,
                  statusId,
                  status: nextStatus
                    ? { id: nextStatus.id, name: nextStatus.name }
                    : iss.status,
                }
              : iss
          )
        );
      }
      return { previousIssues };
    },
    onError: (err, variables, context) => {
      if (context?.previousIssues) {
        queryClient.setQueryData(["issues", projectId], context.previousIssues);
      }
      setToast({
        message: err instanceof Error ? err.message : "Gagal memindahkan tiket",
        type: "error",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues", projectId] });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) return;

    const issueId = active.id as string;
    const targetStatusId = over.id as string;

    const issue = issuesList.find((iss) => iss.id === issueId);
    if (!issue) return;

    if (issue.statusId === targetStatusId) return;

    const targetStatus = statuses.find((s) => s.id === targetStatusId);
    if (targetStatus && !isDropAllowed(targetStatus)) {
      setToast({
        message: `Status "${targetStatus.name}" dibatasi untuk peran "${targetStatus.restrictedToRole?.replace("_", " ")}"`,
        type: "error",
      });
      return;
    }

    updateStatusMutation.mutate({ id: issueId, statusId: targetStatusId });
  };

  useEffect(() => {
    if (selectedIssue && isDetailOpen) {
      setAttachmentsLoading(true);
      getIssueAttachments(selectedIssue.id)
        .then((data) => setAttachments(data))
        .catch((err) => console.error("Gagal mengambil lampiran:", err))
        .finally(() => setAttachmentsLoading(false));

      setCommentsLoading(true);
      setCommentsError("");
      getIssueComments(selectedIssue.id)
        .then((data) => setComments(data))
        .catch((err) => {
          console.error("Gagal mengambil komentar:", err);
          setCommentsError("Gagal memuat komentar.");
        })
        .finally(() => setCommentsLoading(false));
    } else {
      setAttachments([]);
      setComments([]);
      setNewCommentText("");
      setEditingCommentId(null);
      setEditingCommentText("");
    }
  }, [selectedIssue, isDetailOpen]);

  useEffect(() => {
    if (!session?.user?.id) return;

    const socketUrl =
      typeof window !== "undefined" && window.location.hostname === "localhost"
        ? "http://localhost:3000"
        : "";

    const socket = io(socketUrl, {
      query: { userId: session.user.id },
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      console.log("[Socket.io] Connected to realtime gateway");
      socket.emit("joinProject", projectId);
    });

    socket.on("issue.comment_created", (payload: { issueId: string; commentId: string; authorId: string }) => {
      console.log("[Socket.io] Comment created:", payload);
      // Invalidate react-query cache for issues
      queryClient.invalidateQueries({ queryKey: ["issues", projectId] });
      queryClient.invalidateQueries({ queryKey: ["issues"] });

      // If the currently viewed issue is the one that got a new comment, refresh its comments list
      if (selectedIssue && selectedIssue.id === payload.issueId) {
        getIssueComments(selectedIssue.id)
          .then((data) => setComments(data))
          .catch((err) => console.error("Gagal memperbarui komentar via socket:", err));
      }
    });

    return () => {
      socket.emit("leaveProject", projectId);
      socket.disconnect();
    };
  }, [projectId, session?.user?.id, selectedIssue, queryClient]);

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

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue || !newCommentText.trim()) return;

    setDetailLoading(true);
    setCommentsError("");
    try {
      const comment = await createIssueComment(selectedIssue.id, newCommentText);
      setComments((prev) => [...prev, comment]);
      setNewCommentText("");
    } catch (err: unknown) {
      setCommentsError(err instanceof Error ? err.message : "Gagal menambahkan komentar.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStartEditComment = (commentId: string, currentBody: string) => {
    setEditingCommentId(commentId);
    setEditingCommentText(currentBody);
  };

  const handleSaveEditComment = async (commentId: string) => {
    if (!selectedIssue || !editingCommentText.trim()) return;

    setDetailLoading(true);
    setCommentsError("");
    try {
      const updated = await updateIssueComment(selectedIssue.id, commentId, editingCommentText);
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      setEditingCommentId(null);
      setEditingCommentText("");
    } catch (err: unknown) {
      setCommentsError(err instanceof Error ? err.message : "Gagal mengubah komentar.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedIssue) return;
    const ok = await confirm({
      title: "Hapus Komentar",
      description: "Apakah Anda yakin ingin menghapus komentar ini?",
      confirmLabel: "Hapus",
      variant: "destructive",
    });
    if (!ok) return;

    setDetailLoading(true);
    setCommentsError("");
    try {
      await deleteIssueComment(selectedIssue.id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err: unknown) {
      setCommentsError(err instanceof Error ? err.message : "Gagal menghapus komentar.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUploadDetailFiles = async (files: FileList) => {
    if (!selectedIssue) return;
    const filesArr = Array.from(files);
    if (filesArr.length === 0) return;

    setDetailLoading(true);
    setDetailError("");
    try {
      const uploaded: IssueAttachment[] = [];
      for (const file of filesArr) {
        const attachment = await createIssueAttachment(selectedIssue.id, file);
        uploaded.push(attachment);
      }

      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err: unknown) {
      setDetailError(err instanceof Error ? err.message : "Gagal mengunggah lampiran.");
    } finally {
      setDetailLoading(false);
    }
  };

  // Find matching template
  const bugTemplate = templates.find((t) => t.trackerId === selectedTrackerId);

  const handleOpenCreateModal = () => {
    const defaultTrackerId = selectedTrackerId || 
      (templates.length > 0 ? templates[0].trackerId : (trackers.length > 0 ? trackers[0].id : ""));
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
    if (statuses.length > 0) {
      setStatusId(statuses[0].id);
    }
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
        await createIssueAttachment(newIssue.id, file);
      }

      setIsCreateOpen(false);
      // Reset states
      setTitle("");
      setDescription("");
      setPriority("medium");
      setAssigneeId("");
      setDueDate("");
      setSelectedFiles([]);
      if (statuses.length > 0) {
        setStatusId(statuses[0].id);
      }
      queryClient.invalidateQueries({ queryKey: ["issues", projectId] });
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Gagal membuat issue.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleOpenEditModal = () => {
    if (!selectedIssue) return;
    setEditTitle(selectedIssue.title || "");
    setEditDescription(selectedIssue.description || "");
    setEditTrackerId(selectedIssue.trackerId || "");
    setEditStatusId(selectedIssue.statusId || "");
    setEditPriority(selectedIssue.priority || "medium");
    setEditAssigneeId(selectedIssue.assigneeId || "");
    setEditDueDate(selectedIssue.dueDate ? selectedIssue.dueDate.split("T")[0] : "");
    setEditSelectedFiles([]);
    setEditError("");
    setIsEditOpen(true);
  };

  const handleSaveEditIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue) return;

    setEditLoading(true);
    setEditError("");

    try {
      if (!editTitle.trim()) {
        throw new Error("Judul tiket wajib diisi.");
      }

      // Update issue details
      const updatedIssue = await updateIssue(projectId, selectedIssue.id, {
        title: editTitle,
        description: editDescription || null,
        trackerId: editTrackerId,
        statusId: editStatusId,
        priority: editPriority,
        assigneeId: editAssigneeId || null,
        dueDate: editDueDate || null,
      });

      // Upload selected files sequentially
      for (const file of editSelectedFiles) {
        await createIssueAttachment(selectedIssue.id, file);
      }

      // Invalidate TanStack Query caches
      queryClient.invalidateQueries({ queryKey: ["issues", projectId] });
      queryClient.invalidateQueries({ queryKey: ["issues"] });

      // Refresh attachments in local details state
      const updatedAttachments = await getIssueAttachments(selectedIssue.id);
      setAttachments(updatedAttachments);

      // Construct next issue state
      const matchingTracker = trackers.find((t) => t.id === editTrackerId);
      const matchingStatus = statuses.find((s) => s.id === editStatusId);
      const matchingAssignee = members.find((m) => m.id === editAssigneeId);

      const nextIssue: Issue = {
        ...selectedIssue,
        title: editTitle,
        description: editDescription || null,
        trackerId: editTrackerId,
        statusId: editStatusId,
        priority: editPriority,
        assigneeId: editAssigneeId || null,
        dueDate: editDueDate || null,
        tracker: matchingTracker ? { id: matchingTracker.id, name: matchingTracker.name } : selectedIssue.tracker,
        status: matchingStatus ? { id: matchingStatus.id, name: matchingStatus.name } : selectedIssue.status,
        assignee: matchingAssignee ? { id: matchingAssignee.id, name: matchingAssignee.name, email: matchingAssignee.email } : null,
      };

      setSelectedIssue(nextIssue);
      setIsEditOpen(false);
      setEditSelectedFiles([]);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Gagal menyimpan perubahan tiket.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleStatusChange = async (issueId: string, newStatusId: string) => {
    setDetailLoading(true);
    setDetailError("");
    try {
      const updated = await updateIssueStatus(issueId, newStatusId);
      queryClient.invalidateQueries({ queryKey: ["issues", projectId] });
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
      queryClient.invalidateQueries({ queryKey: ["issues", projectId] });
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


  // Determine if user can edit this issue
  const isIssueAssignee = selectedIssue?.assigneeId === session?.user?.id;
  const isIssueCreator = selectedIssue?.createdBy === session?.user?.id;
  const isProjectManager = userRole === "manager";
  const isSystemAdmin = isAdmin;

  const canEdit = selectedIssue && (isIssueAssignee || isIssueCreator || isProjectManager || isSystemAdmin);

  // Filter issues
  const filteredIssues = issuesList.filter((iss) => {
    const matchesStatus = filterStatus === "all" || (iss.statusId || iss.status?.id) === filterStatus;
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
    <div className="flex flex-col gap-4 pb-8">
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

          {/* View Toggle */}
          <div className="hidden sm:flex items-center gap-1 bg-muted p-[3px] rounded-md border border-border h-8 box-border">
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 px-2.5 text-[11px] font-medium rounded-sm transition-all ${
                viewMode === "list"
                  ? "bg-background text-foreground shadow-xs border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => changeViewMode("list")}
            >
              List
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 px-2.5 text-[11px] font-medium rounded-sm transition-all ${
                viewMode === "kanban"
                  ? "bg-background text-foreground shadow-xs border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => changeViewMode("kanban")}
            >
              Kanban
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 px-2.5 text-[11px] font-medium rounded-sm transition-all ${
                viewMode === "calendar"
                  ? "bg-background text-foreground shadow-xs border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => changeViewMode("calendar")}
            >
              Kalender
            </Button>
          </div>
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

      {viewMode === "list" ? (
        <>
          {/* Mobile Card List View (visible on < sm, hidden on >= sm) */}
          <div className="flex flex-col gap-2.5 sm:hidden">
            {filteredIssues.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground text-[12px] italic">
                Tidak ada tiket ditemukan.
              </div>
            ) : (
              filteredIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="rounded-lg border border-border bg-card p-3.5 flex flex-col gap-2.5 shadow-xs cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => {
                    router.push(`/projects/${projectId}/issues/${issue.id}`);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {issue.displayId ? (
                        <span className="shrink-0 inline-flex items-center rounded bg-muted/80 border border-border px-1.5 py-0.5 text-[9px] font-mono font-semibold text-muted-foreground uppercase">
                          {issue.displayId}
                        </span>
                      ) : (
                        <span className="shrink-0 font-mono text-[9px] text-muted-foreground">
                          #{issue.id.slice(0, 6)}
                        </span>
                      )}
                      <h4 className="font-semibold text-foreground text-[12.5px] truncate">{issue.title}</h4>
                    </div>
                    <span className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[9px] font-medium bg-muted/30 text-muted-foreground shrink-0 select-none">
                      {issue.tracker?.name || "Task"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-border/50 pt-2.5 mt-0.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded bg-secondary px-2 py-0.5 text-[9px] font-semibold border border-border text-muted-foreground">
                        {issue.status?.name || "New"}
                      </span>
                      <span
                        className={`text-[10px] font-semibold capitalize ${
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
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Avatar className="h-4.5 w-4.5">
                          <AvatarFallback className="text-[8px] font-bold">
                            {issue.assignee ? issue.assignee.name.slice(0, 2).toUpperCase() : "-"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate max-w-[80px] text-[11px] text-muted-foreground">
                          {issue.assignee?.name || "Unassigned"}
                        </span>
                      </div>
                      {issue.dueDate && (
                        <span className="text-muted-foreground text-[10px] shrink-0">
                          {new Date(issue.dueDate).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
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
                        router.push(`/projects/${projectId}/issues/${issue.id}`);
                      }}
                    >
                      <TableCell className="font-mono text-[11px] text-muted-foreground pl-4">
                        #{issue.id.slice(0, 6)}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        <div className="flex items-center gap-1.5 max-w-[600px]">
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
                            {issue.assignee?.image ? (
                              <img src={issue.assignee.image} alt={issue.assignee.name} className="h-full w-full object-cover rounded-full" />
                            ) : (
                              <AvatarFallback className="text-[8px] font-bold">
                                {issue.assignee ? issue.assignee.name.slice(0, 2).toUpperCase() : "-"}
                              </AvatarFallback>
                            )}
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
        </>
      ) : viewMode === "kanban" ? (
        /* Kanban Board */
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin max-w-full">
            {sortedStatuses.map((status) => {
              const columnIssues = (issuesByStatus[status.id] || []).filter((iss) => {
                const matchesPriority = filterPriority === "all" || iss.priority === filterPriority;
                const matchesAssignee =
                  filterAssignee === "all" ||
                  (filterAssignee === "unassigned" && !iss.assigneeId) ||
                  iss.assigneeId === filterAssignee;
                const matchesSearch =
                  iss.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (iss.description && iss.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
                  iss.id.toLowerCase().includes(searchQuery.toLowerCase());
                return matchesPriority && matchesAssignee && matchesSearch;
              });

              return (
                <KanbanColumn
                  key={status.id}
                  status={status}
                  issues={columnIssues}
                  isDragging={activeDragId !== null}
                  isDropAllowed={isDropAllowed(status)}
                  onCardClick={(id) => router.push(`/projects/${projectId}/issues/${id}`)}
                />
              );
            })}
            
            {/* Add Status Button at the end of columns */}
            <div className="flex flex-col min-w-[280px] shrink-0 pt-4">
              <Button
                variant="outline"
                className="h-10 text-[11px] font-medium border-dashed text-muted-foreground w-full hover:text-foreground hover:bg-muted/30"
                onClick={() => router.push(`/projects/${projectId}?tab=settings`)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Tambah Status
              </Button>
            </div>
          </div>

          <DragOverlay>
            {activeDragId ? (
              <KanbanCardOverlay
                issue={issuesList.find((iss) => iss.id === activeDragId)!}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        /* Calendar View */
        <div className="flex flex-col gap-3">
          {/* Calendar Toolbar */}
          <div className="flex items-center justify-between border border-border bg-card p-3 rounded-lg shadow-xs select-none">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5 font-medium"
                onClick={() => setCurrentMonthDate(new Date())}
              >
                Hari Ini
              </Button>
              <div className="flex items-center border border-border rounded-md overflow-hidden bg-muted/40 p-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-background rounded-sm"
                  onClick={() => setCurrentMonthDate(subMonths(currentMonthDate, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-background rounded-sm"
                  onClick={() => setCurrentMonthDate(addMonths(currentMonthDate, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <h2 className="text-[13px] font-semibold text-foreground capitalize">
              {format(currentMonthDate, "MMMM yyyy", { locale: idLocale })}
            </h2>
          </div>

          {/* Calendar Grid */}
          <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
            {/* Days of Week Headers */}
            <div className="grid grid-cols-7 border-b border-border bg-muted/30 select-none">
              {["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"].map((dayName) => (
                <div key={dayName} className="py-2 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-r border-border last:border-r-0">
                  {dayName}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 auto-rows-[100px] md:auto-rows-[120px]">
              {calendarDays.map((day, idx) => {
                const dateKey = format(day, "yyyy-MM-dd");
                
                // Get issues that belong to this date (taking filter state into account)
                const dayIssues = (issuesByDueDate[dateKey] || []).filter((iss) => {
                  const matchesStatus = filterStatus === "all" || (iss.statusId || iss.status?.id) === filterStatus;
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

                const isCurrentMonth = isSameMonth(day, currentMonthDate);
                const isTodayDate = isSameDay(day, new Date());
                const displayedIssues = dayIssues.slice(0, 3);
                const hiddenCount = dayIssues.length - 3;

                return (
                  <div
                    key={idx}
                    className={`p-1.5 border-r border-b border-border last:border-r-0 flex flex-col gap-1 min-w-0 ${
                      !isCurrentMonth ? "bg-muted/10 text-muted-foreground/50" : "bg-card text-foreground"
                    }`}
                  >
                    <div className="flex justify-between items-center select-none mb-0.5">
                      <span className={`text-[10.5px] font-semibold flex h-5 w-5 items-center justify-center rounded-full ${
                        isTodayDate ? "bg-primary text-primary-foreground font-bold shadow-xs" : "text-muted-foreground"
                      }`}>
                        {format(day, "d")}
                      </span>
                    </div>

                    <div className="flex-1 flex flex-col gap-1 overflow-y-auto pr-0.5 scrollbar-none">
                      {displayedIssues.map((issue) => (
                        <button
                          key={issue.id}
                          onClick={() => router.push(`/projects/${projectId}/issues/${issue.id}`)}
                          className={`w-full text-left p-1 rounded border text-[10px] font-medium leading-none truncate flex items-center justify-between gap-1 select-none hover:brightness-95 transition-all ${
                            issue.priority === "urgent"
                              ? "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
                              : issue.priority === "high"
                              ? "bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400"
                              : issue.priority === "medium"
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-500"
                              : "bg-muted/40 border-border text-muted-foreground"
                          }`}
                        >
                          <span className="truncate flex-1">
                            {issue.displayId || `#${issue.id.slice(0, 4)}`}: {issue.title}
                          </span>
                        </button>
                      ))}
                      {hiddenCount > 0 && (
                        <div className="text-[9px] font-semibold text-muted-foreground/70 pl-1 py-0.5 select-none">
                          +{hiddenCount} lainnya
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Create Issue Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
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
                  {templates.length > 0
                    ? templates.map((tpl) => (
                        <option key={tpl.trackerId} value={tpl.trackerId}>
                          {tpl.name}
                        </option>
                      ))
                    : trackers.map((t) => (
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
                  className="min-h-[180px] w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-[12.5px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  disabled={createLoading}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />
                  Lampiran (Attachments)
                </Label>
                <div
                  className={`flex flex-col gap-2 rounded-md border p-2.5 bg-card/30 transition-all ${
                    isDragging ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-input"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files) {
                      const filesArr = Array.from(e.dataTransfer.files);
                      setSelectedFiles((prev) => [...prev, ...filesArr]);
                    }
                  }}
                >
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
                        ? "Pilih atau seret file ke sini..."
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
                          className="flex items-center justify-between bg-muted/40 hover:bg-muted/70 px-2 py-0.5 rounded text-[11.5px] text-foreground group gap-2"
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            {getFileIcon(file.name)}
                            <span className="truncate font-medium">{file.name}</span>
                          </div>
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
                              <X className="h-3.5 w-3.5" />
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

              <div className="grid grid-cols-2 gap-3">
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

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="issue-status-select" className="text-[11px] font-medium text-muted-foreground">
                    Status Tiket
                  </Label>
                  <select
                    id="issue-status-select"
                    value={statusId}
                    onChange={(e) => setStatusId(e.target.value)}
                    className="h-8 rounded-md border border-input bg-card px-2 text-[12.5px] outline-none"
                    disabled={createLoading}
                  >
                    {statuses.map((st) => {
                      const isRestricted = st.restrictedToRole !== null;
                      const isRoleMatched = st.restrictedToRole === userRole;
                      const disabled = isRestricted && !isRoleMatched && !isAdmin;

                      return (
                        <option key={st.id} value={st.id} disabled={disabled}>
                          {st.name} {disabled ? "🔒" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
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

      {/* Edit Issue Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
          <form onSubmit={handleSaveEditIssue}>
            <DialogHeader>
              <DialogTitle className="text-[14.5px] font-semibold">Edit Tiket</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-3.5 py-4">
              {editError && (
                <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive leading-normal">
                  <AlertCircle className="h-3.5 w-3.5 mt-[1px] shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-tracker-select" className="text-[11px] font-medium text-muted-foreground">
                  Tracker / Tipe Tiket
                </Label>
                <select
                  id="edit-tracker-select"
                  value={editTrackerId}
                  onChange={(e) => setEditTrackerId(e.target.value)}
                  className="h-8 w-full rounded-md border border-input bg-card px-2 text-[12.5px] outline-none"
                  disabled={editLoading}
                >
                  {templates.length > 0
                    ? templates.map((tpl) => (
                        <option key={tpl.trackerId} value={tpl.trackerId}>
                          {tpl.name}
                        </option>
                      ))
                    : trackers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-issue-title" className="text-[11px] font-medium text-muted-foreground">
                  Judul Tiket
                </Label>
                <Input
                  id="edit-issue-title"
                  type="text"
                  placeholder="Masukkan judul singkat..."
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  className="h-8 text-[12.5px]"
                  disabled={editLoading}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-issue-desc" className="text-[11px] font-medium text-muted-foreground">
                  Deskripsi Masalah
                </Label>
                <textarea
                  id="edit-issue-desc"
                  placeholder="Detail deskripsi tugas atau tiket..."
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="min-h-[180px] w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-[12.5px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  disabled={editLoading}
                />
              </div>

              {/* Existing attachments list */}
              {attachments.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    Lampiran Saat Ini ({attachments.length})
                  </Label>
                  <div className="flex flex-col gap-1.5 max-h-[120px] overflow-y-auto pr-1 border border-border rounded-md p-2 bg-muted/10">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between border border-border/80 bg-background px-2.5 py-1 rounded text-[11.5px] group gap-2"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {getFileIcon(att.fileName)}
                          <span className="truncate font-medium text-foreground">{att.fileName}</span>
                        </div>
                        {(att.uploadedBy === session?.user?.id || session?.user?.isAdmin) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteAttachment(att.id)}
                            className="text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
                            disabled={editLoading}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload new attachments */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />
                  Tambah Lampiran Baru
                </Label>
                <div
                  className={`flex flex-col gap-2 rounded-md border p-2.5 bg-card/30 transition-all ${
                    editDragging ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-input"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setEditDragging(true);
                  }}
                  onDragLeave={() => setEditDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setEditDragging(false);
                    if (e.dataTransfer.files) {
                      const filesArr = Array.from(e.dataTransfer.files);
                      setEditSelectedFiles((prev) => [...prev, ...filesArr]);
                    }
                  }}
                >
                  <input
                    type="file"
                    multiple
                    id="edit-issue-files-input"
                    onChange={(e) => {
                      if (e.target.files) {
                        const filesArr = Array.from(e.target.files);
                        setEditSelectedFiles((prev) => [...prev, ...filesArr]);
                      }
                    }}
                    className="hidden"
                    disabled={editLoading}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      {editSelectedFiles.length === 0
                        ? "Pilih atau seret file ke sini..."
                        : `${editSelectedFiles.length} file baru dipilih`}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10.5px] font-medium px-2"
                      onClick={() => document.getElementById("edit-issue-files-input")?.click()}
                      disabled={editLoading}
                    >
                      Pilih File
                    </Button>
                  </div>
                  {editSelectedFiles.length > 0 && (
                    <div className="flex flex-col gap-1 mt-1 border-t border-border/50 pt-1.5 max-h-[100px] overflow-y-auto pr-1">
                      {editSelectedFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-muted/40 hover:bg-muted/70 px-2 py-0.5 rounded text-[11.5px] text-foreground group gap-2"
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            {getFileIcon(file.name)}
                            <span className="truncate font-medium">{file.name}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-2">
                            {(file.size / 1024).toFixed(1)} KB
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
                              onClick={() =>
                                setEditSelectedFiles((prev) => prev.filter((_, i) => i !== idx))
                              }
                              disabled={editLoading}
                            >
                              <X className="h-3.5 w-3.5" />
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
                  <Label htmlFor="edit-status-select" className="text-[11px] font-medium text-muted-foreground">
                    Status
                  </Label>
                  <select
                    id="edit-status-select"
                    value={editStatusId}
                    onChange={(e) => setEditStatusId(e.target.value)}
                    className="h-8 rounded-md border border-input bg-card px-2 text-[12.5px] outline-none"
                    disabled={editLoading}
                  >
                    {statuses.map((st) => {
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
                  <Label htmlFor="edit-issue-priority" className="text-[11px] font-medium text-muted-foreground">
                    Prioritas
                  </Label>
                  <select
                    id="edit-issue-priority"
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as 'low' | 'medium' | 'high' | 'urgent')}
                    className="h-8 rounded-md border border-input bg-card px-2 text-[12.5px] outline-none"
                    disabled={editLoading}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-issue-assignee" className="text-[11px] font-medium text-muted-foreground">
                    Assignee
                  </Label>
                  <select
                    id="edit-issue-assignee"
                    value={editAssigneeId}
                    onChange={(e) => setEditAssigneeId(e.target.value)}
                    className="h-8 rounded-md border border-input bg-card px-2 text-[12.5px] outline-none"
                    disabled={editLoading}
                  >
                    <option value="">Belum Ditugaskan</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-issue-duedate" className="text-[11px] font-medium text-muted-foreground">
                    Due Date (Batas Waktu)
                  </Label>
                  <Input
                    id="edit-issue-duedate"
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="h-8 text-[12.5px]"
                    disabled={editLoading}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-8 text-[12px]"
                onClick={() => setIsEditOpen(false)}
                disabled={editLoading}
              >
                Batal
              </Button>
              <Button type="submit" className="h-8 text-[12px]" disabled={editLoading}>
                {editLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Perubahan"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Floating Toast Notification Banner */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs shadow-md backdrop-blur-xs transition-all animate-in fade-in slide-in-from-bottom-2 ${
          toast.type === "error" 
            ? "border-destructive/20 bg-destructive/10 text-destructive dark:text-red-400" 
            : "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        }`}>
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
