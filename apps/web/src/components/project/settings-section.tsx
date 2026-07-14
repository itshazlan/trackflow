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
  IssueStatus,
  IssueTemplate,
  Tracker,
  TemplateField,
} from "@/lib/issues-service";
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
} from "lucide-react";

interface SettingsSectionProps {
  projectId: string;
}

export default function SettingsSection({ projectId }: SettingsSectionProps) {
  const [statuses, setStatuses] = useState<IssueStatus[]>([]);
  const [templates, setTemplates] = useState<IssueTemplate[]>([]);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
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
  const [templateFields, setTemplateFields] = useState<TemplateField[]>([]);
  const [templateActionLoading, setTemplateActionLoading] = useState(false);
  const [templateError, setTemplateError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [statusesData, templatesData, trackersData] = await Promise.all([
        getProjectStatuses(projectId),
        getProjectTemplates(projectId),
        getTrackers(),
      ]);
      setStatuses(statusesData);
      setTemplates(templatesData);
      setTrackers(trackersData);
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
      alert("Gagal memperbarui urutan status.");
      void fetchData();
    }
  };

  const handleDeleteStatus = async (statusId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus status ini?")) return;
    try {
      await deleteProjectStatus(projectId, statusId);
      setStatuses((prev) => prev.filter((s) => s.id !== statusId));
    } catch (err) {
      console.error(err);
      alert("Gagal menghapus status. Pastikan tidak ada issue yang dikaitkan dengan status ini.");
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
    if (!confirm("Apakah Anda yakin ingin menghapus template ini?")) return;
    try {
      await deleteProjectTemplate(projectId, templateId);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    } catch (err) {
      console.error(err);
      alert("Gagal menghapus template.");
    }
  };

  const handleOpenTemplateModal = (template?: IssueTemplate) => {
    if (template) {
      setTemplateEditing(template);
      setTemplateName(template.name);
      setTemplateTrackerId(template.trackerId);
      setTemplateTitlePattern(template.titlePattern || "");
      setTemplateFields(template.fields || []);
    } else {
      setTemplateEditing(null);
      setTemplateName("");
      setTemplateTrackerId(trackers.length > 0 ? trackers[0].id : "");
      setTemplateTitlePattern("");
      setTemplateFields([]);
    }
    setTemplateError("");
    setIsTemplateModalOpen(true);
  };

  const handleAddFieldRow = () => {
    setTemplateFields((prev) => [...prev, { label: "", required: false, helperText: "" }]);
  };

  const handleRemoveFieldRow = (idx: number) => {
    setTemplateFields((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleFieldRowChange = (idx: number, key: keyof TemplateField, val: string | boolean) => {
    setTemplateFields((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, [key]: val } : f))
    );
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim() || !templateTrackerId) return;

    const validFields = templateFields.filter((f) => f.label.trim() !== "");

    setTemplateActionLoading(true);
    setTemplateError("");

    try {
      const payload = {
        name: templateName.trim(),
        trackerId: templateTrackerId,
        titlePattern: templateTitlePattern.trim() || undefined,
        fields: validFields.map((f) => ({
          label: f.label.trim(),
          required: f.required,
          helperText: f.helperText?.trim() || undefined,
        })),
      };

      if (templateEditing) {
        const updated = await updateProjectTemplate(projectId, templateEditing.id, {
          name: payload.name,
          trackerId: payload.trackerId,
          titlePattern: payload.titlePattern || null,
          fields: payload.fields,
        });
        setTemplates((prev) => prev.map((t) => (t.id === templateEditing.id ? updated : t)));
      } else {
        const newTemplate = await createProjectTemplate(projectId, payload);
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

      <Tabs defaultValue="workflow" className="w-full flex flex-col gap-4">
        <TabsList className="w-fit h-8.5 bg-muted/40 border border-border p-0.5 rounded-lg shrink-0">
          <TabsTrigger value="workflow" className="text-[11.5px] font-medium px-3.5 h-7.5 rounded-md flex items-center gap-1.5">
            <Sliders className="h-3.5 w-3.5" />
            Workflow Status
          </TabsTrigger>
          <TabsTrigger value="templates" className="text-[11.5px] font-medium px-3.5 h-7.5 rounded-md flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Template Tiket
          </TabsTrigger>
        </TabsList>

        {/* Workflow settings content */}
        <TabsContent value="workflow" className="mt-0 flex flex-col gap-4">
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
        <TabsContent value="templates" className="mt-0 flex flex-col gap-4">
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
                      <h4 className="text-[13px] font-semibold text-foreground">{tpl.name}</h4>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {tpl.tracker?.name || "Tugas"}
                      </span>
                    </div>
                    {tpl.titlePattern && (
                      <p className="text-[11.5px] text-muted-foreground mt-2 leading-relaxed">
                        <span className="font-semibold">Pattern Judul:</span> <code className="font-mono bg-muted/60 px-1 py-0.25 rounded text-[10.5px]">{tpl.titlePattern}</code>
                      </p>
                    )}
                    <div className="mt-3">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Daftar Bidang ({tpl.fields?.length || 0})
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {tpl.fields?.map((f) => (
                          <span key={f.label} className="rounded border border-border bg-muted/30 px-1.5 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                            {f.label} {f.required && <span className="text-red-500 font-bold">*</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-border mt-4 pt-3 flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" className="h-7 text-[11px] font-medium px-2.5" onClick={() => handleOpenTemplateModal(tpl)}>
                      Edit Template
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-[11px] font-medium text-destructive hover:bg-destructive/10 hover:text-destructive px-2.5" onClick={() => handleDeleteTemplate(tpl.id)}>
                      Hapus
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
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
                <Label htmlFor="template-tracker" className="text-[11px] font-medium text-muted-foreground">
                  Tracker yang Dihubungkan
                </Label>
                <select
                  id="template-tracker"
                  value={templateTrackerId}
                  onChange={(e) => setTemplateTrackerId(e.target.value)}
                  className="h-8 rounded-md border border-input bg-card px-2 text-[12.5px] outline-none"
                  disabled={templateActionLoading}
                >
                  {trackers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
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

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Daftar Bidang Input (Fields Editor)
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] font-medium px-2"
                    onClick={handleAddFieldRow}
                    disabled={templateActionLoading}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Tambah Bidang
                  </Button>
                </div>

                <div className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {templateFields.length === 0 ? (
                    <span className="text-[11.5px] text-muted-foreground italic text-center py-4 bg-muted/10 border border-dashed border-border rounded">
                      Belum ada bidang khusus. Klik Tambah Bidang.
                    </span>
                  ) : (
                    templateFields.map((field, idx) => (
                      <div key={idx} className="flex items-start gap-2 border border-border bg-card/60 p-2 rounded-lg relative group">
                        <div className="flex-1 flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <Input
                              type="text"
                              placeholder="Nama Bidang (contoh: Environment)"
                              value={field.label}
                              onChange={(e) => handleFieldRowChange(idx, "label", e.target.value)}
                              className="h-7 text-[12px] flex-1"
                              required
                              disabled={templateActionLoading}
                            />
                            <div className="flex items-center gap-1.5 shrink-0 select-none">
                              <input
                                id={`req-${idx}`}
                                type="checkbox"
                                checked={field.required}
                                onChange={(e) => handleFieldRowChange(idx, "required", e.target.checked)}
                                className="h-3.5 w-3.5 border-border rounded accent-primary cursor-pointer"
                                disabled={templateActionLoading}
                              />
                              <Label htmlFor={`req-${idx}`} className="text-[11px] font-medium text-muted-foreground cursor-pointer select-none">
                                Wajib
                              </Label>
                            </div>
                          </div>
                          <Input
                            type="text"
                            placeholder="Helper text/deskripsi pengisian..."
                            value={field.helperText || ""}
                            onChange={(e) => handleFieldRowChange(idx, "helperText", e.target.value)}
                            className="h-7 text-[11px] text-muted-foreground"
                            disabled={templateActionLoading}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
                          onClick={() => handleRemoveFieldRow(idx)}
                          disabled={templateActionLoading}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
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
    </div>
  );
}
