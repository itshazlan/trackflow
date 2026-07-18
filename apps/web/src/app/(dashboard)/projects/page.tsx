"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProjects, createProject, checkProjectKey, Project } from "@/lib/projects-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Folder,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

export default function ProjectsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectKey, setNewProjectKey] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [createError, setCreateError] = useState("");
  const [keyError, setKeyError] = useState("");
  const [isCheckingKey, setIsCheckingKey] = useState(false);
  const [isKeyAvailable, setIsKeyAvailable] = useState<boolean | null>(null);
  const [isKeyManuallyEdited, setIsKeyManuallyEdited] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Fetch projects via TanStack Query
  const { data: projects = [], isLoading, error: queryError } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: getProjects,
  });

  // Create project mutation
  const createMutation = useMutation({
    mutationFn: ({ name, key, description }: { name: string; key: string; description?: string }) =>
      createProject(name, key, description),
    onSuccess: (newProj) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setIsDialogOpen(false);
      setNewProjectName("");
      setNewProjectKey("");
      setNewProjectDesc("");
      setCreateError("");
      setKeyError("");
      setIsKeyAvailable(null);
      setIsKeyManuallyEdited(false);
      // Navigate to the newly created project tab
      router.push(`/projects/${newProj.id}?tab=issues`);
    },
    onError: (err: Error) => {
      setCreateError(err.message || "Gagal membuat proyek baru.");
    },
  });

  const generateKeyFromName = (name: string): string => {
    const cleaned = name.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    let base = cleaned;
    if (base.length > 0 && !/^[A-Z]/.test(base)) {
      base = "P" + base;
    }
    let key = base.substring(0, 5);
    while (key.length > 0 && key.length < 5) {
      key += "X";
    }
    return key;
  };

  const handleNameChange = (val: string) => {
    setNewProjectName(val);
    if (!isKeyManuallyEdited) {
      const suggestedKey = generateKeyFromName(val);
      setNewProjectKey(suggestedKey);
      
      if (suggestedKey.length > 0 && !/^[A-Z][A-Z0-9_-]{1,9}$/.test(suggestedKey)) {
        setKeyError("Kode proyek harus alfanumerik (dapat berisi - atau _), 2-10 karakter, dan diawali dengan huruf.");
      } else {
        setKeyError("");
      }
      setIsKeyAvailable(null);
    }
  };

  const checkKeyUniqueness = async (keyToCheck: string) => {
    if (!/^[A-Z][A-Z0-9_-]{1,9}$/.test(keyToCheck)) {
      setKeyError("Kode proyek harus alfanumerik (dapat berisi - atau _), 2-10 karakter, dan diawali dengan huruf.");
      setIsKeyAvailable(false);
      return;
    }
    setIsCheckingKey(true);
    try {
      const res = await checkProjectKey(keyToCheck);
      setIsKeyAvailable(res.available);
      if (!res.available) {
        setKeyError("Kode Proyek sudah digunakan.");
      } else {
        setKeyError("");
      }
    } catch (err) {
      console.error("Error checking key uniqueness:", err);
    } finally {
      setIsCheckingKey(false);
    }
  };

  const handleKeyChange = (val: string) => {
    setIsKeyManuallyEdited(true);
    const cleaned = val.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    setNewProjectKey(cleaned.substring(0, 10));
    setIsKeyAvailable(null);

    if (cleaned.length > 0 && !/^[A-Z][A-Z0-9_-]{1,9}$/.test(cleaned)) {
      setKeyError("Kode proyek harus alfanumerik (dapat berisi - atau _), 2-10 karakter, dan diawali dengan huruf.");
    } else {
      setKeyError("");
    }
  };

  const handleKeyBlur = () => {
    if (newProjectKey) {
      checkKeyUniqueness(newProjectKey);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !newProjectKey.trim() || keyError) return;
    createMutation.mutate({
      name: newProjectName.trim(),
      key: newProjectKey.trim(),
      description: newProjectDesc.trim() || undefined,
    });
  };

  const handleSelectProject = (projectId: string) => {
    let lastTab = "issues";
    if (typeof window !== "undefined") {
      lastTab = localStorage.getItem(`trackflow:last-tab:${projectId}`) || "issues";
    }
    router.push(`/projects/${projectId}?tab=${lastTab}`);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Premium CTA Banner */}
      <div className="rounded-lg border border-border bg-gradient-to-r from-accent/40 via-accent/15 to-transparent p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[17px] font-bold text-foreground">Pilih atau buat proyek untuk mulai</h1>
          <p className="text-[12.5px] text-muted-foreground mt-1 max-w-xl">
            Untuk mulai menggunakan menu-menu seperti Issues, Time Book, dan Settings di sidebar, silakan pilih salah satu proyek di bawah ini atau buat proyek baru.
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mt-2">
        <div>
          <h2 className="text-[16px] font-semibold text-foreground">Proyek Kerja</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Daftar semua proyek kerja yang sedang Anda kelola atau ikuti.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 border border-border bg-card rounded-md px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm">
            <input
              type="checkbox"
              id="show-archived"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-input bg-card text-primary focus:ring-primary accent-primary cursor-pointer"
            />
            <label htmlFor="show-archived" className="cursor-pointer font-medium select-none text-[11px] whitespace-nowrap">
              Tampilkan Terarsip
            </label>
          </div>
          <Button
            size="sm"
            className="h-8 text-[12px] font-medium"
            onClick={() => {
              setCreateError("");
              setIsDialogOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Buat Proyek Baru
          </Button>
        </div>
      </div>

      {(queryError || createError) && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{queryError ? "Gagal memuat daftar proyek." : createError}</span>
        </div>
      )}

      {/* Projects Grid / Table */}
      {isLoading ? (
        <div className="flex h-36 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : projects.filter(p => showArchived || !p.archivedAt).length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
          <Folder className="h-8 w-8 text-muted-foreground/60 mb-2" strokeWidth={1.5} />
          <p className="text-[13px] font-medium text-foreground">Belum ada proyek</p>
          <p className="text-[11px] text-muted-foreground mt-1 max-w-[280px]">
            Buat proyek kerja baru untuk mulai memanage tiket dan mencatat waktu kerja.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] font-medium mt-3"
            onClick={() => setIsDialogOpen(true)}
          >
            Buat Proyek Pertama
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects
            .filter((project) => showArchived || !project.archivedAt)
            .map((project) => (
              <div
                key={project.id}
                onClick={() => handleSelectProject(project.id)}
                className={`flex flex-col justify-between rounded-lg border border-border bg-card p-4 hover:border-foreground/30 transition-all cursor-pointer group shadow-sm ${
                  project.archivedAt ? "opacity-60" : ""
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13.5px] font-semibold text-foreground truncate group-hover:text-primary transition-colors flex items-center gap-1.5">
                      {project.name}
                      {project.archivedAt && (
                        <span className="text-[9px] text-amber-500 font-normal bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/10">
                          Arsip
                        </span>
                      )}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                    {project.description || "Tidak ada deskripsi proyek."}
                  </p>
                </div>
                <div className="border-t border-border mt-3 pt-3 flex items-center justify-between">
                  <span className="text-[10.5px] text-muted-foreground">
                    Dibuat {new Date(project.createdAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric"
                    })}
                  </span>
                  {project.archivedAt ? (
                    <span className="text-[10px] rounded bg-amber-500/10 px-1.5 py-0.5 font-semibold text-amber-600 border border-amber-500/10 uppercase tracking-wider">
                      Archived
                    </span>
                  ) : (
                    <span className="text-[10px] rounded bg-emerald-500/10 px-1.5 py-0.5 font-semibold text-emerald-600 border border-emerald-500/10 uppercase tracking-wider">
                      Active
                    </span>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Create Project Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <form onSubmit={handleCreateSubmit}>
            <DialogHeader>
              <DialogTitle className="text-[14.5px] font-semibold">Buat Proyek Baru</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-3 py-4">
              {createError && (
                <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive leading-normal">
                  <AlertCircle className="h-3.5 w-3.5 mt-[1px] shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="proj-name" className="text-[11px] font-medium text-muted-foreground">
                  Nama Proyek
                </Label>
                <Input
                  id="proj-name"
                  type="text"
                  placeholder="Contoh: TrackFlow App"
                  className="h-8 text-[12.5px]"
                  value={newProjectName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  disabled={createMutation.isPending}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="proj-key" className="text-[11px] font-medium text-muted-foreground">
                    Kode Proyek (Project Key)
                  </Label>
                  {isCheckingKey && (
                    <span className="text-[10px] text-muted-foreground animate-pulse">Memeriksa...</span>
                  )}
                  {!isCheckingKey && isKeyAvailable === true && (
                    <span className="text-[10px] text-emerald-500 font-medium">Tersedia</span>
                  )}
                </div>
                <Input
                  id="proj-key"
                  type="text"
                  placeholder="Contoh: TRACK, MOB"
                  className={`h-8 text-[12.5px] uppercase ${keyError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  value={newProjectKey}
                  onChange={(e) => handleKeyChange(e.target.value)}
                  onBlur={handleKeyBlur}
                  required
                  disabled={createMutation.isPending}
                />
                {keyError && (
                  <span className="text-[10px] text-destructive mt-0.5">{keyError}</span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="proj-desc" className="text-[11px] font-medium text-muted-foreground">
                  Deskripsi Proyek (Opsional)
                </Label>
                <textarea
                  id="proj-desc"
                  placeholder="Tulis ringkasan singkat mengenai lingkup proyek ini..."
                  className="min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-[12.5px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  disabled={createMutation.isPending}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-8 text-[12px]"
                onClick={() => setIsDialogOpen(false)}
                disabled={createMutation.isPending}
              >
                Batal
              </Button>
              <Button
                type="submit"
                className="h-8 text-[12px]"
                disabled={createMutation.isPending || !newProjectName.trim()}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    Membuat...
                  </>
                ) : (
                  "Buat Proyek"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
