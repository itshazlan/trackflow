"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProjectDetail, Project } from "@/lib/projects-service";
import { getSession } from "@/lib/auth-service";
import { getProjectMembers, ProjectMember } from "@/lib/issues-service";
import {
  getDocumentContainerDetail,
  updateDocumentContainer,
  deleteDocumentContainer,
  requestFileUpload,
  confirmFileUpload,
  getFileDownloadUrl,
  deleteFile,
} from "@/lib/documents-service";
import { useConfirm } from "@/components/ui/confirm-dialog";
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
  AlertCircle,
  FileText,
  FileSpreadsheet,
  FileImage,
  Archive,
  File,
  Download,
  Trash2,
  ArrowLeft,
  Edit2,
  Calendar,
  User,
  Plus,
} from "lucide-react";
import {
  DocumentFileDto,
  DocumentDetailDto,
  DocumentCategory,
} from "@trackflow/shared-types";

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;
  const documentId = params?.documentId as string;
  const confirm = useConfirm();

  // Load States
  const [project, setProject] = useState<Project | null>(null);
  const [session, setSession] = useState<any>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [detail, setDetail] = useState<DocumentDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Gallery Pre-Signed URLs State
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState<DocumentCategory>("project_doc");
  const [editDescription, setEditDescription] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // File Upload State
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Full-Screen Image Modal State
  const [previewImage, setPreviewImage] = useState<{ src: string; name: string } | null>(null);

  // Helper to fetch presigned urls for all images in files array
  const fetchImageUrls = useCallback(async (files: DocumentFileDto[]) => {
    const imgFiles = files.filter((f) => f.isImage);
    const urlMap: Record<string, string> = {};
    await Promise.all(
      imgFiles.map(async (img) => {
        try {
          const downloadUrl = await getFileDownloadUrl(projectId, documentId, img.id);
          urlMap[img.id] = downloadUrl;
        } catch (err) {
          console.error("Gagal mengambil link preview gambar:", err);
        }
      })
    );
    setImageUrls(urlMap);
  }, [projectId, documentId]);

  // Fetch all details
  const loadDetailData = useCallback(async () => {
    if (!projectId || !documentId) return;
    try {
      setLoading(true);
      setError("");
      const [projDetail, membersData, sessionData, detailData] = await Promise.all([
        getProjectDetail(projectId),
        getProjectMembers(projectId).catch(() => []),
        getSession().catch(() => null),
        getDocumentContainerDetail(projectId, documentId),
      ]);
      setProject(projDetail);
      setMembers(membersData);
      setSession(sessionData);
      setDetail(detailData);
      
      // Initialize edit fields
      setEditTitle(detailData.title);
      setEditCategory(detailData.category);
      setEditDescription(detailData.description || "");

      // Resolve presigned urls for images
      void fetchImageUrls(detailData.files);
    } catch (err: any) {
      setError(err.message || "Gagal memuat detail dokumen.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId, documentId, fetchImageUrls]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        void loadDetailData();
      }
    });
    return () => {
      active = false;
    };
  }, [loadDetailData]);

  // Helpers
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const cleanFileName = (name: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i;
    return name.replace(uuidRegex, "");
  };

  const getFileIcon = (mimeType: string, fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    if (mimeType.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) {
      return <FileImage className="h-4 w-4 text-purple-500 shrink-0" />;
    }
    if (mimeType === "application/pdf" || ext === "pdf") {
      return <FileText className="h-4 w-4 text-red-500 shrink-0" />;
    }
    if (["doc", "docx", "odt", "rtf"].includes(ext) || mimeType.includes("word")) {
      return <FileText className="h-4 w-4 text-blue-500 shrink-0" />;
    }
    if (["xls", "xlsx", "csv", "ods"].includes(ext) || mimeType.includes("excel") || mimeType.includes("spreadsheet")) {
      return <FileSpreadsheet className="h-4 w-4 text-green-500 shrink-0" />;
    }
    if (["zip", "rar", "tar", "gz", "7z"].includes(ext) || mimeType.includes("zip")) {
      return <Archive className="h-4 w-4 text-amber-500 shrink-0" />;
    }
    return <File className="h-4 w-4 text-muted-foreground shrink-0" />;
  };

  const getCategoryLabel = (cat: DocumentCategory) => {
    switch (cat) {
      case "project_doc":
        return "Dokumen Proyek";
      case "supporting_file":
        return "File Pendukung";
      case "third_party":
        return "Pihak Ketiga";
      default:
        return "Lainnya";
    }
  };

  // Edit / Delete Container
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) {
      setEditError("Judul dokumen harus diisi.");
      return;
    }
    try {
      setEditLoading(true);
      setEditError("");
      await updateDocumentContainer(projectId, documentId, {
        title: editTitle.trim(),
        category: editCategory,
        description: editDescription.trim() || null,
      });
      setIsEditOpen(false);
      // Reload details
      const updatedDetail = await getDocumentContainerDetail(projectId, documentId);
      setDetail(updatedDetail);
    } catch (err: any) {
      setEditError(err.message || "Gagal memperbarui dokumen.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteContainer = async () => {
    if (!detail) return;
    const ok = await confirm({
      title: "Hapus Dokumen",
      description: `Apakah Anda yakin ingin menghapus "${detail.title}" beserta seluruh file di dalamnya? Tindakan ini tidak dapat dibatalkan.`,
      confirmLabel: "Hapus Dokumen",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      setLoading(true);
      await deleteDocumentContainer(projectId, documentId);
      router.push(`/projects/${projectId}/documents`);
    } catch (err: any) {
      console.error(err);
      setLoading(false);
      await confirm({
        title: "Gagal Menghapus",
        description: err.message || "Gagal menghapus dokumen.",
        confirmLabel: "Tutup",
        cancelLabel: "",
        variant: "destructive",
      });
    }
  };

  // Multiple File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      try {
        setUploadLoading(true);
        setUploadError("");

        for (let i = 0; i < e.target.files.length; i++) {
          const file = e.target.files[i];

          // 1. Request presigned upload URL
          const { fileId, uploadUrl } = await requestFileUpload(projectId, documentId, {
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            fileSizeBytes: file.size,
          });

          // 2. Direct PUT upload to R2
          const uploadRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Type": file.type || "application/octet-stream",
            },
            body: file,
          });

          if (!uploadRes.ok) {
            throw new Error(`Gagal mengunggah file "${file.name}"`);
          }

          // 3. Confirm upload
          await confirmFileUpload(projectId, documentId, fileId);
        }

        // Refresh details
        const updatedDetail = await getDocumentContainerDetail(projectId, documentId);
        setDetail(updatedDetail);
        void fetchImageUrls(updatedDetail.files);
      } catch (err: any) {
        console.error(err);
        setUploadError(err.message || "Gagal mengunggah file.");
      } finally {
        setUploadLoading(false);
      }
    }
  };

  // Download & Delete Files
  const handleFileDownload = async (fileId: string, fileName: string) => {
    try {
      const downloadUrl = await getFileDownloadUrl(projectId, documentId, fileId);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", fileName);
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error(err);
      await confirm({
        title: "Download Gagal",
        description: err.message || "Gagal mengunduh file.",
        confirmLabel: "Tutup",
        cancelLabel: "",
        variant: "destructive",
      });
    }
  };

  const handleFileDelete = async (fileId: string, fileName: string) => {
    const ok = await confirm({
      title: "Hapus File",
      description: `Apakah Anda yakin ingin menghapus file "${fileName}"? Tindakan ini tidak dapat dibatalkan.`,
      confirmLabel: "Hapus File",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      setLoading(true);
      await deleteFile(projectId, documentId, fileId);
      const updatedDetail = await getDocumentContainerDetail(projectId, documentId);
      setDetail(updatedDetail);
      void fetchImageUrls(updatedDetail.files);
    } catch (err: any) {
      console.error(err);
      await confirm({
        title: "Gagal Menghapus File",
        description: err.message || "Gagal menghapus file.",
        confirmLabel: "Tutup",
        cancelLabel: "",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Thumbnail Click Handler
  const handleThumbnailClick = (fileId: string, fileName: string) => {
    const imageUrl = imageUrls[fileId];
    if (imageUrl) {
      setPreviewImage({ src: imageUrl, name: fileName });
    }
  };

  // Roles Check
  const userRole = members.find((m) => m.id === session?.user?.id)?.role;
  const isAllowedToUpload = session?.user?.isAdmin || userRole === "manager" || userRole === "developer";
  
  const isAllowedToDeleteContainer = (createdBy: string) => {
    if (session?.user?.isAdmin || userRole === "manager") return true;
    return createdBy === session?.user?.id;
  };

  const isAllowedToDeleteFile = (uploadedBy: string) => {
    if (session?.user?.isAdmin || userRole === "manager") return true;
    return uploadedBy === session?.user?.id;
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !project || !detail) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error || "Dokumen tidak ditemukan."}</span>
        </div>
        <Button variant="outline" className="h-8 text-[12px] mt-4" onClick={() => router.push(`/projects/${projectId}/documents`)}>
          Kembali ke Daftar Dokumen
        </Button>
      </div>
    );
  }

  // Filter image files for the gallery
  const imageFiles = detail.files.filter((f) => f.isImage);

  return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col gap-6">
      {/* Breadcrumb Back */}
      <button
        onClick={() => router.push(`/projects/${projectId}/documents`)}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground w-fit transition-colors"
      >
        <ArrowLeft className="h-3 w-3" />
        KEMBALI KE DOKUMEN PROYEK
      </button>

      {/* Header Info */}
      <div className="flex items-start justify-between gap-6 border-b border-border pb-5">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[17px] font-bold text-foreground tracking-tight">
              {detail.title}
            </h1>
            <span className="inline-flex items-center rounded bg-muted border border-border px-1.5 py-0.5 text-[9.5px] font-medium text-muted-foreground uppercase">
              {getCategoryLabel(detail.category)}
            </span>
          </div>
          {detail.description && (
            <p className="text-[12.5px] text-muted-foreground leading-relaxed mt-1">
              {detail.description}
            </p>
          )}
          <div className="flex items-center gap-3 text-[10.5px] text-muted-foreground mt-3">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              Dibuat oleh: <strong>{detail.createdBy.name}</strong>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(detail.createdAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* Edit/Delete Actions in Top Right */}
        {isAllowedToDeleteContainer(detail.createdBy.id) && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => setIsEditOpen(true)}
              variant="outline"
              size="sm"
              className="h-8 text-[11px] font-semibold flex items-center gap-1.5"
            >
              <Edit2 className="h-3 w-3" />
              Edit Info
            </Button>
            <Button
              onClick={handleDeleteContainer}
              variant="outline"
              size="sm"
              className="h-8 text-[11px] font-semibold text-destructive hover:bg-destructive/5 hover:text-destructive flex items-center gap-1.5"
            >
              <Trash2 className="h-3 w-3" />
              Hapus Dokumen
            </Button>
          </div>
        )}
      </div>

      {/* Files Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
            Files ({detail.files.length})
          </h2>
        </div>

        {uploadError && (
          <div className="flex items-start gap-2.5 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-[1px]" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Files list */}
        {detail.files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-lg text-center text-muted-foreground bg-muted/5">
            <File className="h-7 w-7 text-muted-foreground/30 mb-2" />
            <p className="text-[12px]">Belum ada berkas di dalam dokumen ini.</p>
            {isAllowedToUpload && (
              <p className="text-[11px] text-muted-foreground/75 mt-0.5">
                Gunakan tombol di bawah list untuk mulai menambahkan file.
              </p>
            )}
          </div>
        ) : (
          <div className="border border-border rounded-lg bg-card overflow-hidden shadow-sm">
            <div className="divide-y divide-border">
              {detail.files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between gap-3 p-3 hover:bg-muted/30 group transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {getFileIcon(file.mimeType, file.fileName)}
                    <div className="flex flex-col min-w-0">
                      <span className="text-[12.5px] font-medium text-foreground truncate max-w-[360px] md:max-w-[480px]">
                        {cleanFileName(file.fileName)}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>{formatBytes(file.fileSizeBytes)}</span>
                        <span>•</span>
                        <span>Diunggah oleh: <strong>{file.uploadedBy.name}</strong></span>
                        <span>•</span>
                        <span>
                          {new Date(file.uploadedAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleFileDownload(file.id, file.fileName)}
                      className="h-7 w-7 rounded text-muted-foreground hover:text-foreground border border-transparent hover:border-border"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    {isAllowedToDeleteFile(file.uploadedBy.id) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleFileDelete(file.id, file.fileName)}
                        className="h-7 w-7 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/5 opacity-0 group-hover:opacity-100 transition-opacity border border-transparent hover:border-border"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gallery Thumbnail Grid (Images Only) */}
        {imageFiles.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Galeri Gambar
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {imageFiles.map((img) => {
                const imageUrl = imageUrls[img.id];
                return (
                  <div
                    key={img.id}
                    onClick={() => handleThumbnailClick(img.id, img.fileName)}
                    className="aspect-square border border-border rounded-lg bg-muted/20 overflow-hidden relative cursor-pointer hover:border-primary/50 group transition-all duration-200 shadow-sm"
                  >
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={img.fileName}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-black/70 backdrop-blur-[2px] p-1.5 text-white truncate text-[9px] font-medium leading-none">
                      {cleanFileName(img.fileName)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upload Trigger Button (+ New File) */}
        {isAllowedToUpload && (
          <div className="mt-2 flex items-center justify-center">
            <div className="relative w-full">
              <input
                type="file"
                multiple
                id="direct-file-upload"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploadLoading}
              />
              <Button
                onClick={() => document.getElementById("direct-file-upload")?.click()}
                disabled={uploadLoading}
                variant="outline"
                className="w-full h-9 text-[11px] font-semibold border-dashed border-2 hover:border-primary/50 hover:bg-muted/10 flex items-center justify-center gap-1.5"
              >
                {uploadLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    Mengunggah berkas...
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    New File
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialog: Edit Document Metadata */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle className="text-[13.5px] font-bold">Edit Detail Dokumen</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-4">
              {editError && (
                <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive leading-normal">
                  <AlertCircle className="h-3.5 w-3.5 mt-[1px] shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-title" className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Title
                </Label>
                <Input
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Contoh: Dokumen Spesifikasi Desain"
                  disabled={editLoading}
                  className="h-8 text-[12px]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-category" className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Category
                </Label>
                <select
                  id="edit-category"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as DocumentCategory)}
                  className="w-full h-8 rounded-md border border-input bg-card px-2.5 text-[12px] text-foreground outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={editLoading}
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
                <Label htmlFor="edit-desc" className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Description
                </Label>
                <textarea
                  id="edit-desc"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Keterangan singkat mengenai dokumen ini..."
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-[12px] shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={editLoading}
                />
              </div>
            </div>

            <DialogFooter className="border-t border-border pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-[11px] font-medium"
                onClick={() => setIsEditOpen(false)}
                disabled={editLoading}
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-8 text-[11px] font-semibold"
                disabled={editLoading || !editTitle.trim()}
              >
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

      {/* Dialog: Image Full Size Preview */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-1 overflow-hidden flex flex-col items-center justify-center bg-black/95 border-none">
          {previewImage && (
            <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
              <div className="max-w-full max-h-[80vh] overflow-auto flex items-center justify-center">
                <img
                  src={previewImage.src}
                  alt={previewImage.name}
                  className="max-w-full max-h-[75vh] object-contain rounded border border-white/10"
                />
              </div>
              <p className="text-white text-[12px] font-semibold mt-3 text-center px-4 py-1.5 rounded-full bg-black/60 border border-white/10 backdrop-blur-md truncate max-w-[80%] shadow-lg leading-normal">
                {cleanFileName(previewImage.name)}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
