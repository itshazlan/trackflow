"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Mail,
  Lock,
  User,
  Building2,
  Briefcase,
  IdCard,
  AlertCircle,
  CheckCircle2,
  Timer,
} from "lucide-react";
import { register, getSession } from "@/lib/auth-service";
import { cn } from "@/lib/utils";

function FieldGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-col gap-1.5", className)}>{children}</div>;
}

function IconInput({
  icon: Icon,
  hasError,
  ...props
}: {
  icon?: React.ElementType;
  hasError?: boolean;
} & React.ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      {Icon && <Icon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />}
      <Input
        {...props}
        className={cn(
          "text-[13px] h-8",
          Icon ? "pl-8" : "pl-3",
          hasError && "border-destructive focus-visible:ring-destructive/40",
          props.className
        )}
      />
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-start gap-1 text-[11px] text-destructive leading-normal mt-0.5">
      <AlertCircle className="h-3 w-3 mt-[1px] shrink-0" />
      {message}
    </p>
  );
}

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    password?: string;
    username?: string;
    employeeId?: string;
    general?: string;
  }>({});

  // Redirect if already logged in
  useEffect(() => {
    getSession().then((session) => {
      if (session) router.push("/");
    });
  }, [router]);

  const validateForm = () => {
    const errors: typeof validationErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.email = "Format email tidak valid (contoh: nama@perusahaan.com).";
    }
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      errors.password =
        "Minimal 8 karakter, 1 huruf besar, 1 angka, dan 1 karakter spesial (@$!%*?&).";
    }
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!username) {
      errors.username = "Username wajib diisi.";
    } else if (!usernameRegex.test(username)) {
      errors.username =
        "Hanya boleh berisi huruf, angka, strip (-), dan garis bawah (_).";
    }
    if (employeeId) {
      const empIdRegex = /^EMP-\d{3,}$/i;
      if (!empIdRegex.test(employeeId)) {
        errors.employeeId = "Format harus seperti: EMP-001 atau EMP-2045.";
      }
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});
    if (!validateForm()) return;
    setLoading(true);
    try {
      await register({
        name,
        email,
        username,
        password,
        position: position || undefined,
        department: department || undefined,
        employeeId: employeeId || undefined,
        employmentStatus: "active",
        isAdmin: false,
      });
      setSuccess(true);
      setLoading(false);
      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (err: unknown) {
      setValidationErrors({
        general:
          err instanceof Error
            ? err.message
            : "Registrasi gagal. Username atau email mungkin sudah digunakan.",
      });
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      {/* Wordmark */}
      <div className="mb-6 flex flex-col items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card shadow-sm">
          <Timer className="h-4.5 w-4.5 text-foreground" strokeWidth={1.75} />
        </div>
        <div className="text-center">
          <h1 className="text-[15px] font-semibold tracking-tight text-foreground">
            TrackFlow
          </h1>
          <p className="text-[12px] text-muted-foreground">
            Buat akun baru untuk memulai
          </p>
        </div>
      </div>

      <div className="w-full max-w-[360px] rounded-lg border border-border bg-card p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {success && (
            <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-400 leading-normal">
              <CheckCircle2 className="h-3.5 w-3.5 mt-[1px] shrink-0" />
              <span>Registrasi berhasil! Mengalihkan ke login...</span>
            </div>
          )}

          {validationErrors.general && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive leading-normal">
              <AlertCircle className="h-3.5 w-3.5 mt-[1px] shrink-0" />
              <span>{validationErrors.general}</span>
            </div>
          )}

          <FieldGroup>
            <Label htmlFor="name" className="text-[12px] font-medium text-muted-foreground">
              Nama Lengkap
            </Label>
            <IconInput
              id="name"
              type="text"
              placeholder="John Doe"
              icon={User}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
            />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="email" className="text-[12px] font-medium text-muted-foreground">
              Alamat Email
            </Label>
            <IconInput
              id="email"
              type="email"
              placeholder="nama@perusahaan.com"
              icon={Mail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              hasError={!!validationErrors.email}
              required
              disabled={loading}
            />
            <FieldError message={validationErrors.email} />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="username" className="text-[12px] font-medium text-muted-foreground">
              Username
            </Label>
            <IconInput
              id="username"
              type="text"
              placeholder="johndoe"
              icon={User}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              hasError={!!validationErrors.username}
              required
              disabled={loading}
            />
            <FieldError message={validationErrors.username} />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="password" className="text-[12px] font-medium text-muted-foreground">
              Password
            </Label>
            <IconInput
              id="password"
              type="password"
              placeholder="••••••••"
              icon={Lock}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hasError={!!validationErrors.password}
              required
              disabled={loading}
            />
            <FieldError message={validationErrors.password} />
          </FieldGroup>

          <div className="h-px bg-border my-1" />

          <div className="grid grid-cols-2 gap-2">
            <FieldGroup>
              <Label htmlFor="position" className="text-[12px] font-medium text-muted-foreground">
                Jabatan (Opsional)
              </Label>
              <IconInput
                id="position"
                type="text"
                placeholder="Developer"
                icon={Briefcase}
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                disabled={loading}
              />
            </FieldGroup>

            <FieldGroup>
              <Label htmlFor="department" className="text-[12px] font-medium text-muted-foreground">
                Departemen (Opsional)
              </Label>
              <IconInput
                id="department"
                type="text"
                placeholder="Engineering"
                icon={Building2}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={loading}
              />
            </FieldGroup>
          </div>

          <FieldGroup>
            <Label htmlFor="employeeId" className="text-[12px] font-medium text-muted-foreground">
              ID Karyawan (Opsional)
            </Label>
            <IconInput
              id="employeeId"
              type="text"
              placeholder="EMP-001"
              icon={IdCard}
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              hasError={!!validationErrors.employeeId}
              disabled={loading}
            />
            <FieldError message={validationErrors.employeeId} />
          </FieldGroup>

          <Button
            type="submit"
            className="w-full h-8 text-[13px] font-medium mt-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Mendaftar...
              </>
            ) : (
              "Daftar Akun"
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-[12px] text-muted-foreground">
          Sudah punya akun?{" "}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
