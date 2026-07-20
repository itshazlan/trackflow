"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProjectDetail, Project } from "@/lib/projects-service";
import { getSession } from "@/lib/auth-service";
import { getProjectMembers, ProjectMember } from "@/lib/issues-service";
import {
  getDocuments,
  createDocumentContainer,
} from "@/lib/documents-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  AlertCircle,
  Folder,
  ArrowLeft,
  ArrowUpDown,
  FileText,
} from "lucide-react";
import {
  DocumentContainerDto,
  DocumentCategory,
} from "@trackflow/shared-types";

export default function ProjectDocumentsListPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;

  // Load States
  const [project, setProject] = useState<Project | null>(null);
  const [session, setSession] = useState<any>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [containers, setContainers] = useState<DocumentContainerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Sort State
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(null);

  // Dialog State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("project_doc");
  const [description, setDescription] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  const loadData = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError("");
      const [projDetail, membersData, sessionData, docsRes] = await Promise.all([
        getProjectDetail(projectId),
        getProjectMembers(projectId).catch(() => []),
        getSession().catch(() => null),
        getDocuments(projectId, 1, 100).catch(() => ({ data: [], pagination: { total: 0, page: 1, limit: 100 } })),
      ]);
      setProject(projDetail);
      setMembers(membersData);
      setSession(sessionData);
      setContainers(docsRes.data);
    } catch (err) {
      setError("Gagal memuat daftar dokumen.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        void loadData();
      }
    });
    return () => {
      active = false;
    };
  }, [loadData]);

  // Dialog Submission
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setCreateError("Judul dokumen harus diisi.");
      return;
    }

    try {
      setCreateLoading(true);
      setCreateError("");
      const newDoc = await createDocumentContainer(projectId, {
        title: title.trim(),
        category,
        description: description.trim() || undefined,
      });

      setIsCreateOpen(false);
      setTitle("");
      setDescription("");
      
      // Redirect straight to detail page of the new document container
      router.push(`/projects/${projectId}/documents/${newDoc.id}`);
    } catch (err: any) {
      console.error(err);
      setCreateError(err.message || "Gagal membuat dokumen baru.");
    } finally {
      setCreateLoading(false);
    }
  };

  // Category Badges helper
  const getCategoryBadge = (cat: DocumentCategory) => {
    switch (cat) {
      case "project_doc":
        return (
          <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/30">
            Dokumen Proyek
          </span>
        );
      case "supporting_file":
        return (
          <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-900/30 px-2.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/30">
            File Pendukung
          </span>
        );
      case "third_party":
        return (
          <span className="inline-flex items-center rounded-full bg-purple-50 dark:bg-purple-900/30 px-2.5 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/30">
            Pihak Ketiga
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            Lainnya
          </span>
        );
    }
  };

  const handleSortCategory = () => {
    if (sortDirection === null) {
      setSortDirection("asc");
    } else if (sortDirection === "asc") {
      setSortDirection("desc");
    } else {
      setSortDirection(null);
    }
  };

  const sortedContainers = React.useMemo(() => {
    if (!sortDirection) return containers;
    return [...containers].sort((a, b) => {
      const catA = a.category.toLowerCase();
      const catB = b.category.toLowerCase();
      if (catA < catB) return sortDirection === "asc" ? -1 : 1;
      if (catA > catB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [containers, sortDirection]);

  // Auth Roles Check
  const userRole = members.find((m) => m.id === session?.user?.id)?.role;
  const isAllowedToCreate = session?.user?.isAdmin || userRole === "manager" || userRole === "developer";

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
      {/* Header */}
      <div className="flex flex-col gap-1.5 shrink-0">
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground w-fit transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          KEMBALI KE DETAIL PROYEK
        </button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 border border-primary/20 text-primary font-bold text-[10px] uppercase">
              {project.name[0]}
            </span>
            <h1 className="text-[15px] font-semibold text-foreground tracking-tight">
              Dokumen &amp; Berkas — {project.name}
            </h1>
          </div>
          {isAllowedToCreate && (
            <Button
              onClick={() => {
                setCreateError("");
                setTitle("");
                setDescription("");
                setCategory("project_doc");
                setIsCreateOpen(true);
              }}
              size="sm"
              className="h-8 text-[11px] font-semibold flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              New Document
            </Button>
          )}
        </div>
      </div>

      {/* Main List */}
      <div className="border border-border rounded-lg bg-card overflow-hidden shadow-sm">
        {sortedContainers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Folder className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <h3 className="text-[13px] font-semibold text-foreground">Belum ada dokumen</h3>
            <p className="text-[11.5px] text-muted-foreground mt-1 max-w-[320px]">
              {isAllowedToCreate
                ? "Buat kontainer dokumen baru untuk menyimpan dan mengelola berkas tim Anda."
                : "Belum ada dokumen yang diunggah untuk proyek ini."}
            </p>
            {isAllowedToCreate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                className="h-7.5 text-[11px] font-medium mt-3"
              >
                Buat Pertama
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[11px] font-bold text-muted-foreground py-2 h-9 w-[40%]">
                  NAMA DOKUMEN
                </TableHead>
                <TableHead
                  onClick={handleSortCategory}
                  className="text-[11px] font-bold text-muted-foreground py-2 h-9 cursor-pointer hover:bg-muted/70 transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    KATEGORI
                    <ArrowUpDown className="h-3 w-3 text-muted-foreground/60" />
                  </div>
                </TableHead>
                <TableHead className="text-[11px] font-bold text-muted-foreground py-2 h-9 text-center">
                  JUMLAH BERKAS
                </TableHead>
                <TableHead className="text-[11px] font-bold text-muted-foreground py-2 h-9">
                  AUTHOR
                </TableHead>
                <TableHead className="text-[11px] font-bold text-muted-foreground py-2 h-9 text-right">
                  TANGGAL DIBUAT
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedContainers.map((doc) => (
                <TableRow
                  key={doc.id}
                  onClick={() => router.push(`/projects/${projectId}/documents/${doc.id}`)}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <TableCell className="py-2.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <Folder className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[12.5px] font-semibold text-foreground truncate max-w-[320px]">
                          {doc.title}
                        </span>
                        {doc.description && (
                          <span className="text-[10.5px] text-muted-foreground truncate max-w-[320px] mt-0.5">
                            {doc.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5">{getCategoryBadge(doc.category)}</TableCell>
                  <TableCell className="py-2.5 text-[12px] text-foreground text-center">
                    {doc.fileCount} {doc.fileCount === 1 ? "file" : "files"}
                  </TableCell>
                  <TableCell className="py-2.5 text-[12px] text-foreground">
                    {doc.createdBy?.name || "Unknown"}
                  </TableCell>
                  <TableCell className="py-2.5 text-[12px] text-muted-foreground text-right">
                    {new Date(doc.createdAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Dialog: Create Document */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <form onSubmit={handleCreateSubmit}>
            <DialogHeader>
              <DialogTitle className="text-[13.5px] font-bold">New Document</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-4">
              {createError && (
                <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive leading-normal">
                  <AlertCircle className="h-3.5 w-3.5 mt-[1px] shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="doc-title" className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Title
                </Label>
                <Input
                  id="doc-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Dokumen Spesifikasi Desain"
                  disabled={createLoading}
                  className="h-8 text-[12px]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="doc-category" className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Category
                </Label>
                <select
                  id="doc-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                  className="w-full h-8 rounded-md border border-input bg-card px-2.5 text-[12px] text-foreground outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={createLoading}
                >
                  <option value="project_doc">
                    Dokumen Proyek (Panduan, Spesifikasi)
                  </option>
                  <option value="supporting_file">
                    File Pendukung Aplikasi (Asset, Config)
                  </option>
                  <option value="third_party">
                    Pihak Ketiga (Kontrak, Vendor API)
                  </option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="doc-desc" className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Description
                </Label>
                <textarea
                  id="doc-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Keterangan singkat mengenai dokumen ini..."
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-[12px] shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={createLoading}
                />
              </div>
            </div>

            <DialogFooter className="border-t border-border pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-[11px] font-medium"
                onClick={() => setIsCreateOpen(false)}
                disabled={createLoading}
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-8 text-[11px] font-semibold"
                disabled={createLoading || !title.trim()}
              >
                {createLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Membuat...
                  </>
                ) : (
                  "Buat Dokumen"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
