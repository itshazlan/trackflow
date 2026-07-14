"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getProjects, createProject, Project } from "@/lib/projects-service";
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  const loadProjects = async () => {
    try {
      setLoading(true);
      const plist = await getProjects();
      setProjects(plist);
    } catch (err) {
      setError("Gagal memuat daftar proyek.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setCreateLoading(true);
    setCreateError("");
    try {
      await createProject(newProjectName, newProjectDesc);
      setNewProjectName("");
      setNewProjectDesc("");
      setIsDialogOpen(false);
      // Reload projects list
      await loadProjects();
    } catch (err: any) {
      setCreateError(err.message || "Gagal membuat proyek baru.");
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-semibold text-foreground">Proyek Kerja</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Daftar semua proyek aktif yang sedang Anda kelola atau ikuti.
          </p>
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

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Projects Grid / Table */}
      {loading ? (
        <div className="flex h-36 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : projects.length === 0 ? (
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
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => router.push(`/projects/${project.id}`)}
              className="flex flex-col justify-between rounded-lg border border-border bg-card p-4 hover:border-foreground/30 transition-all cursor-pointer group shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13.5px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {project.name}
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
                <span className="text-[10px] rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground uppercase tracking-wider">
                  Active
                </span>
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
                  onChange={(e) => setNewProjectName(e.target.value)}
                  required
                  disabled={createLoading}
                />
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
                  disabled={createLoading}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-8 text-[12px]"
                onClick={() => setIsDialogOpen(false)}
                disabled={createLoading}
              >
                Batal
              </Button>
              <Button
                type="submit"
                className="h-8 text-[12px]"
                disabled={createLoading || !newProjectName.trim()}
              >
                {createLoading ? (
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
