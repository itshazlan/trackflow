"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import {
  getIssueDetail,
  updateIssue,
  deleteIssue,
  getProjectStatuses,
  getProjectMembers,
  getTrackers,
  getIssueAttachments,
  createIssueAttachment,
  deleteIssueAttachment,
  getIssueComments,
  createIssueComment,
  updateIssueComment,
  deleteIssueComment,
  updateIssueStatus,
  Issue,
  IssueStatus,
  Tracker,
  ProjectMember,
  IssueAttachment,
  IssueComment,
} from "@/lib/issues-service";
import { getProjectDetail, Project } from "@/lib/projects-service";
import { getSession, UserSession } from "@/lib/auth-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Loader2,
  AlertCircle,
  Trash2,
  Calendar,
  Paperclip,
  X,
  Send,
  Edit2,
  FileImage,
  FileText,
  FileVideo,
  FileAudio,
  FileCode,
  Archive,
  File,
  MessageSquare,
  Copy,
  Check,
  AtSign,
  Smile,
  Video,
} from "lucide-react";

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "svg":
    case "webp":
      return <FileImage className="h-4 w-4 text-blue-500 shrink-0" />;
    case "mp4":
    case "mov":
    case "avi":
    case "webm":
      return <FileVideo className="h-4 w-4 text-purple-500 shrink-0" />;
    case "mp3":
    case "wav":
    case "ogg":
    case "m4a":
      return <FileAudio className="h-4 w-4 text-pink-500 shrink-0" />;
    case "pdf":
      return <FileText className="h-4 w-4 text-red-500 shrink-0" />;
    case "zip":
    case "tar":
    case "gz":
    case "rar":
    case "7z":
      return <Archive className="h-4 w-4 text-orange-500 shrink-0" />;
    case "js":
    case "ts":
    case "tsx":
    case "html":
    case "css":
    case "json":
    case "py":
    case "go":
      return <FileCode className="h-4 w-4 text-green-500 shrink-0" />;
    default:
      return <File className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
};

