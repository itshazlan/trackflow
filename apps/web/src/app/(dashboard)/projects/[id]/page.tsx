"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  getProjectDetail,
  getSubProjects,
  createSubProject,
  restoreProject,
  updateProject,
  checkProjectKey,
  Project,
} from "@/lib/projects-service";
import { getSession } from "@/lib/auth-service";
import { getProjectMembers } from "@/lib/issues-service";
import { useConfirm } from "@/components/ui/confirm-dialog";
import IssuesSection from "@/components/project/issues-section";
import SettingsSection from "@/components/project/settings-section";
import TimeBookSection from "@/components/project/timebook-section";
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
  Loader2,
  Plus,
  GitMerge,
  AlertCircle,
  Layers,
  CheckSquare,
  Clock,
  LineChart,
  Settings,
  Pencil,
} from "lucide-react";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params?.id as string;
  const confirm = useConfirm();

  const [project, setProject] = useState<Project | null>(null);
  const [subProjects, setSubProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [session, setSession] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [restoreLoading, setRestoreLoading] = useState(false);

  // Edit Project Dialog state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // Create Sub-project Dialog state
  const [isSubDialogOpen, setIsSubDialogOpen] = useState(false);
  const [subName, setSubName] = useState("");
  const [subKey, setSubKey] = useState("");
  const [subDesc, setSubDesc] = useState("");
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState("");
  const [subKeyError, setSubKeyError] = useState("");
  const [isSubKeyManuallyEdited, setIsSubKeyManuallyEdited] = useState(false);
  const [isCheckingSubKey, setIsCheckingSubKey] = useState(false);

  const activeTab = searchParams.get("tab") || "issues";

  const loadProjectData = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError("");
      const [pDetail, subList, sessionData, membersData] = await Promise.all([
        getProjectDetail(projectId),
        getSubProjects(projectId),
        getSession().catch(() => null),
        getProjectMembers(projectId).catch(() => []),
      ]);
      setProject(pDetail);
      setSubProjects(subList);
      setSession(sessionData);
      setMembers(membersData);
    } catch (err) {
      setError("Gagal memuat detail proyek.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const handleRestoreProject = async () => {
    const ok = await confirm({
      title: "Restore Proyek",
      description: "Apakah Anda yakin ingin mengembalikan proyek ini ke status aktif?",
      confirmLabel: "Ya, Restore",
      variant: "default",
    });
    if (!ok) return;

    try {
      setRestoreLoading(true);
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
      setRestoreLoading(false);
    }
  };

  const handleOpenEditModal = () => {
    if (!project) return;
    setEditName(project.name);
    setEditDesc(project.description || "");
    setEditError("");
    setIsEditModalOpen(true);
  };

  const handleSaveProjectDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !editName.trim()) return;

    setEditLoading(true);
    setEditError("");

    try {
      const updated = await updateProject(projectId, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      });
      setProject(updated);
      setIsEditModalOpen(false);
    } catch (err: unknown) {
      console.error(err);
      setEditError(err instanceof Error ? err.message : "Gagal memperbarui data proyek.");
    } finally {
      setEditLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        void loadProjectData();
      }
    });
    return () => {
      active = false;
    };
  }, [loadProjectData]);

  const generateSubKeyFromName = (name: string): string => {
    const cleaned = name.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    let base = cleaned;
    if (base.length > 0 && !/^[A-Z]/.test(base)) {
      base = "S" + base;
    }
    let key = base.substring(0, 5);
    while (key.length > 0 && key.length < 5) {
      key += "X";
    }
    return key;
  };

  const handleSubNameChange = (val: string) => {
    setSubName(val);
    if (!isSubKeyManuallyEdited) {
      const suggestedKey = generateSubKeyFromName(val);
      setSubKey(suggestedKey);
      
      if (suggestedKey.length > 0 && !/^[A-Z][A-Z0-9_-]{1,9}$/.test(suggestedKey)) {
        setSubKeyError("Kode sub-proyek harus alfanumerik (dapat berisi - atau _), 2-10 karakter, dan diawali dengan huruf.");
      } else {
        setSubKeyError("");
      }
    }
  };

  const handleSubKeyChange = (val: string) => {
    const upperVal = val.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    setSubKey(upperVal);
    setIsSubKeyManuallyEdited(true);

    if (upperVal.length > 0 && !/^[A-Z][A-Z0-9_-]{1,9}$/.test(upperVal)) {
      setSubKeyError("Kode sub-proyek harus alfanumerik (dapat berisi - atau _), 2-10 karakter, dan diawali dengan huruf.");
    } else {
      setSubKeyError("");
    }
  };

  const handleSubKeyBlur = () => {
    if (subKey.trim().length > 0) {
      void checkSubKeyUniqueness(subKey.trim());
    }
  };

  const checkSubKeyUniqueness = async (keyToCheck: string) => {
    if (!/^[A-Z][A-Z0-9_-]{1,9}$/.test(keyToCheck)) {
      setSubKeyError("Kode sub-proyek harus alfanumerik (dapat berisi - atau _), 2-10 karakter, dan diawali dengan huruf.");
      return;
    }
    setIsCheckingSubKey(true);
    try {
      const res = await checkProjectKey(keyToCheck);
      if (!res.available) {
        setSubKeyError("Kode Sub-Proyek sudah digunakan.");
      } else {
        setSubKeyError("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCheckingSubKey(false);
    }
  };

  const handleCreateSubProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subName.trim() || !subKey.trim() || !projectId) return;

    setSubLoading(true);
    setSubError("");
    setSubKeyError("");
    try {
      await createSubProject(projectId, subName.trim(), subKey.trim(), subDesc.trim() || undefined);
      setSubName("");
      setSubKey("");
      setSubDesc("");
      setIsSubKeyManuallyEdited(false);
      setIsSubDialogOpen(false);
      // Reload sub-projects list
      const subList = await getSubProjects(projectId);
      setSubProjects(subList);
    } catch (err: unknown) {
      setSubError(err instanceof Error ? err.message : "Gagal membuat sub-proyek.");
    } finally {
      setSubLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && !searchParams.get("tab")) {
      const savedTab = localStorage.getItem(`trackflow:last-tab:${projectId}`);
      if (savedTab && savedTab !== "issues") {
        router.replace(`/projects/${projectId}?tab=${savedTab}`);
      }
    }
  }, [projectId, searchParams, router]);

  const handleTabChange = (val: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(`trackflow:last-tab:${projectId}`, val);
    }
    router.push(`/projects/${projectId}?tab=${val}`);
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error || "Proyek tidak ditemukan."}</span>
        </div>
        <Button variant="outline" className="h-8 text-[12px] mt-4" onClick={() => router.push("/projects")}>
          Kembali ke Daftar Proyek
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto flex flex-col gap-6">
      {/* Project Banner Info */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between border-b border-border pb-5 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 border border-primary/20 text-primary font-bold text-[12px] uppercase">
              {project.name[0]}
            </span>
            <h1 className="text-[17px] font-semibold text-foreground tracking-tight flex items-center gap-1.5">
              {project.name}
              {(session?.user?.isAdmin || members.find((m) => m.id === session?.user?.id)?.role === "manager") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground rounded"
                  onClick={handleOpenEditModal}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </h1>
          </div>
          <p className="text-[12.5px] text-muted-foreground mt-2 max-w-2xl leading-relaxed">
            {project.description || "Tidak ada deskripsi detail untuk proyek ini."}
          </p>
        </div>

        {/* Sub-projects list widget in banner */}
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3.5 min-w-[240px] shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <Layers className="h-3.5 w-3.5" />
              Sub-Proyek ({subProjects.length})
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSubError("");
                setIsSubDialogOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {subProjects.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic mt-1">Belum ada sub-proyek.</p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-[120px] overflow-y-auto mt-1 pr-1.5 scrollbar-thin">
              {subProjects.map((sub) => (
                <div
                  key={sub.id}
                  onClick={() => router.push(`/projects/${sub.id}`)}
                  className="flex items-center gap-1.5 text-[12px] text-foreground hover:text-primary transition-colors cursor-pointer hover:underline truncate"
                >
                  <GitMerge className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate">{sub.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {project.archivedAt && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-600 leading-normal">
          <div className="flex items-start md:items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-[1px] md:mt-0" />
            <div>
              <span className="font-semibold text-amber-700 dark:text-amber-400">Proyek Terarsip:</span> Proyek ini telah diarsipkan dan berada dalam status baca-saja. Anda tidak dapat membuat tiket baru atau mengubah status alur kerja kecuali proyek dipulihkan.
            </div>
          </div>
          {(session?.user?.isAdmin || members.find((m) => m.id === session?.user?.id)?.role === "manager") && (
            <Button
              variant="outline"
              size="sm"
              className="h-7.5 text-[11px] font-semibold border-amber-500/20 text-amber-700 bg-amber-500/5 hover:bg-amber-500/10 dark:text-amber-400 w-fit shrink-0"
              onClick={handleRestoreProject}
              disabled={restoreLoading}
            >
              {restoreLoading ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" stroke="currentColor" />
                  Memulihkan...
                </>
              ) : (
                "Restore Proyek"
              )}
            </Button>
          )}
        </div>
      )}

      {/* Tabs Menu */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full flex flex-col gap-4">
        <TabsList className="w-fit h-9 bg-muted/50 border border-border p-0.5 rounded-lg">
          <TabsTrigger value="issues" className="text-[12px] font-medium px-4 rounded-md flex items-center gap-1.5">
            <CheckSquare className="h-3.5 w-3.5" />
            Issues
          </TabsTrigger>
          <TabsTrigger value="timebook" className="text-[12px] font-medium px-4 rounded-md flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Time Book
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-[12px] font-medium px-4 rounded-md flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Tab Empty/Placeholder states */}
        <TabsContent value="issues" className="mt-0">
          <IssuesSection projectId={projectId} />
        </TabsContent>

        <TabsContent value="timebook" className="mt-0">
          <TimeBookSection projectId={projectId} />
        </TabsContent>

        <TabsContent value="settings" className="mt-0">
          <SettingsSection projectId={projectId} />
        </TabsContent>
      </Tabs>

      {/* Create Subproject Dialog */}
      <Dialog open={isSubDialogOpen} onOpenChange={setIsSubDialogOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <form onSubmit={handleCreateSubProject}>
            <DialogHeader>
              <DialogTitle className="text-[14px] font-semibold">Buat Sub-Proyek Baru</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-3 py-4">
              {subError && (
                <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive leading-normal">
                  <AlertCircle className="h-3.5 w-3.5 mt-[1px] shrink-0" />
                  <span>{subError}</span>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sub-name" className="text-[11px] font-medium text-muted-foreground">
                  Nama Sub-Proyek
                </Label>
                <Input
                  id="sub-name"
                  type="text"
                  placeholder="Contoh: Phase 2 - API Development"
                  className="h-8 text-[12.5px]"
                  value={subName}
                  onChange={(e) => handleSubNameChange(e.target.value)}
                  required
                  disabled={subLoading}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="sub-key" className="text-[11px] font-medium text-muted-foreground">
                    Kode Sub-Proyek (Sub-project Key)
                  </Label>
                  {isCheckingSubKey && (
                    <span className="text-[10px] text-muted-foreground animate-pulse">Memeriksa...</span>
                  )}
                </div>
                <Input
                  id="sub-key"
                  type="text"
                  placeholder="Contoh: TRACK, MOB"
                  className={`h-8 text-[12.5px] uppercase ${subKeyError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  value={subKey}
                  onChange={(e) => handleSubKeyChange(e.target.value)}
                  onBlur={handleSubKeyBlur}
                  required
                  disabled={subLoading}
                />
                {subKeyError && (
                  <span className="text-[10px] text-destructive mt-0.5">{subKeyError}</span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sub-desc" className="text-[11px] font-medium text-muted-foreground">
                  Deskripsi Sub-Proyek (Opsional)
                </Label>
                <textarea
                  id="sub-desc"
                  placeholder="Tulis ringkasan singkat sub-proyek..."
                  className="min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-[12.5px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={subDesc}
                  onChange={(e) => setSubDesc(e.target.value)}
                  disabled={subLoading}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-8 text-[12px]"
                onClick={() => setIsSubDialogOpen(false)}
                disabled={subLoading}
              >
                Batal
              </Button>
              <Button
                type="submit"
                className="h-8 text-[12px]"
                disabled={subLoading || !subName.trim() || !subKey.trim() || !!subKeyError || isCheckingSubKey}
              >
                {subLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    Membuat...
                  </>
                ) : (
                  "Buat Sub-Proyek"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <form onSubmit={handleSaveProjectDetails}>
            <DialogHeader>
              <DialogTitle className="text-[14px] font-semibold flex items-center gap-1.5">
                <Pencil className="h-4 w-4 text-primary" />
                Edit Proyek
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-3.5 py-4">
              {editError && (
                <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive leading-normal">
                  <AlertCircle className="h-3.5 w-3.5 mt-[1px] shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-key" className="text-[11px] font-medium text-muted-foreground">Kode Proyek (Immutable)</Label>
                <Input
                  id="edit-key"
                  value={project.key}
                  disabled
                  className="h-8 bg-muted/50 border-border text-[12px] text-muted-foreground cursor-not-allowed select-none font-semibold font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-name" className="text-[11px] font-medium text-muted-foreground">Nama Proyek</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nama proyek"
                  className="h-8 text-[12.5px]"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-desc" className="text-[11px] font-medium text-muted-foreground">Deskripsi</Label>
                <textarea
                  id="edit-desc"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Deskripsi proyek..."
                  className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-[12.5px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-8 text-[12px]"
                onClick={() => setIsEditModalOpen(false)}
                disabled={editLoading}
              >
                Batal
              </Button>
              <Button
                type="submit"
                className="h-8 text-[12px]"
                disabled={editLoading || !editName.trim()}
              >
                {editLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
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
    </div>
  );
}
