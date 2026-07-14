"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getProjectDetail, getSubProjects, createSubProject, Project } from "@/lib/projects-service";
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
  Briefcase,
  Layers,
  Calendar,
  CheckSquare,
  Clock,
  LineChart,
  Settings,
} from "lucide-react";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params?.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [subProjects, setSubProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create Sub-project Dialog state
  const [isSubDialogOpen, setIsSubDialogOpen] = useState(false);
  const [subName, setSubName] = useState("");
  const [subDesc, setSubDesc] = useState("");
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState("");

  const activeTab = searchParams.get("tab") || "issues";

  const loadProjectData = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError("");
      const pDetail = await getProjectDetail(projectId);
      setProject(pDetail);
      const subList = await getSubProjects(projectId);
      setSubProjects(subList);
    } catch (err) {
      setError("Gagal memuat detail proyek.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  const handleCreateSubProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subName.trim() || !projectId) return;

    setSubLoading(true);
    setSubError("");
    try {
      await createSubProject(projectId, subName, subDesc);
      setSubName("");
      setSubDesc("");
      setIsSubDialogOpen(false);
      // Reload sub-projects list
      const subList = await getSubProjects(projectId);
      setSubProjects(subList);
    } catch (err: any) {
      setSubError(err.message || "Gagal membuat sub-proyek.");
    } finally {
      setSubLoading(false);
    }
  };

  const handleTabChange = (val: string) => {
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
            <h1 className="text-[17px] font-semibold text-foreground tracking-tight">{project.name}</h1>
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

      {/* Tabs Menu */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full flex flex-col gap-4">
        <TabsList className="w-fit h-9 bg-muted/50 border border-border p-0.5 rounded-lg">
          <TabsTrigger value="issues" className="text-[12px] font-medium px-4 h-8 rounded-md flex items-center gap-1.5">
            <CheckSquare className="h-3.5 w-3.5" />
            Issues
          </TabsTrigger>
          <TabsTrigger value="timebook" className="text-[12px] font-medium px-4 h-8 rounded-md flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Time Book
          </TabsTrigger>
          <TabsTrigger value="reports" className="text-[12px] font-medium px-4 h-8 rounded-md flex items-center gap-1.5">
            <LineChart className="h-3.5 w-3.5" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-[12px] font-medium px-4 h-8 rounded-md flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Tab Empty/Placeholder states */}
        <TabsContent value="issues" className="mt-0">
          <div className="flex flex-col items-center justify-center border border-dashed border-border rounded-lg py-20 text-center bg-card/30">
            <CheckSquare className="h-8 w-8 text-muted-foreground/50 mb-2.5" />
            <p className="text-[13px] font-semibold text-foreground">Daftar Issues &amp; Tiket</p>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-[280px]">
              Slice fitur tiket akan dihubungkan di sini pada tahapan selanjutnya.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="timebook" className="mt-0">
          <div className="flex flex-col items-center justify-center border border-dashed border-border rounded-lg py-20 text-center bg-card/30">
            <Clock className="h-8 w-8 text-muted-foreground/50 mb-2.5" />
            <p className="text-[13px] font-semibold text-foreground">Time Tracking &amp; Screenshot</p>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-[280px]">
              Slice perekaman jam kerja dan aktivitas screenshot akan diintegrasikan di sini.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="mt-0">
          <div className="flex flex-col items-center justify-center border border-dashed border-border rounded-lg py-20 text-center bg-card/30">
            <LineChart className="h-8 w-8 text-muted-foreground/50 mb-2.5" />
            <p className="text-[13px] font-semibold text-foreground">Laporan Jam Kerja</p>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-[280px]">
              Slice pelaporan unduhan PDF/CSV akan ditampilkan di sini.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-0">
          <div className="flex flex-col items-center justify-center border border-dashed border-border rounded-lg py-20 text-center bg-card/30">
            <Settings className="h-8 w-8 text-muted-foreground/50 mb-2.5" />
            <p className="text-[13px] font-semibold text-foreground">Pengaturan Proyek &amp; Alur Kerja</p>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-[280px]">
              Slice konfigurasi status alur kerja, template tiket, dan anggota tim proyek.
            </p>
          </div>
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
                  onChange={(e) => setSubName(e.target.value)}
                  required
                  disabled={subLoading}
                />
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
                disabled={subLoading || !subName.trim()}
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
    </div>
  );
}
