"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProjectDetail, Project } from "@/lib/projects-service";
import { getSession } from "@/lib/auth-service";
import { getProjectMembers, ProjectMember } from "@/lib/issues-service";
import {
  getDocuments,
  requestUpload,
  confirmUpload,
  getDownloadUrl,
  deleteDocument,
} from "@/lib/documents-service";
import { useConfirm } from "@/components/ui/confirm-dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Plus,
  AlertCircle,
  FileText,
  FileSpreadsheet,
  FileImage,
  Archive,
  File,
  Download,
  Trash2,
  Upload,
  ArrowUpDown,
  ArrowLeft,
} from "lucide-react";
import { DocumentDto, DocumentCategory } from "@trackflow/shared-types";

export default function ProjectDocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;
  const confirm = useConfirm();

  // Load States
  const [project, setProject] = useState<Project | null>(null);
  const [session, setSession] = useState<any>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Sort State
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(null);

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(null);
  const [category, setCategory] = useState<DocumentCategory>("project_doc");
  const [description, setDescription] = useState("");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const loadData = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError("");
      const [projDetail, membersData, sessionData, docsList] = await Promise.all([
        getProjectDetail(projectId),
        getProjectMembers(projectId).catch(() => []),
        getSession().catch(() => null),
        getDocuments(projectId).catch(() => []),
      ]);
      setProject(projDetail);
      setMembers(membersData);
      setSession(sessionData);
      setDocuments(docsList);
    } catch (err) {
      setError("Gagal memuat data dokumen proyek.");
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

  // Format File Size
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Get Mime Icon
  const getFileIcon = (mimeType: string, fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    if (mimeType.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) {
      return <FileImage className="h-4 w-4 text-purple-500 shrink-0" />;
    }
    if (mimeType === "application/pdf" || ext === "pdf") {
      return <FileText className="h-4 w-4 text-red-500 shrink-0" />;
    }
    if (
      ["doc", "docx", "odt", "rtf"].includes(ext) ||
      mimeType.includes("word") ||
      mimeType.includes("officedocument.wordprocessing")
    ) {
      return <FileText className="h-4 w-4 text-blue-500 shrink-0" />;
    }
    if (
      ["xls", "xlsx", "csv", "ods"].includes(ext) ||
      mimeType.includes("excel") ||
      mimeType.includes("spreadsheet") ||
      mimeType.includes("officedocument.spreadsheet")
    ) {
      return <FileSpreadsheet className="h-4 w-4 text-green-500 shrink-0" />;
    }
    if (["zip", "rar", "tar", "gz", "7z"].includes(ext) || mimeType.includes("zip") || mimeType.includes("compressed")) {
      return <Archive className="h-4 w-4 text-amber-500 shrink-0" />;
    }
    return <File className="h-4 w-4 text-muted-foreground shrink-0" />;
  };

  // Get Category Visual Badges
  const getCategoryBadge = (cat: DocumentCategory) => {
    switch (cat) {
      case "project_doc":
        return (
          <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/30">
            Dokumen Proyek
          </span>
        );
      case "supporting_file":
        return (
          <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/30">
            File Pendukung
          </span>
        );
      case "third_party":
        return (
          <span className="inline-flex items-center rounded-full bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/30">
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

  // Drag-and-Drop Handles
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // Upload Logic
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError("Pilih berkas terlebih dahulu.");
      return;
    }

    try {
      setUploadLoading(true);
      setUploadError("");

      // 1. Dapatkan upload token presigned URL dari backend
      const { documentId, uploadUrl } = await requestUpload(projectId, {
        fileName: selectedFile.name,
        category,
        mimeType: selectedFile.type || "application/octet-stream",
        fileSizeBytes: selectedFile.size,
        description: description.trim() || undefined,
      });

      // 2. Upload file fisik langsung ke Cloudflare R2
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": selectedFile.type || "application/octet-stream",
        },
        body: selectedFile,
      });

      if (!uploadRes.ok) {
        throw new Error("Gagal mengunggah file ke server penyimpanan cloud.");
      }

      // 3. Konfirmasi upload selesai ke backend
      await confirmUpload(projectId, documentId);

      // Refresh list dan tutup modal
      await loadData();
      setIsUploadOpen(false);
      setSelectedFile(null);
      setDescription("");
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || "Gagal mengunggah berkas.");
    } finally {
      setUploadLoading(false);
    }
  };

  // Download Logic
  const handleDownload = async (docId: string, fileName: string) => {
    try {
      const downloadUrl = await getDownloadUrl(projectId, docId);
      
      // Buka URL download atau buat element link sementara untuk men-download
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", fileName);
      // Agar browser mengarahkannya sebagai download
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error(err);
      await confirm({
        title: "Download Gagal",
        description: err.message || "Gagal mendapatkan tautan unduhan.",
        confirmLabel: "Tutup",
        cancelLabel: "",
        variant: "destructive",
      });
    }
  };

  // Delete Logic
  const handleDelete = async (docId: string, fileName: string) => {
    const ok = await confirm({
      title: "Hapus Dokumen",
      description: `Apakah Anda yakin ingin menghapus berkas "${fileName}"? Tindakan ini permanen.`,
      confirmLabel: "Ya, Hapus",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      await deleteDocument(projectId, docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err: any) {
      console.error(err);
      await confirm({
        title: "Gagal Menghapus",
        description: err.message || "Anda tidak memiliki hak akses untuk menghapus dokumen ini.",
        confirmLabel: "Tutup",
        cancelLabel: "",
        variant: "destructive",
      });
    }
  };

  // Check Role Permissions
  const userRole = members.find((m) => m.id === session?.user?.id)?.role;
  const isAllowedToUpload = session?.user?.isAdmin || userRole === "manager" || userRole === "developer";

  const isAllowedToDelete = (doc: DocumentDto) => {
    if (session?.user?.isAdmin || userRole === "manager") return true;
    if (userRole === "developer" && doc.uploadedBy === session?.user?.id) return true;
    return false;
  };

  // Native Column Sorting (by category)
  const handleSortCategory = () => {
    if (sortDirection === null) {
      setSortDirection("asc");
    } else if (sortDirection === "asc") {
      setSortDirection("desc");
    } else {
      setSortDirection(null);
    }
  };

  const sortedDocuments = React.useMemo(() => {
    if (!sortDirection) return documents;

    return [...documents].sort((a, b) => {
      const catA = a.category.toLowerCase();
      const catB = b.category.toLowerCase();
      if (catA < catB) return sortDirection === "asc" ? -1 : 1;
      if (catA > catB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [documents, sortDirection]);

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

  const isLargeFile = selectedFile && selectedFile.size > 50 * 1024 * 1024;

  return (
    <div className="p-6 max-w-6xl mx-auto flex flex-col gap-6">
      {/* Header / Breadcrumb */}
      <div className="flex flex-col gap-1.5">
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground w-fit transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          KEMBALI KE DETAIL PROYEK
        </button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 border border-primary/20 text-primary font-bold text-[12px] uppercase">
              {project.name[0]}
            </span>
            <h1 className="text-[17px] font-semibold text-foreground tracking-tight">
              Dokumen &amp; Berkas — {project.name}
            </h1>
          </div>
          {isAllowedToUpload && (
            <Button
              onClick={() => {
                setUploadError("");
                setSelectedFile(null);
                setDescription("");
                setIsUploadOpen(true);
              }}
              size="sm"
              className="h-8 text-[11px] font-semibold flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Upload Dokumen
            </Button>
          )}
        </div>
      </div>

      {/* Main List */}
      <div className="border border-border rounded-lg bg-card overflow-hidden shadow-sm">
        {sortedDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <File className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <h3 className="text-[13px] font-semibold text-foreground">Belum ada dokumen</h3>
            <p className="text-[11.5px] text-muted-foreground mt-1 max-w-[280px]">
              {isAllowedToUpload
                ? "Unggah panduan aplikasi, berkas pendukung, atau kontrak pihak ketiga untuk proyek ini."
                : "Belum ada dokumen yang diunggah untuk proyek ini."}
            </p>
            {isAllowedToUpload && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsUploadOpen(true)}
                className="h-7.5 text-[11px] font-medium mt-3"
              >
                Upload Pertama
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[11px] font-bold text-muted-foreground py-2 h-9 w-[40%]">
                  NAMA FILE
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
                <TableHead className="text-[11px] font-bold text-muted-foreground py-2 h-9">
                  UPLOADER
                </TableHead>
                <TableHead className="text-[11px] font-bold text-muted-foreground py-2 h-9">
                  TANGGAL
                </TableHead>
                <TableHead className="text-[11px] font-bold text-muted-foreground py-2 h-9 text-right">
                  UKURAN
                </TableHead>
                <TableHead className="text-[11px] font-bold text-muted-foreground py-2 h-9 w-[10%] text-center">
                  AKSI
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedDocuments.map((doc) => (
                <TableRow key={doc.id} className="hover:bg-muted/30 group">
                  <TableCell className="py-2.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="mt-0.5">{getFileIcon(doc.mimeType, doc.fileName)}</div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[12.5px] font-medium text-foreground truncate max-w-[280px]">
                          {doc.fileName}
                        </span>
                        {doc.description && (
                          <span className="text-[10.5px] text-muted-foreground truncate max-w-[280px] mt-0.5">
                            {doc.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5">{getCategoryBadge(doc.category)}</TableCell>
                  <TableCell className="py-2.5 text-[12px] text-foreground">{doc.uploadedByName}</TableCell>
                  <TableCell className="py-2.5 text-[12px] text-muted-foreground">
                    {new Date(doc.uploadedAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="py-2.5 text-[12px] text-foreground text-right">
                    {formatBytes(doc.fileSizeBytes)}
                  </TableCell>
                  <TableCell className="py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownload(doc.id, doc.fileName)}
                        className="h-6 w-6 rounded hover:bg-muted hover:text-foreground text-muted-foreground shrink-0"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      {isAllowedToDelete(doc) ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(doc.id, doc.fileName)}
                          className="h-6 w-6 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <div className="h-6 w-6 shrink-0" />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Upload Document Modal */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <form onSubmit={handleUploadSubmit}>
            <DialogHeader>
              <DialogTitle className="text-[14px] font-semibold">Upload Dokumen Baru</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-4">
              {uploadError && (
                <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive leading-normal">
                  <AlertCircle className="h-3.5 w-3.5 mt-[1px] shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Drag & Drop File Upload Area */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] font-medium text-muted-foreground">Pilih Berkas</Label>
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-5 flex flex-col items-center justify-center cursor-pointer transition-colors relative ${
                    dragActive
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/30"
                  }`}
                >
                  <input
                    type="file"
                    id="file-upload"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={handleFileInputChange}
                    disabled={uploadLoading}
                  />
                  <Upload className="h-6 w-6 text-muted-foreground/60 mb-2" />
                  {selectedFile ? (
                    <div className="text-center min-w-0 px-2">
                      <p className="text-[12px] font-semibold text-foreground truncate max-w-[260px]">
                        {selectedFile.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatBytes(selectedFile.size)}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-[12px] font-medium text-foreground">
                        Tarik &amp; lepas berkas di sini, atau klik untuk memilih
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Rekomendasi ukuran maksimal 50MB
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Soft warning for size >50MB */}
              {isLargeFile && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-700 dark:text-amber-400 leading-normal">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-[1px]" />
                  <div>
                    <span className="font-semibold">Ukuran File Besar:</span> File ini berukuran{" "}
                    <strong>{formatBytes(selectedFile!.size)}</strong>. Disarankan untuk menggunakan link eksternal (Google Drive/Dropbox) di dalam deskripsi untuk menghindari upload file besar ke server R2.
                  </div>
                </div>
              )}

              {/* Category selector */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="doc-category" className="text-[11px] font-medium text-muted-foreground">
                  Tipe Dokumen
                </Label>
                <Select
                  value={category}
                  onValueChange={(val: any) => setCategory(val)}
                  disabled={uploadLoading}
                >
                  <SelectTrigger id="doc-category" className="w-full h-8 text-[12px] rounded-md">
                    <SelectValue placeholder="Pilih tipe dokumen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem className="text-[12px]" value="project_doc">
                      Dokumen Proyek (Panduan, Spesifikasi)
                    </SelectItem>
                    <SelectItem className="text-[12px]" value="supporting_file">
                      File Pendukung Aplikasi (Asset, Config)
                    </SelectItem>
                    <SelectItem className="text-[12px]" value="third_party">
                      Pihak Ketiga (Kontrak, Vendor API)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="doc-desc" className="text-[11px] font-medium text-muted-foreground">
                  Keterangan Singkat (Opsional)
                </Label>
                <textarea
                  id="doc-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Keterangan mengenai berkas ini..."
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-[12px] shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={uploadLoading}
                />
              </div>
            </div>

            <DialogFooter className="border-t border-border pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-[11px] font-medium"
                onClick={() => setIsUploadOpen(false)}
                disabled={uploadLoading}
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-8 text-[11px] font-semibold"
                disabled={uploadLoading || !selectedFile}
              >
                {uploadLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" stroke="currentColor" />
                    Mengunggah...
                  </>
                ) : (
                  "Mulai Upload"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