export default function IssueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const projectId = params?.id as string;
  const issueId = params?.issueId as string;

  const [session, setSession] = useState<UserSession | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [statuses, setStatuses] = useState<IssueStatus[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [attachments, setAttachments] = useState<IssueAttachment[]>([]);
  const [comments, setComments] = useState<IssueComment[]>([]);

  // Page states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [isDetailDragging, setIsDetailDragging] = useState(false);

  // Edit / Input states
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editedDesc, setEditedDesc] = useState("");
  const [newCommentText, setNewCommentText] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [copied, setCopied] = useState(false);

  // Auth values
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchAllData = useCallback(async () => {
    if (!projectId || !issueId) return;
    try {
      setLoading(true);
      setError("");
      
      const s = await getSession();
      setSession(s);

      const [issueData, projectData, statusesData, membersData, trackersData] = await Promise.all([
        getIssueDetail(projectId, issueId),
        getProjectDetail(projectId),
        getProjectStatuses(projectId),
        getProjectMembers(projectId),
        getTrackers(),
      ]);

      setIssue(issueData);
      setEditedTitle(issueData.title);
      setEditedDesc(issueData.description || "");
      setProject(projectData);
      setStatuses(statusesData);
      setMembers(membersData);
      setTrackers(trackersData);

      if (s) {
        setIsAdmin(s.user.isAdmin);
        const userProjMembership = membersData.find(
          (m: any) => m.email === s.user.email || m.username === s.user.username
        );
        setUserRole(userProjMembership?.role || null);
      }

      // Load comments and attachments
      setAttachmentsLoading(true);
      getIssueAttachments(issueId)
        .then((data) => setAttachments(data))
        .catch((err) => console.error("Gagal mengambil lampiran:", err))
        .finally(() => setAttachmentsLoading(false));

      setCommentsLoading(true);
      getIssueComments(issueId)
        .then((data) => setComments(data))
        .catch((err) => console.error("Gagal mengambil komentar:", err))
        .finally(() => setCommentsLoading(false));

    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Gagal memuat detail tiket.");
    } finally {
      setLoading(false);
    }
  }, [projectId, issueId]);

  useEffect(() => {
    void fetchAllData();
  }, [fetchAllData]);

  // Socket.io subscription
  useEffect(() => {
    if (!session?.user?.id || !projectId) return;

    const socketUrl =
      typeof window !== "undefined" && window.location.hostname === "localhost"
        ? "http://localhost:3000"
        : "";

    const socket = io(socketUrl, {
      query: { userId: session.user.id },
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      socket.emit("joinProject", projectId);
    });

    socket.on("issue.comment_created", (payload: { issueId: string; commentId: string; authorId: string }) => {
      if (payload.issueId === issueId) {
        getIssueComments(issueId)
          .then((data) => setComments(data))
          .catch((err) => console.error("Gagal memperbarui komentar via socket:", err));
      }
    });

    socket.on("issue.updated", (payload: { id: string }) => {
      if (payload.id === issueId) {
        getIssueDetail(projectId, issueId)
          .then((data) => {
            setIssue(data);
            setEditedTitle(data.title);
            setEditedDesc(data.description || "");
          })
          .catch((err) => console.error("Gagal memperbarui tiket via socket:", err));
      }
    });

    return () => {
      socket.emit("leaveProject", projectId);
      socket.disconnect();
    };
  }, [projectId, issueId, session?.user?.id]);

  // Operations
  const handleUpdateField = async (payload: Partial<Parameters<typeof updateIssue>[2]>) => {
    if (!issue) return;
    try {
      const updated = await updateIssue(projectId, issue.id, payload);
      setIssue(updated);
      queryClient.invalidateQueries({ queryKey: ["issues", projectId] });
      queryClient.invalidateQueries({ queryKey: ["issues"] });
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Gagal memperbarui properti tiket.");
    }
  };

  const handleSaveTitle = async () => {
    if (!editedTitle.trim() || editedTitle === issue?.title) {
      setIsEditingTitle(false);
      return;
    }
    await handleUpdateField({ title: editedTitle });
    setIsEditingTitle(false);
  };

  const handleSaveDescription = async () => {
    if (editedDesc === issue?.description) {
      setIsEditingDesc(false);
      return;
    }
    await handleUpdateField({ description: editedDesc });
    setIsEditingDesc(false);
  };

  const handleStatusChange = async (newStatusId: string) => {
    if (!issue) return;
    try {
      const updated = await updateIssueStatus(issue.id, newStatusId);
      setIssue((prev) => prev ? { ...prev, statusId: newStatusId, status: updated.status } : null);
      queryClient.invalidateQueries({ queryKey: ["issues", projectId] });
      queryClient.invalidateQueries({ queryKey: ["issues"] });
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Gagal memperbarui status.");
    }
  };

  const handleUploadFiles = async (files: FileList) => {
    if (!issue) return;
    const filesArr = Array.from(files);
    if (filesArr.length === 0) return;

    setAttachmentsLoading(true);
    try {
      const uploaded: IssueAttachment[] = [];
      for (const file of filesArr) {
        const attachment = await createIssueAttachment(issue.id, file);
        uploaded.push(attachment);
      }
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Gagal mengunggah lampiran.");
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!issue) return;
    const ok = await confirm({
      title: "Hapus Lampiran",
      description: "Apakah Anda yakin ingin menghapus lampiran ini? Tindakan ini tidak dapat dibatalkan.",
      confirmLabel: "Ya, Hapus",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      await deleteIssueAttachment(issue.id, attachmentId);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Gagal menghapus lampiran.");
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issue || !newCommentText.trim()) return;

    setCommentsError("");
    try {
      const comment = await createIssueComment(issue.id, newCommentText);
      setComments((prev) => [...prev, comment]);
      setNewCommentText("");
    } catch (err: unknown) {
      setCommentsError(err instanceof Error ? err.message : "Gagal menambahkan komentar.");
    }
  };

  const handleStartEditComment = (commentId: string, currentBody: string) => {
    setEditingCommentId(commentId);
    setEditingCommentText(currentBody);
  };

  const handleSaveEditComment = async (commentId: string) => {
    if (!issue || !editingCommentText.trim()) return;

    setCommentsError("");
    try {
      const updated = await updateIssueComment(issue.id, commentId, editingCommentText);
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      setEditingCommentId(null);
      setEditingCommentText("");
    } catch (err: unknown) {
      setCommentsError(err instanceof Error ? err.message : "Gagal mengubah komentar.");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!issue) return;
    const ok = await confirm({
      title: "Hapus Komentar",
      description: "Apakah Anda yakin ingin menghapus komentar ini?",
      confirmLabel: "Hapus",
      variant: "destructive",
    });
    if (!ok) return;

    setCommentsError("");
    try {
      await deleteIssueComment(issue.id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err: unknown) {
      setCommentsError(err instanceof Error ? err.message : "Gagal menghapus komentar.");
    }
  };

  const handleDeleteIssue = async () => {
    if (!issue) return;
    const ok = await confirm({
      title: "Hapus Tiket",
      description: "Apakah Anda yakin ingin menghapus tiket ini secara permanen?",
      confirmLabel: "Hapus",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      await deleteIssue(projectId, issue.id);
      queryClient.invalidateQueries({ queryKey: ["issues", projectId] });
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      router.push(`/projects/${projectId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menghapus tiket.");
    }
  };

  const handleCopyLink = () => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span>Memuat detail tiket...</span>
        </div>
      </div>
    );
  }

  if (error && !issue) {
    return (
      <div className="p-6">
        <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive max-w-lg mx-auto">
          <AlertCircle className="h-4 w-4 mt-[1px] shrink-0" />
          <div className="flex flex-col gap-2">
            <span>{error}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push(`/projects/${projectId}`)}
              className="w-fit"
            >
              Kembali ke Proyek
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!issue) return null;

  const canEdit =
    issue.assigneeId === session?.user?.id ||
    issue.createdBy === session?.user?.id ||
    userRole === "manager" ||
    isAdmin;

  const creator = members.find((m) => m.id === issue.createdBy);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden text-[13px]">
      {/* Top Header / Breadcrumbs Bar */}
      <div className="flex items-center justify-between border-b border-border/60 px-6 py-3 shrink-0 bg-background/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="h-4 w-px bg-border/60" />
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
            <span>{project?.name || "PROJECT"}</span>
            <span className="text-border">/</span>
            <span className="text-foreground">{issue.displayId || `#${issue.id.slice(0, 6)}`}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={handleCopyLink}
            title="Salin Link Tiket"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>

          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={handleDeleteIssue}
              title="Hapus Tiket"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-background/20">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-6 max-w-[1400px] mx-auto">
          
          {/* Left / Center Column (75%) */}
          <div 
            className={`lg:col-span-3 flex flex-col gap-5 ${
              isDetailDragging ? "bg-primary/5 border border-dashed border-primary rounded-lg p-3 transition-colors" : ""
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDetailDragging(true);
            }}
            onDragLeave={() => setIsDetailDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDetailDragging(false);
              if (e.dataTransfer.files) {
                void handleUploadFiles(e.dataTransfer.files);
              }
            }}
          >
            {/* Title Section */}
            <div className="flex flex-col gap-1.5">
              {isEditingTitle && canEdit ? (
                <div className="flex items-center gap-2">
                  <Input
                    className="text-[18px] font-bold h-10 px-3 bg-card border-primary/50 text-foreground"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleSaveTitle();
                      if (e.key === "Escape") {
                        setEditedTitle(issue.title);
                        setIsEditingTitle(false);
                      }
                    }}
                    onBlur={handleSaveTitle}
                    autoFocus
                  />
                  <Button size="sm" onClick={handleSaveTitle} className="h-10 text-xs px-4">
                    Simpan
                  </Button>
                </div>
              ) : (
                <div 
                  className={`flex items-center justify-between group rounded p-1 -m-1 ${
                    canEdit ? "hover:bg-muted/40 cursor-text" : ""
                  }`}
                  onClick={() => canEdit && setIsEditingTitle(true)}
                >
                  <h1 className="text-[20px] font-bold tracking-tight text-foreground leading-normal select-text">
                    {issue.title}
                  </h1>
                  {canEdit && (
                    <Edit2 className="h-3.5 w-3.5 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0" />
                  )}
                </div>
              )}
            </div>

            {/* Description Section */}
            <div className="flex flex-col gap-2 border border-border/80 bg-muted/10 p-4 rounded-xl">
              <div className="flex items-center justify-between text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
                <span>Deskripsi / Detail Tiket</span>
                {canEdit && !isEditingDesc && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground"
                    onClick={() => setIsEditingDesc(true)}
                  >
                    Edit Deskripsi
                  </Button>
                )}
              </div>

              {isEditingDesc ? (
                <div className="flex flex-col gap-2 mt-1">
                  <textarea
                    value={editedDesc}
                    onChange={(e) => setEditedDesc(e.target.value)}
                    className="w-full min-h-[140px] rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary text-foreground"
                    placeholder="Masukkan deskripsi rinci untuk tiket ini..."
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs px-3"
                      onClick={() => {
                        setEditedDesc(issue.description || "");
                        setIsEditingDesc(false);
                      }}
                    >
                      Batal
                    </Button>
                    <Button size="sm" className="h-8 text-xs px-3" onClick={handleSaveDescription}>
                      Simpan
                    </Button>
                  </div>
                </div>
              ) : (
                <div 
                  className={`text-[13px] leading-relaxed text-foreground whitespace-pre-wrap select-text mt-1.5 ${
                    canEdit ? "hover:bg-muted/20 cursor-text rounded p-1 -m-1" : ""
                  }`}
                  onClick={() => canEdit && setIsEditingDesc(true)}
                >
                  {issue.description || (
                    <span className="italic text-muted-foreground/70">
                      Tidak ada deskripsi rinci untuk tiket ini. Klik di sini untuk menambahkan.
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Attachments Section */}
            <div className="flex flex-col gap-2 border-t border-border/60 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" />
                  Lampiran ({attachments.length})
                </span>
                <div className="flex items-center">
                  <input
                    type="file"
                    multiple
                    id="page-files-input"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) {
                        void handleUploadFiles(e.target.files);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] font-medium px-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => document.getElementById("page-files-input")?.click()}
                  >
                    Tambah File
                  </Button>
                </div>
              </div>

              {attachmentsLoading ? (
                <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground justify-center">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Memuat lampiran...
                </div>
              ) : attachments.length === 0 ? (
                <div className="text-[12px] text-muted-foreground/80 italic py-6 text-center border border-dashed border-border/80 rounded-lg bg-muted/5 hover:bg-muted/10 transition-colors">
                  Seret file atau klik tambah file untuk mengunggah bukti/lampiran.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-1.5">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between border border-border/80 bg-card hover:bg-muted/30 px-3 py-2 rounded-lg text-xs group gap-2 shadow-sm transition-colors"
                    >
                      <a
                        href={`/uploads/${att.r2ObjectKey}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={att.fileName}
                        className="font-medium text-foreground hover:underline truncate flex-1 flex items-center gap-2 min-w-0"
                      >
                        {getFileIcon(att.fileName)}
                        <span className="truncate">{att.fileName}</span>
                      </a>
                      <span className="text-[10px] text-muted-foreground shrink-0 group-hover:hidden transition-all">
                        {att.uploadedAt ? new Date(att.uploadedAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short"
                        }) : ""}
                      </span>
                      {(att.uploadedBy === session?.user?.id || isAdmin) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="text-muted-foreground hover:text-destructive shrink-0 ml-2 hidden group-hover:block transition-all"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Huly Activity Thread Panel */}
            <div className="flex flex-col gap-4 border-t border-border/60 pt-5 mt-3">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span>Activity / Komentar Forum</span>
              </div>

              {/* Comments display thread */}
              <div className="flex flex-col gap-4">
                {commentsError && (
                  <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive leading-normal">
                    <AlertCircle className="h-4 w-4 mt-[1px] shrink-0" />
                    <span>{commentsError}</span>
                  </div>
                )}

                {commentsLoading ? (
                  <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span>Memuat aktivitas komentar...</span>
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground italic border border-dashed border-border/80 rounded-lg bg-muted/5">
                    Belum ada diskusi untuk tiket ini. Gunakan kolom di bawah untuk memulai tanggapan.
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 bg-muted/5 border border-border/50 p-4 rounded-xl">
                    {comments.map((comment) => (
                      <div 
                        key={comment.id} 
                        className="flex gap-3 items-start text-xs border-b border-border/50 pb-3 last:border-b-0 last:pb-0 group"
                      >
                        <Avatar className="h-7 w-7 mt-0.5 border border-border shadow-sm">
                          <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                            {comment.author.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 flex flex-col gap-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground truncate text-[13px]">{comment.author.name}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1.5">
                              {new Date(comment.createdAt).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                              {comment.updatedAt && (
                                <span className="text-[9px] italic text-muted-foreground/60">(edited)</span>
                              )}
                            </span>
                          </div>

                          {editingCommentId === comment.id ? (
                            <div className="flex flex-col gap-2 mt-1.5 bg-card border border-border/80 p-2.5 rounded-lg">
                              <textarea
                                value={editingCommentText}
                                onChange={(e) => setEditingCommentText(e.target.value)}
                                className="w-full min-h-[60px] rounded border border-input bg-transparent px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
                              />
                              <div className="flex gap-2 justify-end">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[11px] px-2.5"
                                  onClick={() => setEditingCommentId(null)}
                                >
                                  Batal
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-7 text-[11px] px-2.5"
                                  onClick={() => handleSaveEditComment(comment.id)}
                                  disabled={!editingCommentText.trim()}
                                >
                                  Simpan
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap select-text pr-4 mt-0.5">
                              {comment.body}
                            </div>
                          )}

                          {/* Quick Edit/Delete links on Hover */}
                          {editingCommentId !== comment.id && (
                            <div className="flex gap-3.5 mt-1 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                              {comment.author.id === session?.user?.id && (
                                <button
                                  type="button"
                                  onClick={() => handleStartEditComment(comment.id, comment.body)}
                                  className="hover:text-foreground hover:underline flex items-center gap-0.5 transition-colors cursor-pointer"
                                >
                                  <Edit2 className="h-2.5 w-2.5" /> Edit
                                </button>
                              )}
                              {(comment.author.id === session?.user?.id || isAdmin) && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteComment(comment.id)}
                                  className="hover:text-destructive hover:underline flex items-center gap-0.5 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="h-2.5 w-2.5" /> Hapus
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Huly style comment composer */}
              <form onSubmit={handleAddComment} className="border border-border/80 bg-card/60 p-3 rounded-xl flex flex-col gap-2.5 shadow-sm mt-1 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                <textarea
                  placeholder="Tulis tanggapan atau aktivitas..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  className="w-full min-h-[50px] max-h-[140px] bg-transparent border-0 px-2 py-1 text-[13px] focus-visible:outline-none placeholder-muted-foreground/60 text-foreground resize-y"
                  required
                />
                <div className="flex items-center justify-between border-t border-border/40 pt-2 px-1">
                  {/* Toolbar controls */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                      onClick={() => document.getElementById("page-files-input")?.click()}
                      title="Unggah Lampiran"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                      title="Mention Member"
                    >
                      <AtSign className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                      title="Emoji"
                    >
                      <Smile className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                      title="Sertakan Video"
                    >
                      <Video className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Submit button */}
                  <Button
                    type="submit"
                    size="sm"
                    className="h-7 text-xs px-3 font-semibold rounded-md flex items-center gap-1.5"
                    disabled={!newCommentText.trim()}
                  >
                    <span>Kirim</span>
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Sidebar properties column (25%) */}
          <div className="lg:col-span-1 border-t lg:border-t-0 lg:border-l border-border/60 pt-6 lg:pt-0 lg:pl-6 flex flex-col gap-6 bg-background/30 rounded-xl lg:bg-transparent lg:p-0">
            <div className="flex flex-col gap-4">
              
              {/* Status */}
              <div className="flex items-center justify-between min-h-[30px]">
                <Label className="text-[12px] font-semibold text-muted-foreground uppercase">Status</Label>
                <select
                  value={issue.statusId}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="h-8 rounded-md border border-border/80 bg-card px-2.5 text-[12px] font-semibold text-foreground outline-none focus:border-primary/50 transition-colors w-44 shadow-sm cursor-pointer"
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

              {/* Priority */}
              <div className="flex items-center justify-between min-h-[30px]">
                <Label className="text-[12px] font-semibold text-muted-foreground uppercase">Priority</Label>
                <select
                  value={issue.priority}
                  onChange={(e) => handleUpdateField({ priority: e.target.value as any })}
                  className="h-8 rounded-md border border-border/80 bg-card px-2.5 text-[12px] font-semibold text-foreground outline-none focus:border-primary/50 transition-colors w-44 capitalize shadow-sm cursor-pointer"
                >
                  <option value="low">Low 🟢</option>
                  <option value="medium">Medium 🟡</option>
                  <option value="high">High 🔴</option>
                  <option value="urgent">Urgent ⚡</option>
                </select>
              </div>

              {/* Tracker / Type */}
              <div className="flex items-center justify-between min-h-[30px]">
                <Label className="text-[12px] font-semibold text-muted-foreground uppercase">Task Type</Label>
                <select
                  value={issue.trackerId}
                  onChange={(e) => handleUpdateField({ trackerId: e.target.value })}
                  className="h-8 rounded-md border border-border/80 bg-card px-2.5 text-[12px] font-semibold text-foreground outline-none focus:border-primary/50 transition-colors w-44 shadow-sm cursor-pointer"
                >
                  {trackers.map((tr) => (
                    <option key={tr.id} value={tr.id}>
                      {tr.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Created By */}
              <div className="flex items-center justify-between min-h-[30px]">
                <Label className="text-[12px] font-semibold text-muted-foreground uppercase">Created By</Label>
                <div className="flex items-center gap-2 h-8 w-44 pl-1">
                  <Avatar className="h-5 w-5 border border-border shadow-sm">
                    <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                      {creator ? creator.name.slice(0, 2).toUpperCase() : "-"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[12px] truncate text-foreground font-medium">
                    {creator?.name || "System"}
                  </span>
                </div>
              </div>

              {/* Assignee */}
              <div className="flex items-center justify-between min-h-[30px]">
                <Label className="text-[12px] font-semibold text-muted-foreground uppercase">Assignee</Label>
                <select
                  value={issue.assigneeId || ""}
                  onChange={(e) => handleUpdateField({ assigneeId: e.target.value || null })}
                  className="h-8 rounded-md border border-border/80 bg-card px-2.5 text-[12px] font-semibold text-foreground outline-none focus:border-primary/50 transition-colors w-44 shadow-sm cursor-pointer"
                >
                  <option value="">Belum Ditugaskan</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Due Date */}
              <div className="flex items-center justify-between min-h-[30px]">
                <Label className="text-[12px] font-semibold text-muted-foreground uppercase">Due Date</Label>
                <Input
                  type="date"
                  value={issue.dueDate ? issue.dueDate.split("T")[0] : ""}
                  onChange={(e) => handleUpdateField({ dueDate: e.target.value || null })}
                  className="h-8 text-[12px] font-semibold w-44 px-2.5 bg-card border-border/80 shadow-sm"
                />
              </div>

              <div className="h-px bg-border/60 my-2" />

              {/* Collaborators / Team */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Collaborators</span>
                <div className="flex items-center gap-1.5 py-1">
                  <div className="flex -space-x-2 overflow-hidden">
                    {members.slice(0, 4).map((member) => (
                      <Avatar key={member.id} className="h-6 w-6 border-2 border-background ring-1 ring-border shadow-sm">
                        <AvatarFallback className="text-[9px] font-bold bg-muted text-muted-foreground">
                          {member.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  {members.length > 0 && (
                    <span className="text-[11px] text-muted-foreground font-medium ml-1">
                      {members.length} members
                    </span>
                  )}
                </div>
              </div>

              <div className="h-px bg-border/60 my-2" />

              {/* Timeline Info */}
              <div className="flex flex-col gap-1.5 text-[11px] text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Created:</span>
                  <span className="font-semibold text-foreground/80">
                    {new Date(issue.createdAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric"
                    })}
                  </span>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
