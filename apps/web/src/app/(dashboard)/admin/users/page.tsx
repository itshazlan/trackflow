"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  getAdminUsers,
  updateAdminUser,
  updateAdminUserEmployment,
  AdminUser,
} from "@/lib/admin-service";
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
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Loader2,
  Users,
  AlertCircle,
  CheckCircle2,
  Shield,
  Briefcase,
  Calendar,
  Check,
  X,
  UserCheck,
} from "lucide-react";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Edit Employment Dialog state
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [joinDate, setJoinDate] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState<"active" | "inactive" | "on_leave">("active");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getAdminUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
      setError("Gagal memuat daftar pengguna.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        void loadUsers();
      }
    });
    return () => {
      active = false;
    };
  }, [loadUsers]);

  const handleToggleAdmin = async (userObj: AdminUser) => {
    const nextVal = !userObj.isAdmin;
    if (
      !confirm(
        `Apakah Anda yakin ingin ${
          nextVal ? "memberikan" : "mencabut"
        } akses Administrator untuk ${userObj.name}?`
      )
    ) {
      return;
    }

    try {
      setError("");
      setSuccess("");
      await updateAdminUser(userObj.id, { isAdmin: nextVal });
      setSuccess(`Akses admin ${userObj.name} berhasil diperbarui.`);
      await loadUsers();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Gagal memperbarui status admin.");
    }
  };

  const handleOpenEditDialog = (userObj: AdminUser) => {
    setEditingUser(userObj);
    setPosition(userObj.employment?.position || "");
    setDepartment(userObj.employment?.department || "");
    setEmployeeId(userObj.employment?.employeeId || "");
    setJoinDate(userObj.employment?.joinDate || "");
    setEmploymentStatus(userObj.employment?.employmentStatus || "active");
    setEditError("");
  };

  const handleSaveEmployment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setEditLoading(true);
    setEditError("");

    try {
      await updateAdminUserEmployment(editingUser.id, {
        position: position.trim() || undefined,
        department: department.trim() || undefined,
        employeeId: employeeId.trim() || undefined,
        joinDate: joinDate || undefined,
        employmentStatus,
      });

      setSuccess(`Data kepegawaian ${editingUser.name} berhasil diperbarui.`);
      setEditingUser(null);
      await loadUsers();
    } catch (err: unknown) {
      console.error(err);
      setEditError(err instanceof Error ? err.message : "Gagal memperbarui data kepegawaian.");
    } finally {
      setEditLoading(false);
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="border-b border-border pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Manajemen Pengguna (Admin)
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Kelola peran pengguna, hak akses Administrator, dan informasi kepegawaian internal.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-[12px] text-green-500">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Nama &amp; Kredensial</TableHead>
              <TableHead className="text-center">Admin</TableHead>
              <TableHead>Jabatan &amp; Dep</TableHead>
              <TableHead>NIP / Emp ID</TableHead>
              <TableHead>Tanggal Join</TableHead>
              <TableHead className="text-center">Status Kerja</TableHead>
              <TableHead className="text-center pr-4">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="h-28 text-center text-muted-foreground text-xs">
                  Tidak ada pengguna ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id} className="hover:bg-muted/40 transition-colors">
                  <TableCell className="pl-4">
                    <div className="font-semibold text-foreground text-[12.5px]">{u.name}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      @{u.username} &bull; {u.email}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <button
                      onClick={() => handleToggleAdmin(u)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold border transition-all cursor-pointer ${
                        u.isAdmin
                          ? "bg-primary/10 border-primary/20 text-primary"
                          : "bg-muted border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      <Shield className="h-3 w-3" />
                      {u.isAdmin ? "Ya" : "Tidak"}
                    </button>
                  </TableCell>
                  <TableCell className="text-[12px] font-medium text-foreground">
                    {u.employment?.position ? (
                      <>
                        <div>{u.employment.position}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {u.employment.department || "—"}
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-[12px] font-semibold text-foreground">
                    {u.employment?.employeeId || "—"}
                  </TableCell>
                  <TableCell className="text-[12px]">
                    {u.employment?.joinDate ? (
                      new Date(u.employment.joinDate).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {u.employment?.employmentStatus ? (
                      <span
                        className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold border uppercase tracking-wider ${
                          u.employment.employmentStatus === "active"
                            ? "bg-green-500/10 border-green-500/20 text-green-500"
                            : u.employment.employmentStatus === "on_leave"
                            ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                            : "bg-red-500/10 border-red-500/20 text-red-500"
                        }`}
                      >
                        {u.employment.employmentStatus === "active" && <Check className="h-2.5 w-2.5" />}
                        {u.employment.employmentStatus === "on_leave" && <Calendar className="h-2.5 w-2.5" />}
                        {u.employment.employmentStatus === "inactive" && <X className="h-2.5 w-2.5" />}
                        {u.employment.employmentStatus}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center pr-4">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] font-semibold border-border bg-card"
                      onClick={() => handleOpenEditDialog(u)}
                    >
                      <Briefcase className="h-3 w-3 mr-1" /> Kepegawaian
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Employment Modal */}
      <Dialog open={editingUser !== null} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="sm:max-w-[360px]">
          <form onSubmit={handleSaveEmployment}>
            <DialogHeader>
              <DialogTitle className="text-[14px] font-semibold flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-primary" />
                Edit Kepegawaian: {editingUser?.name}
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-3.5 py-4 text-xs">
              {editError && (
                <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive leading-normal">
                  <AlertCircle className="h-3.5 w-3.5 mt-[1px] shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Position (Jabatan) */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emp-pos" className="text-[11px] font-semibold text-muted-foreground">
                  Jabatan (Position)
                </Label>
                <Input
                  id="emp-pos"
                  type="text"
                  placeholder="Contoh: Senior Frontend Developer"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="h-8.5 text-[12px]"
                  disabled={editLoading}
                />
              </div>

              {/* Department (Departemen) */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emp-dept" className="text-[11px] font-semibold text-muted-foreground">
                  Departemen (Department)
                </Label>
                <Input
                  id="emp-dept"
                  type="text"
                  placeholder="Contoh: Engineering"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="h-8.5 text-[12px]"
                  disabled={editLoading}
                />
              </div>

              {/* Employee ID (NIP) */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emp-id" className="text-[11px] font-semibold text-muted-foreground">
                  Nomor Induk Pegawai (NIP / Employee ID)
                </Label>
                <Input
                  id="emp-id"
                  type="text"
                  placeholder="Contoh: TF-0092"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="h-8.5 text-[12px] font-mono"
                  disabled={editLoading}
                />
              </div>

              {/* Join Date */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emp-join" className="text-[11px] font-semibold text-muted-foreground">
                  Tanggal Bergabung (Join Date)
                </Label>
                <Input
                  id="emp-join"
                  type="date"
                  value={joinDate}
                  onChange={(e) => setJoinDate(e.target.value)}
                  className="h-8.5 text-[12px]"
                  disabled={editLoading}
                />
              </div>

              {/* Employment Status */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emp-status" className="text-[11px] font-semibold text-muted-foreground">
                  Status Karyawan
                </Label>
                <select
                  id="emp-status"
                  value={employmentStatus}
                  onChange={(e) => setEmploymentStatus(e.target.value as "active" | "inactive" | "on_leave")}
                  className="h-8.5 rounded-md border border-input bg-card px-2.5 text-[12px] outline-none"
                  disabled={editLoading}
                >
                  <option value="active">Active (Aktif)</option>
                  <option value="on_leave">On Leave (Cuti)</option>
                  <option value="inactive">Inactive (Resign/Nonaktif)</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-8 text-[12px]"
                onClick={() => setEditingUser(null)}
                disabled={editLoading}
              >
                Batal
              </Button>
              <Button type="submit" className="h-8 text-[12px]" disabled={editLoading}>
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
    </div>
  );
}
