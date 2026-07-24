"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  getProjectStatuses,
  getProjectTemplates,
  getTrackers,
  createProjectStatus,
  updateProjectStatus,
  deleteProjectStatus,
  reorderProjectStatuses,
  createProjectTemplate,
  updateProjectTemplate,
  deleteProjectTemplate,
  getProjectMembers,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
  getSystemUsers,
  IssueStatus,
  IssueTemplate,
  Tracker,
  TemplateField,
  ProjectMember,
} from "@/lib/issues-service";
import { getSession, UserSession } from "@/lib/auth-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Edit2,
  AlertCircle,
  Sliders,
  FileText,
  Users,
  Settings,
  Webhook,
} from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Project,
  getProjectDetail,
  archiveProject,
  restoreProject,
  deleteProject,
} from "@/lib/projects-service";
import DiscordWebhookCard from "@/components/discord-webhook-card";
import {
  getProjectDiscordWebhook,
  saveProjectDiscordWebhook,
  deleteProjectDiscordWebhook,
  testProjectDiscordWebhook,
} from "@/lib/discord-service";

interface SettingsSectionProps {
  projectId: string;
}

export default function SettingsSection({ projectId }: SettingsSectionProps) {
  const confirm = useConfirm();
  const [session, setSession] = useState<UserSession | null>(null);
  const [statuses, setStatuses] = useState<IssueStatus[]>([]);
  const [templates, setTemplates] = useState<IssueTemplate[]>([]);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [systemUsers, setSystemUsers] = useState<Array<{ id: string; name: string; email: string; username: string }>>([]);
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
  const [templateDescriptionPattern, setTemplateDescriptionPattern] = useState("");
  const [templateActionLoading, setTemplateActionLoading] = useState(false);
  const [templateError, setTemplateError] = useState("");
  const [templateIsPublic, setTemplateIsPublic] = useState(false);

  // Modals state for Members
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [memberRole, setMemberRole] = useState<'manager' | 'developer' | 'reporter_qa'>("developer");
  const [memberActionLoading, setMemberActionLoading] = useState(false);
  const [memberError, setMemberError] = useState("");

  const [project, setProject] = useState<Project | null>(null);
  const [confirmInput, setConfirmInput] = useState("");
  const [archiveActionLoading, setArchiveActionLoading] = useState(false);
  const [deleteActionLoading, setDeleteActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [statusesData, templatesData, trackersData, sessionData, membersData, systemUsersData, projectData] = await Promise.all([
        getProjectStatuses(projectId),
        getProjectTemplates(projectId),
        getTrackers(),
        getSession(),
        getProjectMembers(projectId),
        getSystemUsers().catch(() => []),
        getProjectDetail(projectId),
      ]);
      setStatuses(statusesData);
      setTemplates(templatesData);
      setTrackers(trackersData);
      setSession(sessionData);
      setMembers(membersData);
      setSystemUsers(systemUsersData);
      setProject(projectData);
    } catch (err) {
      console.error(err);
      setError("Gagal memuat konfigurasi settings.");
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

  const handleArchive = async () => {
    const ok = await confirm({
      title: "Arsipkan Proyek",
      description: "Apakah Anda yakin ingin mengarsipkan proyek ini? Sub-proyek aktif di bawah proyek ini juga harus diarsipkan terlebih dahulu.",
      confirmLabel: "Ya, Arsipkan",
      variant: "default",
    });
    if (!ok) return;

    try {
      setArchiveActionLoading(true);
      const updated = await archiveProject(projectId);
      setProject(updated);
      await confirm({
        title: "Proyek Diarsipkan",
        description: "Proyek berhasil diarsipkan.",
        confirmLabel: "Tutup",
        cancelLabel: "",
        variant: "default",
      });
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      await confirm({
        title: "Gagal Mengarsipkan",
        description: err.message || "Gagal mengarsipkan proyek. Pastikan seluruh sub-proyek di bawah proyek ini sudah diarsipkan terlebih dahulu.",
        confirmLabel: "Tutup",
        cancelLabel: "",
        variant: "destructive",
      });
    } finally {
      setArchiveActionLoading(false);
    }
  };

  const handleRestore = async () => {
    const ok = await confirm({
      title: "Restore Proyek",
      description: "Apakah Anda yakin ingin mengembalikan proyek ini?",
      confirmLabel: "Ya, Restore",
      variant: "default",
    });
    if (!ok) return;

    try {
      setArchiveActionLoading(true);
      const updated = await restoreProject(projectId);
      setProject(updated);
      await confirm({
        title: "Proyek Dipulihkan",
        description: "Proyek berhasil dikembalikan ke status aktif.",
        confirmLabel: "Tutup",
        cancelLabel: "",
        variant: "default",
      });
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      await confirm({
        title: "Gagal Memulihkan",
        description: err.message || "Gagal memulihkan proyek.",
        confirmLabel: "Tutup",
        cancelLabel: "",
        variant: "destructive",
      });
    } finally {
      setArchiveActionLoading(false);
    }
  };

  const handleHardDelete = async () => {
    if (!project || confirmInput !== project.key) return;

    const ok = await confirm({
      title: "HAPUS PROYEK PERMANEN",
      description: `Apakah Anda benar-benar yakin ingin menghapus proyek "${project.name}" secara permanen? TINDAKAN INI TIDAK DAPAT DIBATALKAN.`,
      confirmLabel: "Hapus Permanen",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      setDeleteActionLoading(true);
      await deleteProject(projectId, confirmInput);
      await confirm({
        title: "Proyek Dihapus",
        description: "Proyek telah dihapus secara permanen.",
        confirmLabel: "Tutup",
        cancelLabel: "",
        variant: "default",
      });
      window.location.href = "/projects";
    } catch (err: any) {
      console.error(err);
      await confirm({
        title: "Gagal Menghapus Proyek",
        description: err.message || "Gagal menghapus proyek secara permanen.",
        confirmLabel: "Tutup",
        cancelLabel: "",
        variant: "destructive",
      });
    } finally {
      setDeleteActionLoading(false);
    }
  };

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
      await reorderProjectStatuses(projectId, statusIds);
    } catch (err) {
      console.error(err);
      await confirm({
        title: "Gagal Mengubah Urutan",
        description: "Gagal memperbarui urutan status.",
        confirmLabel: "Tutup",
        cancelLabel: "",
        variant: "destructive",
      });
      void fetchData();
    }
  };

  const handleDeleteStatus = async (statusId: string) => {
    const ok = await confirm({
      title: "Hapus Status",
      description: "Apakah Anda yakin ingin menghapus status ini?",
      confirmLabel: "Ya, Hapus",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await deleteProjectStatus(projectId, statusId);
      setStatuses((prev) => prev.filter((s) => s.id !== statusId));
    } catch (err) {
      console.error(err);
      await confirm({
        title: "Gagal Menghapus",
        description: "Gagal menghapus status. Pastikan tidak ada issue yang dikaitkan dengan status ini.",
        confirmLabel: "Tutup",
        cancelLabel: "",
        variant: "destructive",
      });
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
        const updated = await updateProjectStatus(projectId, statusEditing.id, payload);
        setStatuses((prev) => prev.map((s) => (s.id === statusEditing.id ? updated : s)));
      } else {
        const nextOrderIndex = statuses.length > 0 ? Math.max(...statuses.map((s) => s.orderIndex)) + 1 : 0;
        const newStatus = await createProjectStatus(projectId, {
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
    const ok = await confirm({
      title: "Hapus Template",
      description: "Apakah Anda yakin ingin menghapus template ini?",
      confirmLabel: "Ya, Hapus",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await deleteProjectTemplate(projectId, templateId);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    } catch (err) {
      console.error(err);
      await confirm({
        title: "Gagal Menghapus",
        description: "Gagal menghapus template.",
        confirmLabel: "Tutup",
        cancelLabel: "",
        variant: "destructive",
      });
    }
  };

  const handleOpenTemplateModal = (template?: IssueTemplate) => {
    if (template) {
      setTemplateEditing(template);
      setTemplateName(template.name);
      setTemplateTrackerId(template.trackerId);
      setTemplateTitlePattern(template.titlePattern || "");
      setTemplateDescriptionPattern(template.descriptionPattern || "");
      setTemplateIsPublic(template.projectId === null);
    } else {
      setTemplateEditing(null);
      setTemplateName("");
      setTemplateTrackerId(trackers.length > 0 ? trackers[0].id : "");
      setTemplateTitlePattern("");
      setTemplateDescriptionPattern("");
      setTemplateIsPublic(false);
    }
    setTemplateError("");
    setIsTemplateModalOpen(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) return;

    setTemplateActionLoading(true);
    setTemplateError("");

    try {
      const payload = {
        name: templateName.trim(),
        titlePattern: templateTitlePattern.trim() || undefined,
        descriptionPattern: templateDescriptionPattern.trim() || undefined,
        trackerId: templateEditing ? templateTrackerId : undefined,
      };

      if (templateEditing) {
        const updated = await updateProjectTemplate(projectId, templateEditing.id, {
          name: payload.name,
          trackerId: payload.trackerId,
          titlePattern: payload.titlePattern || null,
          descriptionPattern: payload.descriptionPattern || null,
          projectId: templateIsPublic ? null : projectId,
        });
        setTemplates((prev) => prev.map((t) => (t.id === templateEditing.id ? updated : t)));
      } else {
        const newTemplate = await createProjectTemplate(projectId, {
          ...payload,
          projectId: templateIsPublic ? null : projectId,
        });
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

  const currentMember = members.find(
    (m) => m.email === session?.user?.email || m.username === session?.user?.username
  );
  const userRole = currentMember?.role;
  const isAdmin = session?.user?.isAdmin;
  const isManagerOrAdmin = userRole === "manager" || isAdmin;

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setMemberActionLoading(true);
    setMemberError("");
    try {
      await addProjectMember(projectId, selectedUserId, memberRole);
      setIsMemberModalOpen(false);
      setSelectedUserId("");
      setMemberRole("developer");
      const membersData = await getProjectMembers(projectId);
      setMembers(membersData);
    } catch (err: unknown) {
      setMemberError(err instanceof Error ? err.message : "Gagal menambahkan anggota.");
    } finally {
      setMemberActionLoading(false);
    }
  };

  const handleUpdateMemberRole = async (userId: string, role: 'manager' | 'developer' | 'reporter_qa') => {
    setMemberActionLoading(true);
    setMemberError("");
    try {
      await updateProjectMemberRole(projectId, userId, role);
      const membersData = await getProjectMembers(projectId);
      setMembers(membersData);
    } catch (err: unknown) {
      setMemberError(err instanceof Error ? err.message : "Gagal mengubah peran anggota.");
    } finally {
      setMemberActionLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    const ok = await confirm({
      title: "Hapus Anggota Proyek",
      description: "Apakah Anda yakin ingin mengeluarkan anggota ini dari proyek?",
      confirmLabel: "Ya, Keluarkan",
      variant: "destructive",
    });
    if (!ok) return;

    setMemberActionLoading(true);
    setMemberError("");
    try {
      await removeProjectMember(projectId, userId);
      const membersData = await getProjectMembers(projectId);
      setMembers(membersData);
    } catch (err: unknown) {
      setMemberError(err instanceof Error ? err.message : "Gagal mengeluarkan anggota.");
    } finally {
      setMemberActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Tabs defaultValue="general" className="w-full flex flex-col gap-4">
        <TabsList className="w-fit h-8.5 bg-muted/40 border border-border p-0.5 rounded-lg shrink-0">
          <TabsTrigger value="general" className="text-[11.5px] font-medium px-3.5 rounded-md flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Umum
          </TabsTrigger>
          <TabsTrigger value="workflow" className="text-[11.5px] font-medium px-3.5 rounded-md flex items-center gap-1.5">
            <Sliders className="h-3.5 w-3.5" />
            Workflow Status
          </TabsTrigger>
          <TabsTrigger value="templates" className="text-[11.5px] font-medium px-3.5 rounded-md flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Template Tiket
          </TabsTrigger>
          <TabsTrigger value="members" className="text-[11.5px] font-medium px-3.5 rounded-md flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Anggota Proyek
          </TabsTrigger>
          <TabsTrigger value="integrations" className="text-[11.5px] font-medium px-3.5 rounded-md flex items-center gap-1.5">
            <Webhook className="h-3.5 w-3.5" />
            Integrasi
          </TabsTrigger>
        </TabsList>

        {/* General Settings Content */}
        <TabsContent value="general" className="mt-0 flex flex-col gap-6 pb-24">
          <div className="flex flex-col gap-6 rounded-lg border border-border bg-card p-4.5">
            <div>
              <h3 className="text-[13.5px] font-semibold text-foreground">Detail Proyek</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Informasi dasar mengenai proyek Anda.
              </p>
            </div>

            <div className="grid gap-4.5 text-xs">
              <div className="grid grid-cols-3 gap-4 border-b border-border/40 pb-3">
                <span className="font-medium text-muted-foreground">Nama Proyek</span>
                <span className="col-span-2 text-foreground font-semibold">{project?.name}</span>
              </div>
              <div className="grid grid-cols-3 gap-4 border-b border-border/40 pb-3">
                <span className="font-medium text-muted-foreground">Kode Proyek (Key)</span>
                <span className="col-span-2 text-foreground font-semibold">{project?.key}</span>
              </div>
              <div className="grid grid-cols-3 gap-4 border-b border-border/40 pb-3">
                <span className="font-medium text-muted-foreground">Deskripsi</span>
                <span className="col-span-2 text-foreground">{project?.description || "-"}</span>
              </div>
              <div className="grid grid-cols-3 gap-4 pb-1">
                <span className="font-medium text-muted-foreground">Status Arsip</span>
                <span className="col-span-2">
                  {project?.archivedAt ? (
                    <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-500 border border-amber-500/20">
                      Terarsip
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-500 border border-emerald-500/20">
                      Aktif
                    </span>
                  )}
                </span>
              </div>
            </div>

            {isManagerOrAdmin && (
              <div className="flex justify-start border-t border-border pt-4">
                {project?.archivedAt ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 text-[12px]"
                    onClick={handleRestore}
                    disabled={archiveActionLoading}
                  >
                    {archiveActionLoading ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Memulihkan...
                      </>
                    ) : (
                      "Restore Proyek"
                    )}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 text-[12px]"
                    onClick={handleArchive}
                    disabled={archiveActionLoading}
                  >
                    {archiveActionLoading ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Pengarsipan...
                      </>
                    ) : (
                      "Arsipkan Proyek"
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>

          {isAdmin && (
            <div className="flex flex-col gap-4.5 rounded-lg border border-destructive/20 bg-destructive/5 p-4.5">
              <div>
                <h3 className="text-[13.5px] font-semibold text-destructive">Danger Zone</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Seluruh tiket, jam kerja, dan laporan terkait proyek ini akan hilang permanen dan tidak bisa dikembalikan.
                </p>
              </div>

              <div className="flex flex-col gap-3 max-w-[400px]">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirm-key" className="text-[11px] font-semibold text-muted-foreground">
                    Ketik ulang Kode Proyek <span className="font-bold text-foreground">"{project?.key}"</span> untuk konfirmasi
                  </Label>
                  <Input
                    id="confirm-key"
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder={project?.key || ""}
                    className="h-8 text-[12px] uppercase bg-card border-destructive/20 focus-visible:ring-destructive/30"
                  />
                </div>

                <Button
                  type="button"
                  variant="destructive"
                  className="h-8 text-[12px] w-fit font-medium"
                  disabled={confirmInput !== project?.key || deleteActionLoading}
                  onClick={handleHardDelete}
                >
                  {deleteActionLoading ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Menghapus...
                    </>
                  ) : (
                    "Hapus Permanen"
                  )}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Workflow settings content */}
        <TabsContent value="workflow" className="mt-0 flex flex-col gap-4 pb-24">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[13.5px] font-semibold text-foreground">Alur Kerja Status (Workflow)</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Urutkan status alur kerja (kiri ke kanan / atas ke bawah) dan tentukan hak akses peran.
              </p>
            </div>
            <Button size="sm" className="h-7.5 text-[11.5px] font-medium" onClick={() => handleOpenStatusModal()}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Tambah Status
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-16 pl-4 text-center">Urutan</TableHead>
                  <TableHead>Nama Status</TableHead>
                  <TableHead className="w-48">Akses Terbatas</TableHead>
                  <TableHead className="w-24 text-right pr-4">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statuses.map((status, idx) => (
                  <TableRow key={status.id} className="hover:bg-muted/30">
                    <TableCell className="pl-4">
                      <div className="flex items-center justify-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded"
                          disabled={idx === 0}
                          onClick={() => handleReorderStatus(idx, "up")}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded"
                          disabled={idx === statuses.length - 1}
                          onClick={() => handleReorderStatus(idx, "down")}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground text-[12.5px]">
                      {status.name}
                    </TableCell>
                    <TableCell>
                      <span className="text-[11.5px] text-muted-foreground font-medium">
                        {status.restrictedToRole ? (
                          <span className="rounded bg-destructive/10 border border-destructive/20 text-destructive text-[10px] px-1.5 py-0.5 uppercase font-semibold">
                            {status.restrictedToRole} Only
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">Terbuka untuk semua</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded"
                          onClick={() => handleOpenStatusModal(status)}
                        >
                          <Edit2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleDeleteStatus(status.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Templates settings content */}
        <TabsContent value="templates" className="mt-0 flex flex-col gap-4 pb-24">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[13.5px] font-semibold text-foreground">Template Form Tiket</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Konfigurasi bidang input kustom untuk menyusun data terstruktur per tipe tracker tiket.
              </p>
            </div>
            <Button size="sm" className="h-7.5 text-[11.5px] font-medium" onClick={() => handleOpenTemplateModal()}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Buat Template
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.length === 0 ? (
              <div className="col-span-2 text-center py-8 border border-dashed border-border rounded-lg text-muted-foreground text-xs">
                Belum ada template kustom yang dibuat.
              </div>
            ) : (
              templates.map((tpl) => (
                <div key={tpl.id} className="rounded-lg border border-border bg-card p-4 flex flex-col justify-between shadow-sm">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                        {tpl.name}
                        {tpl.projectId === null && (
                          <span className="inline-flex items-center rounded bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[9px] font-semibold text-primary select-none">
                            Publik / Global
                          </span>
                        )}
                      </h4>
                    </div>
                    {tpl.titlePattern && (
                      <p className="text-[11.5px] text-muted-foreground mt-2 leading-relaxed">
                        <span className="font-semibold">Pattern Judul:</span> <code className="font-mono bg-muted/60 px-1 py-0.25 rounded text-[10.5px]">{tpl.titlePattern}</code>
                      </p>
                    )}
                    {tpl.descriptionPattern && (
                      <div className="mt-3 bg-muted/20 border border-border/60 rounded p-2 px-2.5 max-h-[120px] overflow-y-auto">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          Prefill Deskripsi (Markdown)
                        </span>
                        <pre className="text-[11px] text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed">
                          {tpl.descriptionPattern}
                        </pre>
                      </div>
                    )}
                  </div>
                  {(tpl.projectId !== null || isAdmin) && (
                    <div className="border-t border-border mt-4 pt-3 flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" className="h-7 text-[11px] font-medium px-2.5" onClick={() => handleOpenTemplateModal(tpl)}>
                        Edit Template
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-[11px] font-medium text-destructive hover:bg-destructive/10 hover:text-destructive px-2.5" onClick={() => handleDeleteTemplate(tpl.id)}>
                        Hapus
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* Members settings content */}
        <TabsContent value="members" className="mt-0 flex flex-col gap-4 pb-24">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[13.5px] font-semibold text-foreground">Anggota Proyek</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Kelola anggota tim yang memiliki akses ke proyek ini beserta perannya.
              </p>
            </div>
            {isManagerOrAdmin && (
              <Button size="sm" className="h-7.5 text-[11.5px] font-medium" onClick={() => {
                setMemberError("");
                setIsMemberModalOpen(true);
              }}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Tambah Anggota
              </Button>
            )}
          </div>

          {memberError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{memberError}</span>
            </div>
          )}

          <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-40">Peran Proyek</TableHead>
                  {isManagerOrAdmin && <TableHead className="w-24 text-right pr-4">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={isManagerOrAdmin ? 4 : 3} className="h-28 text-center text-muted-foreground">
                      Belum ada anggota tim terdaftar.
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((member) => (
                    <TableRow key={member.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="font-medium text-foreground pl-4">
                        {member.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.email}
                      </TableCell>
                      <TableCell>
                        {isManagerOrAdmin ? (
                          <select
                            value={member.role}
                            onChange={(e) => handleUpdateMemberRole(member.id, e.target.value as any)}
                            disabled={memberActionLoading}
                            className="h-7.5 w-full rounded border border-input bg-card px-2 text-[11.5px] outline-none focus:ring-1 focus:ring-ring"
                          >
                            <option value="manager">Manager</option>
                            <option value="developer">Developer</option>
                            <option value="reporter_qa">Reporter / QA</option>
                          </select>
                        ) : (
                          <span className="inline-flex items-center rounded border border-border px-2 py-0.5 text-[10.5px] font-medium bg-muted/40 text-muted-foreground capitalize select-none">
                            {member.role === 'reporter_qa' ? 'Reporter / QA' : member.role}
                          </span>
                        )}
                      </TableCell>
                      {isManagerOrAdmin && (
                        <TableCell className="text-right pr-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={memberActionLoading}
                            className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleRemoveMember(member.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Integrasi settings content */}
        <TabsContent value="integrations" className="mt-0 flex flex-col gap-4 pb-24">
          <DiscordWebhookCard
            title="Integrasi Discord Proyek"
            description="Kirim notifikasi otomatis ke channel Discord khusus proyek ini saat issue baru dibuat atau status berubah."
            eventOptions={[
              { id: "issue_created", label: "Notifikasi saat Issue Baru Dibuat" },
              { id: "issue_status_changed", label: "Notifikasi saat Status Issue Berubah" },
            ]}
            onFetch={() => getProjectDiscordWebhook(projectId)}
            onSave={(url, events) => saveProjectDiscordWebhook(projectId, url, events)}
            onDelete={() => deleteProjectDiscordWebhook(projectId)}
            onTest={() => testProjectDiscordWebhook(projectId)}
          />
        </TabsContent>
      </Tabs>

      {/* Status Modal Dialog */}
      <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
        <DialogContent className="sm:max-w-[340px]">
          <form onSubmit={handleSaveStatus}>
            <DialogHeader>
              <DialogTitle className="text-[14px] font-semibold">
                {statusEditing ? "Edit Status Alur Kerja" : "Tambah Status Baru"}
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-3.5 py-4">
              {statusError && (
                <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive leading-normal">
                  <AlertCircle className="h-3.5 w-3.5 mt-[1px] shrink-0" />
                  <span>{statusError}</span>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="status-name" className="text-[11px] font-medium text-muted-foreground">
                  Nama Status
                </Label>
                <Input
                  id="status-name"
                  type="text"
                  placeholder="Contoh: In Review, QA Ready"
                  required
                  value={statusName}
                  onChange={(e) => setStatusName(e.target.value)}
                  className="h-8 text-[12.5px]"
                  disabled={statusActionLoading}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="status-role" className="text-[11px] font-medium text-muted-foreground">
                  Batasi Transisi Status untuk Peran
                </Label>
                <select
                  id="status-role"
                  value={statusRoleRestriction}
                  onChange={(e) => setStatusRoleRestriction(e.target.value)}
                  className="h-8 rounded-md border border-input bg-card px-2 text-[12.5px] outline-none"
                  disabled={statusActionLoading}
                >
                  <option value="">Terbuka untuk Semua Anggota</option>
                  <option value="manager">Manager Only</option>
                  <option value="developer">Developer Only</option>
                  <option value="reporter_qa">Reporter QA Only</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-8 text-[12px]"
                onClick={() => setIsStatusModalOpen(false)}
                disabled={statusActionLoading}
              >
                Batal
              </Button>
              <Button type="submit" className="h-8 text-[12px]" disabled={statusActionLoading}>
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

      {/* Template Modal Dialog */}
      <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
        <DialogContent className="sm:max-w-[440px] max-h-[85vh] overflow-y-auto">
          <form onSubmit={handleSaveTemplate}>
            <DialogHeader>
              <DialogTitle className="text-[14px] font-semibold">
                {templateEditing ? "Edit Template Form" : "Buat Template Form Baru"}
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-3.5 py-4">
              {templateError && (
                <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive leading-normal">
                  <AlertCircle className="h-3.5 w-3.5 mt-[1px] shrink-0" />
                  <span>{templateError}</span>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="template-name" className="text-[11px] font-medium text-muted-foreground">
                  Nama Template
                </Label>
                <Input
                  id="template-name"
                  type="text"
                  placeholder="Contoh: Bug Report"
                  required
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="h-8 text-[12.5px]"
                  disabled={templateActionLoading}
                />
              </div>



              <div className="flex flex-col gap-1.5">
                <Label htmlFor="template-pattern" className="text-[11px] font-medium text-muted-foreground">
                  Pattern Format Judul (Opsional)
                </Label>
                <Input
                  id="template-pattern"
                  type="text"
                  placeholder="Contoh: [BUG] {feature} - {bugName}"
                  value={templateTitlePattern}
                  onChange={(e) => setTemplateTitlePattern(e.target.value)}
                  className="h-8 text-[12.5px]"
                  disabled={templateActionLoading}
                />
                <span className="text-[10px] text-muted-foreground">
                  Gunakan kurung kurawal untuk mendefinisikan bidang dinamis judul (contoh: &#123;feature&#125;).
                </span>
              </div>

              <div className="h-px bg-border my-1" />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="template-desc-pattern" className="text-[11px] font-medium text-muted-foreground">
                  Template Deskripsi / Prefill Masalah (Opsional)
                </Label>
                <textarea
                  id="template-desc-pattern"
                  placeholder="Masukkan teks awal deskripsi (Markdown)..."
                  value={templateDescriptionPattern}
                  onChange={(e) => setTemplateDescriptionPattern(e.target.value)}
                  className="min-h-[160px] w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-[12.5px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  disabled={templateActionLoading}
                />
              </div>

              <div className="flex items-center gap-2 mt-1 py-1">
                <input
                  type="checkbox"
                  id="template-is-public"
                  checked={templateIsPublic}
                  onChange={(e) => setTemplateIsPublic(e.target.checked)}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer bg-transparent border"
                  disabled={templateActionLoading}
                />
                <Label htmlFor="template-is-public" className="text-[12px] font-medium text-foreground cursor-pointer select-none">
                  Jadikan Template Publik (Dapat digunakan di proyek lainnya)
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-8 text-[12px]"
                onClick={() => setIsTemplateModalOpen(false)}
                disabled={templateActionLoading}
              >
                Batal
              </Button>
              <Button type="submit" className="h-8 text-[12px]" disabled={templateActionLoading}>
                {templateActionLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Template"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={isMemberModalOpen} onOpenChange={setIsMemberModalOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <form onSubmit={handleAddMember}>
            <DialogHeader>
              <DialogTitle className="text-[14px] font-semibold">Tambah Anggota Proyek</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-3.5 py-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="member-user" className="text-[11px] font-semibold text-muted-foreground">
                  Pilih Pengguna <span className="text-red-500">*</span>
                </Label>
                <select
                  id="member-user"
                  required
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="h-8.5 w-full rounded-md border border-input bg-card px-2 text-[12px] outline-none"
                  disabled={memberActionLoading}
                >
                  <option value="">-- Pilih Pengguna --</option>
                  {systemUsers
                    .filter((u) => !members.some((m) => m.id === u.id))
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="member-role" className="text-[11px] font-semibold text-muted-foreground">
                  Peran Proyek <span className="text-red-500">*</span>
                </Label>
                <select
                  id="member-role"
                  required
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as any)}
                  className="h-8.5 w-full rounded-md border border-input bg-card px-2 text-[12px] outline-none"
                  disabled={memberActionLoading}
                >
                  <option value="developer">Developer</option>
                  <option value="reporter_qa">Reporter / QA</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-8 text-[12px]"
                onClick={() => setIsMemberModalOpen(false)}
                disabled={memberActionLoading}
              >
                Batal
              </Button>
              <Button type="submit" className="h-8 text-[12px]" disabled={memberActionLoading || !selectedUserId}>
                {memberActionLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Tambah Anggota"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
