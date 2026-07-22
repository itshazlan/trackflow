"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
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
  uploadCommentImage,
  uploadCommentAttachment,
  getCommentAttachmentDownloadUrl,
  updateIssueComment,
  deleteIssueComment,
  updateIssueStatus,
  Issue,
  IssueStatus,
  Tracker,
  ProjectMember,
  IssueAttachment,
  IssueComment,
  CommentAttachment,
} from "@/lib/issues-service";
import { getProjectDetail, Project } from "@/lib/projects-service";
import { getSession, UserSession } from "@/lib/auth-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  AlertCircle,
  Trash2,
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
  Reply,
  Link as LinkIcon,
  Download,
} from "lucide-react";

const EmojiPicker = dynamic(
  () => import("emoji-picker-react").then((mod) => mod.default),
  { ssr: false }
);

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

const formatCommentDate = (dateString: string) => {
  const d = new Date(dateString);
  const date = d.getDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
  const monthStr = months[d.getMonth()];
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${date} ${monthStr}, ${hours}:${minutes}`;
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
  const [pendingCommentImages, setPendingCommentImages] = useState<File[]>([]);
  const [replyParentComment, setReplyParentComment] = useState<IssueComment | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const commentImageInputRef = useRef<HTMLInputElement | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [copiedState, setCopiedState] = useState<"link" | "name" | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<IssueAttachment | null>(null);

  const [mentionActive, setMentionActive] = useState<boolean>(false);
  const [mentionSearch, setMentionSearch] = useState<string>("");
  const [mentionIndex, setMentionIndex] = useState<number>(0);
  const [mentionTarget, setMentionTarget] = useState<"description" | "comment" | { type: "comment-edit"; id: string } | null>(null);
  const [mentionTextareaRef, setMentionTextareaRef] = useState<HTMLTextAreaElement | null>(null);

  const [emojiActiveTarget, setEmojiActiveTarget] = useState<"description" | "comment" | { type: "comment-edit"; id: string } | null>(null);
  const [emojiTextareaRef, setEmojiTextareaRef] = useState<HTMLTextAreaElement | null>(null);

  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(mentionSearch.toLowerCase()) ||
      m.username.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  const insertMention = (member: ProjectMember) => {
    if (!mentionTextareaRef) return;
    const value = mentionTextareaRef.value;
    const cursor = mentionTextareaRef.selectionStart;
    const textBefore = value.slice(0, cursor);
    const lastAt = textBefore.lastIndexOf("@");
    if (lastAt === -1) return;

    const before = value.slice(0, lastAt);
    const after = value.slice(cursor);
    const insertText = `@${member.username} `;
    const newValue = before + insertText + after;

    const targetType = typeof mentionTarget === "object" ? mentionTarget?.type : mentionTarget;
    if (targetType === "description") {
      setEditedDesc(newValue);
    } else if (targetType === "comment") {
      setNewCommentText(newValue);
    } else if (typeof mentionTarget === "object" && mentionTarget?.type === "comment-edit") {
      setEditingCommentText(newValue);
    }

    setMentionActive(false);
    setMentionTarget(null);

    setTimeout(() => {
      mentionTextareaRef.focus();
      const newCursorPos = lastAt + insertText.length;
      mentionTextareaRef.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  const insertEmoji = (emoji: string) => {
    const targetRef = emojiTextareaRef || mentionTextareaRef;
    if (!targetRef) return;
    const value = targetRef.value;
    const cursor = targetRef.selectionStart;
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);
    const newValue = before + emoji + after;

    const targetType = typeof emojiActiveTarget === "object" ? emojiActiveTarget?.type : emojiActiveTarget;
    if (targetType === "description") {
      setEditedDesc(newValue);
    } else if (targetType === "comment") {
      setNewCommentText(newValue);
    } else if (typeof emojiActiveTarget === "object" && emojiActiveTarget?.type === "comment-edit") {
      setEditingCommentText(newValue);
    }

    setEmojiActiveTarget(null);

    setTimeout(() => {
      targetRef.focus();
      const newCursorPos = cursor + emoji.length;
      targetRef.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  const handleTextareaChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
    target: typeof mentionTarget
  ) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart;
    const textBefore = value.slice(0, cursor);
    const lastAt = textBefore.lastIndexOf("@");

    const targetType = typeof target === "object" ? target?.type : target;
    if (targetType === "description") {
      setEditedDesc(value);
    } else if (targetType === "comment") {
      setNewCommentText(value);
    } else if (typeof target === "object" && target?.type === "comment-edit") {
      setEditingCommentText(value);
    }

    if (lastAt !== -1 && lastAt < cursor) {
      const query = textBefore.slice(lastAt + 1);
      if (!query.includes(" ")) {
        setMentionActive(true);
        setMentionSearch(query);
        setMentionTarget(target);
        setMentionTextareaRef(e.target);
        setMentionIndex(0);
        return;
      }
    }
    setMentionActive(false);
  };

  const handleTextareaKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    target: typeof mentionTarget
  ) => {
    if (!mentionActive) return;

    const isTargetMatch =
      typeof target === "object" && typeof mentionTarget === "object"
        ? target?.type === mentionTarget?.type && target?.id === mentionTarget?.id
        : target === mentionTarget;

    if (!isTargetMatch) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionIndex((prev) => (prev + 1) % Math.max(1, filteredMembers.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionIndex((prev) => (prev - 1 + filteredMembers.length) % Math.max(1, filteredMembers.length));
    } else if (e.key === "Enter") {
      if (filteredMembers.length > 0) {
        e.preventDefault();
        insertMention(filteredMembers[mentionIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMentionActive(false);
    }
  };

  const renderFormattedText = (text: string | null) => {
    if (!text) return null;

    const codeBlockRegex = /```(?:[a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    const parseInline = (segment: string, baseKey: string) => {
      const inlineCodeRegex = /`([^`]+)`/g;
      const inlineParts = [];
      let inlineLastIndex = 0;
      let inlineMatch;
      let keyCounter = 0;

      while ((inlineMatch = inlineCodeRegex.exec(segment)) !== null) {
        const textBefore = segment.slice(inlineLastIndex, inlineMatch.index);
        if (textBefore) {
          inlineParts.push(...parseLinksAndMentions(textBefore, `${baseKey}-before-${keyCounter}`));
        }
        const codeText = inlineMatch[1];
        inlineParts.push(
          <code key={`${baseKey}-code-${keyCounter}`} className="bg-muted px-1.5 py-0.5 rounded font-mono text-[12px] border border-border/40 text-foreground font-semibold">
            {codeText}
          </code>
        );
        inlineLastIndex = inlineCodeRegex.lastIndex;
        keyCounter++;
      }

      const remainingText = segment.slice(inlineLastIndex);
      if (remainingText) {
        inlineParts.push(...parseLinksAndMentions(remainingText, `${baseKey}-remain`));
      }

      return inlineParts;
    };

    const parseLinksAndMentions = (text: string, baseKey: string) => {
      const parts = text.split(/(\s+)/);
      return parts.map((part, idx) => {
        const partKey = `${baseKey}-part-${idx}`;

        if (/^https?:\/\/[^\s]+$/i.test(part)) {
          let url = part;
          let suffix = "";
          const trailingPunctuation = /[.,:;!?)]+$/;
          const matchPunct = part.match(trailingPunctuation);
          if (matchPunct) {
            url = part.slice(0, matchPunct.index);
            suffix = matchPunct[0];
          }
          return (
            <React.Fragment key={partKey}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium break-all select-all inline-flex items-center gap-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                {url}
              </a>
              {suffix}
            </React.Fragment>
          );
        }

        if (part.startsWith("@")) {
          const nameToFind = part.slice(1);
          const match = members.find(
            (m) =>
              m.name.toLowerCase() === nameToFind.toLowerCase() ||
              m.username.toLowerCase() === nameToFind.toLowerCase() ||
              m.name.toLowerCase().replace(/\s+/g, "") === nameToFind.toLowerCase()
          );
          if (match) {
            return (
              <span
                key={partKey}
                className="inline-flex items-center font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-1 py-0.5 rounded transition-colors select-all cursor-pointer mr-0.5"
                title={`${match.name} (${match.email})`}
              >
                @{match.name}
              </span>
            );
          }
        }

        return part;
      });
    };

    let blockKeyCounter = 0;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      const textBefore = text.slice(lastIndex, match.index);
      if (textBefore) {
        elements.push(...parseInline(textBefore, `block-text-${blockKeyCounter}`));
      }

      const codeContent = match[1];
      elements.push(
        <pre key={`block-code-${blockKeyCounter}`} className="bg-muted/80 p-3 rounded-lg font-mono text-[11.5px] overflow-x-auto my-2 border border-border/50 text-foreground whitespace-pre leading-relaxed select-text">
          {codeContent}
        </pre>
      );

      lastIndex = codeBlockRegex.lastIndex;
      blockKeyCounter++;
    }

    const remainingText = text.slice(lastIndex);
    if (remainingText) {
      elements.push(...parseInline(remainingText, `block-remain`));
    }

    return elements;
  };

  const isImageFile = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(ext || "");
  };

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

  const handleCommentImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setPendingCommentImages((prev) => [...prev, ...filesArray]);
      if (e.target) e.target.value = "";
    }
  };

  const handleRemovePendingCommentImage = (index: number) => {
    setPendingCommentImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issue || (!newCommentText.trim() && pendingCommentImages.length === 0)) return;

    setCommentsError("");
    setIsSubmittingComment(true);
    try {
      const newComment = await createIssueComment(
        issue.id,
        newCommentText.trim(),
        replyParentComment?.id,
      );

      if (pendingCommentImages.length > 0) {
        const uploadedAttachments: CommentAttachment[] = [];
        for (const fileItem of pendingCommentImages) {
          try {
            const att = await uploadCommentAttachment(issue.id, newComment.id, fileItem);
            uploadedAttachments.push(att);
          } catch (err) {
            console.error("Gagal mengunggah lampiran komentar:", err);
          }
        }
        newComment.commentAttachments = uploadedAttachments;
      }

      const updatedComments = await getIssueComments(issue.id);
      setComments(updatedComments);

      setNewCommentText("");
      setPendingCommentImages([]);
      setReplyParentComment(null);
    } catch (err: unknown) {
      setCommentsError(err instanceof Error ? err.message : "Gagal menambahkan komentar.");
    } finally {
      setIsSubmittingComment(false);
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
    setCopiedState("link");
    setTimeout(() => setCopiedState(null), 2000);
  };

  const handleCopyName = () => {
    if (!issue) return;
    const issueKey = issue.displayId || `#${issue.id.slice(0, 6)}`;
    const textToCopy = `${issueKey} - ${issue.title}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedState("name");
    setTimeout(() => setCopiedState(null), 2000);
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
          <AlertCircle className="h-4 w-4 mt-px shrink-0" />
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

  const propertiesContent = (
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
            {creator?.image ? (
              <img src={creator.image} alt={creator.name} className="h-full w-full object-cover rounded-full" />
            ) : (
              <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                {creator ? creator.name.slice(0, 2).toUpperCase() : "-"}
              </AvatarFallback>
            )}
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
                {member.image ? (
                  <img src={member.image} alt={member.name} className="h-full w-full object-cover rounded-full" />
                ) : (
                  <AvatarFallback className="text-[9px] font-bold bg-muted text-muted-foreground">
                    {member.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                )}
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
  );

  const renderCommentAttachments = (commentId: string, attachments?: CommentAttachment[], authorName?: string) => {
    if (!attachments || attachments.length === 0) return null;

    const imageAtts = attachments.filter(
      (att) => att.mimeType?.toLowerCase().startsWith("image/") || isImageFile(att.fileName)
    );
    const fileAtts = attachments.filter(
      (att) => !att.mimeType?.toLowerCase().startsWith("image/") && !isImageFile(att.fileName)
    );

    const handleDownloadFile = async (att: CommentAttachment) => {
      let downloadUrl = `/api/uploads/${att.r2ObjectKey}`;
      try {
        const res = await getCommentAttachmentDownloadUrl(issue!.id, commentId, att.id);
        if (res.downloadUrl) {
          downloadUrl = res.downloadUrl;
        }
      } catch (err) {
        console.warn("Failed to get presigned download url, fallback to uploads path:", err);
      }

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = att.fileName;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    return (
      <div className="flex flex-col gap-2 mt-2">
        {/* Image Thumbnail Grid */}
        {imageAtts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {imageAtts.map((img) => (
              <div
                key={img.id}
                className="relative group rounded-lg overflow-hidden border border-border/80 bg-card cursor-pointer hover:border-primary/50 transition-all shadow-xs"
                onClick={() =>
                  setPreviewAttachment({
                    id: img.id,
                    issueId: issue!.id,
                    fileName: img.fileName,
                    r2ObjectKey: img.r2ObjectKey,
                    uploadedBy: authorName || "User",
                    uploadedAt: img.uploadedAt,
                  })
                }
              >
                <img
                  src={
                    img.r2ObjectKey.startsWith("http") || img.r2ObjectKey.startsWith("/api/")
                      ? img.r2ObjectKey
                      : `/api/uploads/${img.r2ObjectKey}`
                  }
                  alt={img.fileName}
                  className="h-20 w-24 object-cover group-hover:scale-105 transition-transform"
                />
              </div>
            ))}
          </div>
        )}

        {/* Non-image File Attachments */}
        {fileAtts.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {fileAtts.map((att) => (
              <div
                key={att.id}
                className="flex items-center justify-between gap-3 border border-border/70 bg-card hover:bg-muted/40 px-3 py-2 rounded-lg text-xs transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded shrink-0 border border-border/60 bg-muted flex items-center justify-center">
                    {getFileIcon(att.fileName)}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-[320px]">
                      {att.fileName}
                    </span>
                    {att.fileSizeBytes && (
                      <span className="text-[10px] text-muted-foreground">
                        {(Number(att.fileSizeBytes) / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDownloadFile(att)}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline shrink-0 px-2.5 py-1 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer"
                  title="Unduh File"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Unduh</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

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
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Salin Issue"
                >
                  {copiedState ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={handleCopyLink}
                className="cursor-pointer text-[12.5px] flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-3.5 w-3.5" />
                  <span>Salin Link Issue</span>
                </div>
                {copiedState === "link" && <Check className="h-3.5 w-3.5 text-green-500" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleCopyName}
                className="cursor-pointer text-[12.5px] flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5" />
                  <span>Salin Nama Issue</span>
                </div>
                {copiedState === "name" && <Check className="h-3.5 w-3.5 text-green-500" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
            className={`lg:col-span-3 flex flex-col gap-5 pb-24 ${isDetailDragging ? "bg-primary/5 border border-dashed border-primary rounded-lg p-3 transition-colors" : ""
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
                  className={`flex items-center justify-between group rounded p-1 -m-1 ${canEdit ? "hover:bg-muted/40 cursor-text" : ""
                    }`}
                  onDoubleClick={() => canEdit && setIsEditingTitle(true)}
                  title={canEdit ? "Klik dua kali untuk mengedit" : undefined}
                >
                  <h1 className="text-[20px] font-bold tracking-tight text-foreground leading-normal select-text">
                    {issue.title}
                  </h1>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditingTitle(true);
                      }}
                      className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted-foreground/15 text-muted-foreground/60 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all ml-2 shrink-0 cursor-pointer"
                      title="Edit Judul"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
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
                  <div className="relative">
                    <textarea
                      value={editedDesc}
                      onChange={(e) => handleTextareaChange(e, "description")}
                      onKeyDown={(e) => handleTextareaKeyDown(e, "description")}
                      className="w-full min-h-[280px] rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary text-foreground"
                      placeholder="Masukkan deskripsi rinci untuk tiket ini... Gunakan @ untuk mention member."
                    />

                    {/* Autocomplete Mention Popover */}
                    {mentionActive && mentionTarget === "description" && filteredMembers.length > 0 && (
                      <div className="absolute left-0 bottom-full mb-1 z-50 w-56 rounded-lg border border-border bg-popover p-1 shadow-lg text-xs flex flex-col gap-0.5">
                        {filteredMembers.map((m, idx) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => insertMention(m)}
                            className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded cursor-pointer ${idx === mentionIndex ? "bg-accent text-accent-foreground font-semibold" : "hover:bg-muted/60"
                              }`}
                          >
                            <Avatar className="h-4 w-4 shrink-0">
                              {m.image ? (
                                <img src={m.image} alt={m.name} className="h-full w-full object-cover rounded-full" />
                              ) : (
                                <AvatarFallback className="text-[7px] font-bold">
                                  {m.name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <span className="truncate">{m.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 justify-between items-center mt-1">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                        onClick={() => document.getElementById("page-files-input")?.click()}
                        title="Unggah Lampiran"
                      >
                        <Paperclip className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                        onClick={(e) => {
                          const parent = e.currentTarget.closest(".flex-col");
                          const textarea = parent?.querySelector("textarea") as HTMLTextAreaElement;
                          if (textarea) {
                            const value = textarea.value;
                            const cursor = textarea.selectionStart;
                            const before = value.slice(0, cursor);
                            const after = value.slice(cursor);
                            const newValue = before + "@" + after;
                            setEditedDesc(newValue);
                            textarea.focus();
                            setTimeout(() => {
                              const newCursorPos = cursor + 1;
                              textarea.setSelectionRange(newCursorPos, newCursorPos);
                              const changeEvent = new Event('input', { bubbles: true }) as any;
                              Object.defineProperty(changeEvent, 'target', { writable: false, value: textarea });
                              handleTextareaChange(changeEvent as any, "description");
                            }, 10);
                          }
                        }}
                        title="Mention Member"
                      >
                        <AtSign className="h-5 w-5" />
                      </button>

                      <div className="relative flex items-center">
                        <button
                          type="button"
                          className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                          onClick={(e) => {
                            setEmojiActiveTarget(emojiActiveTarget === "description" ? null : "description");
                            const parent = e.currentTarget.closest(".flex-col");
                            const textarea = parent?.querySelector("textarea") as HTMLTextAreaElement;
                            if (textarea) setEmojiTextareaRef(textarea);
                          }}
                          title="Emoji"
                        >
                          <Smile className="h-5 w-5" />
                        </button>

                        {/* Emoji Picker Dropdown */}
                        {emojiActiveTarget === "description" && (
                          <>
                            <div
                              className="fixed inset-0 z-40 bg-transparent cursor-default"
                              onClick={() => setEmojiActiveTarget(null)}
                            />
                            <div className="absolute left-0 top-full mt-1.5 z-50 bg-popover border border-border rounded-lg shadow-lg">
                              <EmojiPicker
                                onEmojiClick={(emojiData: any) => insertEmoji(emojiData.emoji)}
                                autoFocusSearch={false}
                                theme={"dark" as any}
                                height={400}
                                width={330}
                                style={{
                                  "--epr-emoji-size": "22px",
                                  "--epr-category-navigation-button-size": "22px",
                                  "--epr-category-title-font-size": "12px",
                                  "--epr-emoji-padding": "6px",
                                  "--epr-horizontal-padding": "14px",
                                  "--epr-header-padding": "8px 14px",
                                } as React.CSSProperties}
                                previewConfig={{ showPreview: true }}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs px-3"
                        onClick={() => {
                          setEditedDesc(issue.description || "");
                          setIsEditingDesc(false);
                          setEmojiActiveTarget(null);
                        }}
                      >
                        Batal
                      </Button>
                      <Button size="sm" className="h-8 text-xs px-3" onClick={handleSaveDescription}>
                        Simpan
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={`text-[13px] leading-relaxed text-foreground whitespace-pre-wrap select-text mt-1.5 ${canEdit ? "hover:bg-muted/20 cursor-text rounded p-1 -m-1" : ""
                    }`}
                  onClick={() => {
                    if (canEdit && !issue.description) {
                      setIsEditingDesc(true);
                    }
                  }}
                  onDoubleClick={() => {
                    if (canEdit && issue.description) {
                      setIsEditingDesc(true);
                    }
                  }}
                  title={canEdit && issue.description ? "Klik dua kali untuk mengedit" : undefined}
                >
                  {issue.description ? (
                    renderFormattedText(issue.description)
                  ) : (
                    <span className="italic text-muted-foreground/70">
                      Tidak ada deskripsi rinci untuk tiket ini. Klik di sini untuk menambahkan.
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Properties Panel (visible only on < lg) */}
            <div className="lg:hidden border border-border bg-card/40 p-4.5 rounded-xl shadow-xs flex flex-col gap-4">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Tiket Properties
              </span>
              {propertiesContent}
            </div>

            {/* Attachments Section */}
            <div className="flex flex-col gap-2 border-t border-border/60 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" />
                  Lampiran ({attachments.length})
                </span>
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
                      className="flex items-center gap-3 border border-border/80 bg-card hover:bg-muted/30 p-2 rounded-lg text-xs group relative shadow-sm transition-colors cursor-pointer"
                      onClick={() => setPreviewAttachment(att)}
                    >
                      <div className="w-12 h-12 rounded overflow-hidden shrink-0 border border-border/60 bg-muted flex items-center justify-center select-none">
                        {isImageFile(att.fileName) ? (
                          <img
                            src={`/api/uploads/${att.r2ObjectKey}`}
                            alt={att.fileName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          getFileIcon(att.fileName)
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="font-semibold text-foreground truncate pr-4">{att.fileName}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {att.uploadedAt ? new Date(att.uploadedAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short"
                          }) : ""}
                        </span>
                      </div>
                      {(att.uploadedBy === session?.user?.id || isAdmin) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteAttachment(att.id);
                          }}
                          className="text-muted-foreground hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 absolute right-2 top-2"
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
                <span>Activity</span>
              </div>

              {/* Huly style comment composer */}
              <form onSubmit={handleAddComment} className="border border-border/80 bg-card/60 p-3 rounded-xl flex flex-col gap-2.5 shadow-sm mt-1 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all relative">
                {/* Reply Context Indicator */}
                {replyParentComment && (
                  <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5 text-xs text-primary font-medium">
                    <div className="flex items-center gap-1.5 truncate">
                      <Reply className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        Membalas komentar <strong className="font-semibold">{replyParentComment.author.name}</strong>: &quot;{replyParentComment.body.slice(0, 40)}{replyParentComment.body.length > 40 ? "..." : ""}&quot;
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyParentComment(null)}
                      className="p-1 hover:bg-primary/20 rounded-full cursor-pointer transition-colors"
                      title="Batal Balas"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                <textarea
                  placeholder={
                    replyParentComment
                      ? `Tulis balasan untuk ${replyParentComment.author.name}...`
                      : "Start typing..."
                  }
                  value={newCommentText}
                  onChange={(e) => handleTextareaChange(e, "comment")}
                  onKeyDown={(e) => handleTextareaKeyDown(e, "comment")}
                  className="w-full min-h-[50px] max-h-[140px] bg-transparent border-0 px-2 py-1 text-[13px] focus-visible:outline-none placeholder-muted-foreground/60 text-foreground resize-y"
                />

                {/* Hidden input for comment attachments */}
                <input
                  ref={commentImageInputRef}
                  type="file"
                  accept="*"
                  multiple
                  className="hidden"
                  onChange={handleCommentImageSelect}
                />

                {/* Pending comment attachment previews */}
                {pendingCommentImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-border/40">
                    {pendingCommentImages.map((file, idx) => {
                      const isImg = file.type.startsWith("image/") || isImageFile(file.name);
                      const previewUrl = isImg ? URL.createObjectURL(file) : null;
                      return isImg ? (
                        <div key={idx} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-border/80 bg-muted/40 shadow-xs">
                          <img src={previewUrl!} alt={file.name} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemovePendingCommentImage(idx)}
                            className="absolute top-0.5 right-0.5 bg-background/90 hover:bg-destructive hover:text-destructive-foreground text-foreground p-0.5 rounded-full transition-colors cursor-pointer shadow-xs"
                            title="Hapus file"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div key={idx} className="relative group flex items-center gap-2 border border-border/80 bg-card px-2.5 py-1.5 rounded-lg text-xs max-w-[220px]">
                          <div className="w-6 h-6 rounded border border-border/60 bg-muted flex items-center justify-center shrink-0">
                            {getFileIcon(file.name)}
                          </div>
                          <span className="truncate text-foreground text-[11px] font-medium">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemovePendingCommentImage(idx)}
                            className="text-muted-foreground hover:text-destructive p-0.5 rounded transition-colors cursor-pointer shrink-0"
                            title="Hapus file"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Autocomplete Mention Popover for Comment Composer */}
                {mentionActive && mentionTarget === "comment" && filteredMembers.length > 0 && (
                  <div className="absolute left-4 bottom-[52px] z-50 w-56 rounded-lg border border-border bg-popover p-1 shadow-lg text-xs flex flex-col gap-0.5">
                    {filteredMembers.map((m, idx) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => insertMention(m)}
                        className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded cursor-pointer ${idx === mentionIndex ? "bg-accent text-accent-foreground font-semibold" : "hover:bg-muted/60"
                          }`}
                      >
                        <Avatar className="h-4 w-4 shrink-0">
                          {m.image ? (
                            <img src={m.image} alt={m.name} className="h-full w-full object-cover rounded-full" />
                          ) : (
                            <AvatarFallback className="text-[7px] font-bold">
                              {m.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <span className="truncate">{m.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-border/40 pt-2 px-1">
                  {/* Toolbar controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                      onClick={() => commentImageInputRef.current?.click()}
                      title="Lampirkan Gambar"
                    >
                      <FileImage className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                      onClick={() => commentImageInputRef.current?.click()}
                      title="Unggah Lampiran File"
                    >
                      <Paperclip className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                      onClick={(e) => {
                        const parent = e.currentTarget.closest("form");
                        const textarea = parent?.querySelector("textarea") as HTMLTextAreaElement;
                        if (textarea) {
                          const value = textarea.value;
                          const cursor = textarea.selectionStart;
                          const before = value.slice(0, cursor);
                          const after = value.slice(cursor);
                          const newValue = before + "@" + after;
                          setNewCommentText(newValue);
                          textarea.focus();
                          setTimeout(() => {
                            const newCursorPos = cursor + 1;
                            textarea.setSelectionRange(newCursorPos, newCursorPos);
                            const changeEvent = new Event('input', { bubbles: true }) as any;
                            Object.defineProperty(changeEvent, 'target', { writable: false, value: textarea });
                            handleTextareaChange(changeEvent as any, "comment");
                          }, 10);
                        }
                      }}
                      title="Mention Member"
                    >
                      <AtSign className="h-5 w-5" />
                    </button>

                    <div className="relative flex items-center">
                      <button
                        type="button"
                        className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                        onClick={(e) => {
                          setEmojiActiveTarget(emojiActiveTarget === "comment" ? null : "comment");
                          const parent = e.currentTarget.closest("form");
                          const textarea = parent?.querySelector("textarea") as HTMLTextAreaElement;
                          if (textarea) setEmojiTextareaRef(textarea);
                        }}
                        title="Emoji"
                      >
                        <Smile className="h-5 w-5" />
                      </button>

                      {/* Emoji Picker Dropdown */}
                      {emojiActiveTarget === "comment" && (
                        <>
                          <div
                            className="fixed inset-0 z-40 bg-transparent cursor-default"
                            onClick={() => setEmojiActiveTarget(null)}
                          />
                          <div className="absolute left-0 bottom-full mb-2 z-50 bg-popover border border-border rounded-lg shadow-lg">
                            <EmojiPicker
                              onEmojiClick={(emojiData: any) => insertEmoji(emojiData.emoji)}
                              autoFocusSearch={false}
                              theme={"dark" as any}
                              height={400}
                              width={330}
                              style={{
                                "--epr-emoji-size": "22px",
                                "--epr-category-navigation-button-size": "22px",
                                "--epr-category-title-font-size": "12px",
                                "--epr-emoji-padding": "6px",
                                "--epr-horizontal-padding": "14px",
                                "--epr-header-padding": "8px 14px",
                              } as React.CSSProperties}
                              previewConfig={{ showPreview: true }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Submit button */}
                  <button
                    type="submit"
                    className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/85 transition-colors cursor-pointer disabled:opacity-40"
                    disabled={(!newCommentText.trim() && pendingCommentImages.length === 0) || isSubmittingComment}
                  >
                    {isSubmittingComment ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      <Send className="h-[21px] w-[21px]" />
                    )}
                  </button>
                </div>
              </form>

              {/* Comments display thread */}
              <div className="flex flex-col gap-4 mt-2">
                {commentsError && (
                  <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive leading-normal">
                    <AlertCircle className="h-4 w-4 mt-px shrink-0" />
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
                    Belum ada diskusi untuk tiket ini. Gunakan kolom di atas untuk memulai tanggapan.
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 bg-muted/5 border border-border/50 p-4 rounded-xl">
                    {comments
                      .filter((c) => !c.parentCommentId)
                      .map((comment) => {
                        const replies = comments.filter((c) => c.parentCommentId === comment.id);
                        return (
                          <div
                            key={comment.id}
                            className="flex flex-col gap-2.5 border-b border-border/50 pb-4 last:border-b-0 last:pb-0"
                          >
                            {/* Main Comment Row */}
                            <div className="flex gap-3 items-start text-xs group">
                              <Avatar className="h-7 w-7 mt-0.5 border border-border shadow-xs shrink-0">
                                {comment.author.image ? (
                                  <img src={comment.author.image} alt={comment.author.name} className="h-full w-full object-cover rounded-full" />
                                ) : (
                                  <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                                    {comment.author.name.slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <div className="flex-1 flex flex-col gap-1 min-w-0">
                                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                                  <div className="flex items-baseline gap-1.5 flex-wrap">
                                    <span className="font-semibold text-foreground text-[13.5px]">{comment.author.name}</span>
                                    <span className="text-[11.5px] text-muted-foreground">
                                      left a comment at {formatCommentDate(comment.createdAt)}
                                      {comment.updatedAt && (
                                        <span className="text-[9px] italic text-muted-foreground/60 ml-1.5">(diedit)</span>
                                      )}
                                    </span>
                                  </div>

                                  {/* Actions for Main Comment: Balas, Edit, Delete */}
                                  <div className="flex items-center gap-2 text-[11px] opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReplyParentComment(comment);
                                        const form = document.querySelector("form");
                                        const textarea = form?.querySelector("textarea");
                                        textarea?.focus();
                                      }}
                                      className="flex items-center gap-1 text-muted-foreground hover:text-primary px-1.5 py-0.5 rounded hover:bg-muted/80 transition-colors font-medium cursor-pointer"
                                    >
                                      <Reply className="h-3 w-3" />
                                      <span>Balas</span>
                                    </button>

                                    {editingCommentId !== comment.id && (
                                      <>
                                        {comment.author.id === session?.user?.id && (
                                          <button
                                            type="button"
                                            onClick={() => handleStartEditComment(comment.id, comment.body)}
                                            className="hover:text-foreground hover:underline flex items-center gap-0.5 transition-colors cursor-pointer text-muted-foreground"
                                          >
                                            <Edit2 className="h-2.5 w-2.5" /> Edit
                                          </button>
                                        )}
                                        {(comment.author.id === session?.user?.id || isAdmin) && (
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteComment(comment.id)}
                                            className="hover:text-destructive hover:underline flex items-center gap-0.5 transition-colors cursor-pointer text-muted-foreground"
                                          >
                                            <Trash2 className="h-2.5 w-2.5" /> Hapus
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>

                                {editingCommentId === comment.id ? (
                                  /* Edit Form */
                                  <div className="flex flex-col gap-2 mt-1.5 bg-card border border-border/80 p-2.5 rounded-lg relative">
                                    <textarea
                                      value={editingCommentText}
                                      onChange={(e) => handleTextareaChange(e, { type: "comment-edit", id: comment.id })}
                                      onKeyDown={(e) => handleTextareaKeyDown(e, { type: "comment-edit", id: comment.id })}
                                      className="w-full min-h-[60px] rounded border border-input bg-transparent px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
                                      placeholder="Edit komentar... Gunakan @ untuk mention member."
                                    />
                                    <div className="flex justify-end gap-2">
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
                                    {renderFormattedText(comment.body)}
                                  </div>
                                )}

                                {/* Attachments for Main Comment */}
                                {renderCommentAttachments(comment.id, comment.commentAttachments, comment.author.name)}
                              </div>
                            </div>

                            {/* Render Threaded Replies (Indented with left vertical line) */}
                            {replies.length > 0 && (
                              <div className="ml-7 pl-3.5 border-l-2 border-border/50 flex flex-col gap-3 mt-1">
                                {replies.map((reply) => (
                                  <div key={reply.id} className="flex gap-2.5 items-start text-xs group">
                                    <Avatar className="h-6 w-6 mt-0.5 border border-border shadow-xs shrink-0">
                                      {reply.author.image ? (
                                        <img src={reply.author.image} alt={reply.author.name} className="h-full w-full object-cover rounded-full" />
                                      ) : (
                                        <AvatarFallback className="text-[9px] font-bold bg-secondary text-secondary-foreground">
                                          {reply.author.name.slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                      )}
                                    </Avatar>

                                    <div className="flex-1 flex flex-col gap-1 min-w-0">
                                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                                        <div className="flex items-baseline gap-1.5 flex-wrap">
                                          <span className="font-semibold text-foreground text-[12.5px]">{reply.author.name}</span>
                                          <span className="text-[11px] text-muted-foreground">
                                            replied at {formatCommentDate(reply.createdAt)}
                                            {reply.updatedAt && (
                                              <span className="text-[9px] italic text-muted-foreground/60 ml-1.5">(diedit)</span>
                                            )}
                                          </span>
                                        </div>

                                        {/* Actions for Reply: Edit, Delete (No "Balas" button to enforce 1-level) */}
                                        {editingCommentId !== reply.id && (
                                          <div className="flex items-center gap-2 text-[11px] opacity-0 group-hover:opacity-100 transition-opacity">
                                            {reply.author.id === session?.user?.id && (
                                              <button
                                                type="button"
                                                onClick={() => handleStartEditComment(reply.id, reply.body)}
                                                className="hover:text-foreground hover:underline flex items-center gap-0.5 transition-colors cursor-pointer text-muted-foreground"
                                              >
                                                <Edit2 className="h-2.5 w-2.5" /> Edit
                                              </button>
                                            )}
                                            {(reply.author.id === session?.user?.id || isAdmin) && (
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteComment(reply.id)}
                                                className="hover:text-destructive hover:underline flex items-center gap-0.5 transition-colors cursor-pointer text-muted-foreground"
                                              >
                                                <Trash2 className="h-2.5 w-2.5" /> Hapus
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>

                                      {editingCommentId === reply.id ? (
                                        <div className="flex flex-col gap-2 mt-1.5 bg-card border border-border/80 p-2.5 rounded-lg relative">
                                          <textarea
                                            value={editingCommentText}
                                            onChange={(e) => handleTextareaChange(e, { type: "comment-edit", id: reply.id })}
                                            onKeyDown={(e) => handleTextareaKeyDown(e, { type: "comment-edit", id: reply.id })}
                                            className="w-full min-h-[60px] rounded border border-input bg-transparent px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
                                            placeholder="Edit komentar... Gunakan @ untuk mention member."
                                          />
                                          <div className="flex justify-end gap-2">
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
                                              onClick={() => handleSaveEditComment(reply.id)}
                                              disabled={!editingCommentText.trim()}
                                            >
                                              Simpan
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-[12.5px] text-foreground leading-relaxed whitespace-pre-wrap select-text pr-4 mt-0.5">
                                          {renderFormattedText(reply.body)}
                                        </div>
                                      )}

                                      {/* Attachments for Reply */}
                                      {renderCommentAttachments(reply.id, reply.commentAttachments, reply.author.name)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar properties column (25%) - Desktop only */}
          <div className="hidden lg:block lg:col-span-1 lg:border-l border-border/60 lg:pl-6">
            {propertiesContent}
          </div>
        </div>
      </div>

      {/* Preview Attachment Dialog */}
      <Dialog open={!!previewAttachment} onOpenChange={(open) => !open && setPreviewAttachment(null)}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden bg-background border border-border" showCloseButton={false}>
          {previewAttachment && (
            <div className="flex flex-col h-full max-h-[85vh]">
              <DialogHeader className="p-4 border-b border-border/80 flex flex-row items-center justify-between shrink-0">
                <div className="flex flex-col gap-0.5 text-left">
                  <DialogTitle className="text-[14px] font-semibold text-foreground truncate max-w-[500px]">
                    {previewAttachment.fileName}
                  </DialogTitle>
                  <span className="text-[11px] text-muted-foreground">
                    {previewAttachment.uploadedAt ? new Date(previewAttachment.uploadedAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric"
                    }) : ""}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                  onClick={() => setPreviewAttachment(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </DialogHeader>

              <div className="flex-1 overflow-auto p-6 bg-muted/10 flex items-center justify-center min-h-[300px]">
                {isImageFile(previewAttachment.fileName) ? (
                  <img
                    src={`/api/uploads/${previewAttachment.r2ObjectKey}`}
                    alt={previewAttachment.fileName}
                    className="max-w-full max-h-[60vh] object-contain rounded border border-border/60 shadow-md"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 rounded-xl border border-border/80 bg-card flex items-center justify-center shadow-sm">
                      {getFileIcon(previewAttachment.fileName)}
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-foreground text-sm">
                        {previewAttachment.fileName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Pratinjau tidak tersedia untuk jenis file ini.
                      </span>
                    </div>
                    <a
                      href={`/api/uploads/${previewAttachment.r2ObjectKey}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={previewAttachment.fileName}
                      className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors cursor-pointer"
                    >
                      Unduh File
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
