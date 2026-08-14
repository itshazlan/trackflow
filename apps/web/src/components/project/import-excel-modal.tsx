"use client";

import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Download,
  ArrowRight,
  UploadCloud,
} from "lucide-react";
import {
  previewExcelImport,
  commitExcelImport,
  ExcelImportPreviewResponse,
  ExcelImportCommitResult,
} from "@/lib/issues-service";

interface ImportExcelModalProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ImportExcelModal({
  projectId,
  open,
  onOpenChange,
}: ImportExcelModalProps) {
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<"upload" | "select-sheet" | "preview" | "done">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [previewData, setPreviewData] = useState<ExcelImportPreviewResponse | null>(null);
  const [commitResult, setCommitResult] = useState<ExcelImportCommitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const resetState = () => {
    setStage("upload");
    setFile(null);
    setSheets([]);
    setSelectedSheet("");
    setPreviewData(null);
    setCommitResult(null);
    setLoading(false);
    setError(null);
    setIsDragging(false);
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    onOpenChange(newOpen);
  };

  const processFile = async (selectedFile: File) => {
    setError(null);
    if (!selectedFile.name.toLowerCase().endsWith(".xlsx")) {
      setError("Hanya file format .xlsx yang diterima.");
      return;
    }

    setFile(selectedFile);
    setLoading(true);

    try {
      const result = await previewExcelImport(projectId, selectedFile);
      if (result.requiresSheetSelection && result.sheets?.length) {
        setSheets(result.sheets);
        setSelectedSheet(result.sheets[0]);
        setStage("select-sheet");
      } else {
        setPreviewData(result);
        setStage("preview");
      }
    } catch (err: any) {
      setError(err.message || "Gagal memproses file Excel.");
    } finally {
      setLoading(false);
    }
  };

  const handleSheetSelect = async () => {
    if (!file || !selectedSheet) return;
    setLoading(true);
    setError(null);

    try {
      const result = await previewExcelImport(projectId, file, selectedSheet);
      setPreviewData(result);
      setStage("preview");
    } catch (err: any) {
      setError(err.message || "Gagal memproses sheet terpilih.");
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!previewData || !previewData.preview || !file) return;
    setLoading(true);
    setError(null);

    try {
      const result = await commitExcelImport(projectId, {
        rows: previewData.preview,
        fileName: file.name,
        sheetName: previewData.sheetName || "Sheet1",
      });

      setCommitResult(result);
      setStage("done");
      queryClient.invalidateQueries({ queryKey: ["issues", projectId] });
    } catch (err: any) {
      setError(err.message || "Gagal meng-import tiket ke database.");
    } finally {
      setLoading(false);
    }
  };

  const downloadErrorReportCSV = () => {
    if (!previewData?.errors?.length) return;
    const headers = ["Baris", "Kolom", "Nilai", "Pesan Error"];
    const rows = previewData.errors.map((e) => [
      e.row,
      `"${(e.column || "").replace(/"/g, '""')}"`,
      `"${(e.value || "").toString().replace(/"/g, '""')}"`,
      `"${(e.message || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `laporan-error-import-${file?.name || "excel"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[720px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold flex items-center gap-2">
            <FileSpreadsheet className="h-4.5 w-4.5 text-primary" />
            <span>Import Tiket dari Excel (.xlsx)</span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* Stage 1: Upload */}
          {stage === "upload" && (
            <div className="flex flex-col gap-4">
              <div
                className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-all bg-card/30 ${
                  isDragging ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border/80"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files?.[0]) {
                    processFile(e.dataTransfer.files[0]);
                  }
                }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <div className="flex flex-col items-center gap-1 text-center">
                  <span className="text-[13px] font-semibold text-foreground">
                    Seret file Excel ke sini, atau klik untuk memilih
                  </span>
                  <span className="text-[11.5px] text-muted-foreground">
                    Hanya mendukung format .xlsx (Maksimal 5MB, maks. 500 baris)
                  </span>
                </div>
                <input
                  type="file"
                  accept=".xlsx"
                  id="excel-file-input"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      processFile(e.target.files[0]);
                    }
                  }}
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("excel-file-input")?.click()}
                  disabled={loading}
                  className="mt-1 gap-2 text-[12px] font-medium"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Pilih File .xlsx
                </Button>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-[11.5px] text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">Format Kolom Header Wajib:</span>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li><code className="text-foreground font-mono">Module</code> — Nama modul/fitur</li>
                  <li><code className="text-foreground font-mono">Issues / Bugs Description</code> — Deskripsi detail tiket</li>
                  <li><code className="text-foreground font-mono">Tipe</code> — Nama tracker (Bug, Feature, Support, dll)</li>
                  <li><code className="text-foreground font-mono">Priority</code> (opsional) — Low / Medium / High / Urgent</li>
                  <li><code className="text-foreground font-mono">Target Date</code> (opsional) — Tanggal format dd/mm/yyyy</li>
                </ul>
              </div>
            </div>
          )}

          {/* Stage 2: Select Sheet */}
          {stage === "select-sheet" && (
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[12px] font-medium">Pilih Lembar Kerja (Sheet)</Label>
                <span className="text-[11.5px] text-muted-foreground">
                  File &quot;{file?.name}&quot; memiliki {sheets.length} sheet. Silakan pilih sheet yang ingin diimpor:
                </span>
                <select
                  value={selectedSheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  className="h-9 rounded-md border border-input bg-card px-3 text-[12.5px] outline-none mt-1"
                  disabled={loading}
                >
                  {sheets.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStage("upload")}
                  disabled={loading}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSheetSelect}
                  disabled={loading}
                  className="gap-1.5"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Lanjut Preview</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Stage 3: Preview */}
          {stage === "preview" && previewData && (
            <div className="flex flex-col gap-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border/80 bg-card p-3 flex flex-col gap-0.5">
                  <span className="text-[10.5px] font-semibold text-muted-foreground uppercase">Total Baris</span>
                  <span className="text-[18px] font-bold text-foreground">{previewData.totalRows || 0}</span>
                </div>
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 flex flex-col gap-0.5">
                  <span className="text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase">Valid</span>
                  <span className="text-[18px] font-bold text-emerald-600 dark:text-emerald-400">{previewData.validRows || 0}</span>
                </div>
                <div className={`rounded-lg border p-3 flex flex-col gap-0.5 ${
                  (previewData.errorRows || 0) > 0
                    ? "border-destructive/30 bg-destructive/5 text-destructive"
                    : "border-border/80 bg-card text-muted-foreground"
                }`}>
                  <span className="text-[10.5px] font-semibold uppercase">Error</span>
                  <span className="text-[18px] font-bold">{previewData.errorRows || 0}</span>
                </div>
              </div>

              {/* Error Section */}
              {Boolean(previewData.errors?.length) && (
                <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-destructive flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Daftar Baris Berpengaruh ({previewData.errors?.length} Masalah)
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={downloadErrorReportCSV}
                      className="h-6 text-[11px] font-medium px-2 gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                    >
                      <Download className="h-3 w-3" />
                      Unduh Laporan Error (.csv)
                    </Button>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1 border-t border-destructive/20 pt-2">
                    {previewData.errors?.map((err, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-[11.5px] text-destructive/90">
                        <span className="font-mono font-bold shrink-0">Baris {err.row}:</span>
                        <span>
                          Kolom <strong className="font-semibold">{err.column}</strong> — {err.message}
                          {err.value !== undefined && <code className="ml-1 bg-destructive/10 px-1 rounded">({String(err.value)})</code>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Valid Rows Preview Table */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-foreground">
                  Pratinjau Baris Valid yang Akan Diimpor ({previewData.preview?.length || 0})
                </span>
                <div className="rounded-lg border border-border max-h-56 overflow-y-auto">
                  <Table className="text-[12px]">
                    <TableHeader className="bg-muted/50 sticky top-0">
                      <TableRow className="h-8">
                        <TableHead className="w-12 text-center text-[11px]">#</TableHead>
                        <TableHead className="text-[11px]">Judul Tiket (Hasil Komposisi)</TableHead>
                        <TableHead className="w-24 text-[11px]">Prioritas</TableHead>
                        <TableHead className="w-24 text-[11px]">Status</TableHead>
                        <TableHead className="w-28 text-[11px]">Due Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.preview?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                            Tidak ada baris valid yang dapat diimpor.
                          </TableCell>
                        </TableRow>
                      ) : (
                        previewData.preview?.map((row) => (
                          <TableRow key={row.row} className="h-8">
                            <TableCell className="text-center font-mono text-[11px] text-muted-foreground">{row.row}</TableCell>
                            <TableCell className="font-medium truncate max-w-[280px]" title={row.title}>
                              {row.title}
                            </TableCell>
                            <TableCell className="capitalize text-muted-foreground">{row.priority}</TableCell>
                            <TableCell className="text-muted-foreground">{row.statusName}</TableCell>
                            <TableCell className="font-mono text-muted-foreground">{row.dueDate || "-"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStage(sheets.length > 1 ? "select-sheet" : "upload")}
                  disabled={loading}
                >
                  Kembali
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCommit}
                  disabled={loading || !previewData.validRows}
                  className="gap-1.5 font-medium"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Import {previewData.validRows || 0} Tiket</span>
                </Button>
              </div>
            </div>
          )}

          {/* Stage 4: Done */}
          {stage === "done" && commitResult && (
            <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[16px] font-bold text-foreground">
                  Proses Import Selesai
                </span>
                <span className="text-[13px] text-muted-foreground">
                  Sebanyak <strong className="font-semibold text-foreground">{commitResult.importedCount} tiket</strong> telah berhasil disimpan ke database.
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => handleClose(false)}
                className="mt-2 font-medium"
              >
                Selesai & Lihat Tiket
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
