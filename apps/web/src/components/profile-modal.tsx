"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Camera,
  Lock,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Calendar,
  Shield,
  Phone,
  Mail,
  User,
  Hash,
} from "lucide-react";

interface ProfileData {
  id: string;
  name: string;
  email: string;
  username: string;
  image: string | null;
  phoneNumber: string | null;
  position: string | null;
  department: string | null;
  employeeId: string | null;
  joinDate: string | null;
  employmentStatus: string;
  isAdmin: boolean;
}

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function ProfileModal({ open, onOpenChange, onSuccess }: ProfileModalProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Editable Form fields
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [image, setImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch full user profile on mount / open
  useEffect(() => {
    if (!open) return;

    async function fetchProfile() {
      try {
        setLoading(true);
        setError("");
        setSuccessMsg("");
        const res = await fetch("/api/users/me");
        if (!res.ok) throw new Error("Gagal mengambil data profil");
        
        const data: ProfileData = await res.json();
        setProfile(data);
        setName(data.name || "");
        setUsername(data.username || "");
        setPhoneNumber(data.phoneNumber || "");
        setPosition(data.position || "");
        setDepartment(data.department || "");
        setImage(data.image);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memuat profil.");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [open]);

  // Handle avatar upload flow
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local validation
    if (!file.type.startsWith("image/")) {
      setError("Berkas harus berupa gambar.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Ukuran gambar maksimal 2 MB.");
      return;
    }

    try {
      setUploadLoading(true);
      setError("");
      setSuccessMsg("");

      // Upload via backend — avoids browser CORS against R2 entirely.
      // Backend receives the file and pushes it to R2 server-side.
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/users/me/avatar", {
        method: "POST",
        body: formData,
        // Do NOT set Content-Type — browser sets it with the correct boundary automatically
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? "Gagal mengunggah foto profil");
      }

      const { publicUrl } = await res.json();

      // Update local preview with cache-busting param
      setImage(`${publicUrl}?t=${Date.now()}`);
      setSuccessMsg("Foto profil berhasil diperbarui!");
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat mengunggah foto.");
    } finally {
      setUploadLoading(false);
    }
  };

  // Submit profile edit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaveLoading(true);
      setError("");
      setSuccessMsg("");

      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          username,
          phoneNumber: phoneNumber || null,
          position: position || null,
          department: department || null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Gagal memperbarui profil");
      }

      setSuccessMsg("Profil berhasil diperbarui!");
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan perubahan.");
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] text-xs">
        <DialogHeader>
          <DialogTitle className="text-[14px] font-semibold">Profil Saya</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex h-60 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {error && (
              <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive leading-normal">
                <AlertCircle className="h-3.5 w-3.5 mt-[1px] shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex items-start gap-2 rounded border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-500 leading-normal">
                <CheckCircle2 className="h-3.5 w-3.5 mt-[1px] shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Avatar Drag & Drop/Click Area */}
            <div className="flex flex-col items-center gap-2 border-b border-border/60 pb-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative h-18 w-18 rounded-full border border-border bg-muted cursor-pointer hover:opacity-85 transition-opacity group flex items-center justify-center overflow-hidden"
              >
                {image ? (
                  <img src={image} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-8 w-8 text-muted-foreground/60" />
                )}
                {uploadLoading ? (
                  <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Camera className="h-4 w-4" />
                  </div>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarChange}
                accept="image/*"
                className="hidden"
                disabled={uploadLoading || saveLoading}
              />
              <span className="text-[10px] text-muted-foreground">
                Klik foto untuk mengganti avatar (Maks 2MB)
              </span>
            </div>

            {/* Form Fields: Editable Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="prof-name" className="text-[11px] font-semibold text-muted-foreground">
                  Nama Lengkap
                </Label>
                <Input
                  id="prof-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 text-[12px]"
                  required
                  disabled={saveLoading}
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="prof-username" className="text-[11px] font-semibold text-muted-foreground">
                  Username
                </Label>
                <Input
                  id="prof-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-8 text-[12px]"
                  required
                  disabled={saveLoading}
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="prof-phone" className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Nomor Telepon
                </Label>
                <Input
                  id="prof-phone"
                  value={phoneNumber}
                  placeholder="Contoh: 0812..."
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="h-8 text-[12px]"
                  disabled={saveLoading}
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="prof-email" className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Email (Read-Only)
                </Label>
                <div className="relative">
                  <Input
                    id="prof-email"
                    value={profile?.email || ""}
                    className="h-8 text-[12px] bg-muted/40 pr-6 text-muted-foreground cursor-not-allowed"
                    disabled
                  />
                  <Lock className="absolute right-2.5 top-2.5 h-3 w-3 text-muted-foreground/60" />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="prof-pos" className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                  <Briefcase className="h-3 w-3" /> Jabatan / Posisi
                </Label>
                <Input
                  id="prof-pos"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="h-8 text-[12px]"
                  disabled={saveLoading}
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="prof-dept" className="text-[11px] font-semibold text-muted-foreground">
                  Departemen
                </Label>
                <Input
                  id="prof-dept"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="h-8 text-[12px]"
                  disabled={saveLoading}
                />
              </div>
            </div>

            {/* Read-only Employment Section (FR-006 / FR-007) */}
            <div className="rounded-lg border border-border/80 bg-muted/20 p-3 mt-1 space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Data Kepegawaian Internal
              </span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11.5px] text-foreground">
                <div className="flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Employee ID:</span>
                  <span className="font-semibold">{profile?.employeeId || "-"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Join Date:</span>
                  <span className="font-semibold">
                    {profile?.joinDate
                      ? new Date(profile.joinDate).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "-"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 col-span-2">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Status &amp; Akses:</span>
                  <span className="font-semibold capitalize">{profile?.employmentStatus}</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-border" />
                  <span className="font-semibold text-primary">
                    {profile?.isAdmin ? "Administrator" : "Karyawan"}
                  </span>
                </div>
              </div>
              <p className="text-[10.5px] text-muted-foreground italic leading-normal border-t border-border/50 pt-1.5 mt-1 flex items-center gap-1">
                <Lock className="h-3 w-3 shrink-0" />
                Hubungi Admin untuk mengubah data kepegawaian read-only di atas.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                className="h-8 text-[12px]"
                onClick={() => onOpenChange(false)}
                disabled={saveLoading}
              >
                Tutup
              </Button>
              <Button type="submit" className="h-8 text-[12px]" disabled={saveLoading}>
                {saveLoading ? (
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
        )}
      </DialogContent>
    </Dialog>
  );
}
