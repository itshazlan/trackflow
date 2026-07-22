"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { login, register, getSession } from "@/lib/auth-service";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Field wrapper — tight spacing consistent with density-first design
// ---------------------------------------------------------------------------
function FieldGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-col gap-1.5", className)}>{children}</div>;
}

// ---------------------------------------------------------------------------
// Input with optional leading icon
// ---------------------------------------------------------------------------
function IconInput({
  icon: Icon,
  hasError,
  ...props
}: {
  icon?: React.ElementType;
  hasError?: boolean;
} & React.ComponentProps<typeof Input>) {
  if (!Icon) return <Input {...props} className={cn(props.className, hasError && "border-destructive")} />;
  return (
    <div className="relative">
      <Icon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        {...props}
        className={cn(
          "pl-8 text-[13px] h-8",
          hasError && "border-destructive focus-visible:ring-destructive/40",
          props.className
        )}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline validation message
// ---------------------------------------------------------------------------
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-start gap-1 text-[12px] text-destructive leading-normal">
      <AlertCircle className="h-3 w-3 mt-[1px] shrink-0" />
      {message}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Alert banner (error / success)
// ---------------------------------------------------------------------------
function AlertBanner({
  type,
  message,
}: {
  type: "error" | "success";
  message: string;
}) {
  const isError = type === "error";
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2.5 text-[13px]",
        isError
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
      )}
    >
      {isError ? (
        <AlertCircle className="h-3.5 w-3.5 mt-[1px] shrink-0" />
      ) : (
        <CheckCircle2 className="h-3.5 w-3.5 mt-[1px] shrink-0" />
      )}
      <span>{message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main auth page
// ---------------------------------------------------------------------------
export default function AuthPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("login");

  // Sign In state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Sign Up state
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPosition, setRegisterPosition] = useState("");
  const [registerDepartment, setRegisterDepartment] = useState("");
  const [registerEmployeeId, setRegisterEmployeeId] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);
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

  // Validation
  const validateRegisterForm = () => {
    const errors: typeof validationErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(registerEmail)) {
      errors.email = "Format email tidak valid (contoh: nama@perusahaan.com).";
    }
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(registerPassword)) {
      errors.password =
        "Minimal 8 karakter, 1 huruf besar, 1 angka, dan 1 karakter spesial (@$!%*?&).";
    }
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!registerUsername) {
      errors.username = "Username wajib diisi.";
    } else if (!usernameRegex.test(registerUsername)) {
      errors.username =
        "Hanya boleh berisi huruf, angka, strip (-), dan garis bawah (_).";
    }
    if (registerEmployeeId) {
      const empIdRegex = /^EMP-\d{3,}$/i;
      if (!empIdRegex.test(registerEmployeeId)) {
        errors.employeeId = "Format harus seperti: EMP-001 atau EMP-2045.";
      }
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      await login(loginEmail, loginPassword);
      router.push("/");
    } catch (err: unknown) {
      setLoginError(
        err instanceof Error ? err.message : "Username/email atau password salah."
      );
      setLoginLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});
    if (!validateRegisterForm()) return;
    setRegisterLoading(true);
    try {
      await register({
        name: registerName,
        email: registerEmail,
        username: registerUsername,
        password: registerPassword,
        position: registerPosition || undefined,
        department: registerDepartment || undefined,
        employeeId: registerEmployeeId || undefined,
        employmentStatus: "active",
        isAdmin: false,
      });
      setRegisterSuccess(true);
      setRegisterLoading(false);
      setTimeout(() => {
        setRegisterSuccess(false);
        setActiveTab("login");
        setLoginEmail(registerEmail);
        setLoginPassword("");
        setRegisterName("");
        setRegisterEmail("");
        setRegisterUsername("");
        setRegisterPassword("");
        setRegisterPosition("");
        setRegisterDepartment("");
        setRegisterEmployeeId("");
      }, 2000);
    } catch (err: unknown) {
      setValidationErrors({
        general:
          err instanceof Error
            ? err.message
            : "Registrasi gagal. Username atau email mungkin sudah digunakan.",
      });
      setRegisterLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {/* Wordmark */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card shadow-sm">
          <Timer className="h-4.5 w-4.5 text-foreground" strokeWidth={1.75} />
        </div>
        <div className="text-center">
          <h1 className="text-[15px] font-semibold tracking-tight text-foreground">
            TrackFlow
          </h1>
          <p className="text-[12px] text-muted-foreground">
            Time-Tracking &amp; Project Management
          </p>
        </div>
      </div>

      {/* Auth Card */}
      <Card className="w-full max-w-[380px] border-border bg-card shadow-md">
        <CardHeader className="px-5 pt-5 pb-0">
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v);
              setLoginError("");
              setValidationErrors({});
            }}
            className="w-full"
          >
            <TabsList className="w-full grid grid-cols-2 h-8 rounded-md bg-muted p-0.5">
              <TabsTrigger
                value="login"
                className="text-[13px] h-7 rounded-[5px] data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground transition-all duration-150"
              >
                Masuk
              </TabsTrigger>
              <TabsTrigger
                value="register"
                className="text-[13px] h-7 rounded-[5px] data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground transition-all duration-150"
              >
                Daftar
              </TabsTrigger>
            </TabsList>

            {/* ── LOGIN TAB ── */}
            <TabsContent value="login" className="mt-0">
              <form onSubmit={handleLoginSubmit}>
                <CardContent className="flex flex-col gap-3 px-0 pt-4 pb-0">
                  {loginError && (
                    <AlertBanner type="error" message={loginError} />
                  )}

                  <FieldGroup>
                    <Label
                      htmlFor="login-email"
                      className="text-[12px] text-muted-foreground"
                    >
                      Username atau Email
                    </Label>
                    <IconInput
                      id="login-email"
                      icon={Mail}
                      type="text"
                      placeholder="Username atau nama@perusahaan.com"
                      required
                      autoComplete="username"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                    />
                  </FieldGroup>

                  <FieldGroup>
                    <Label
                      htmlFor="login-password"
                      className="text-[12px] text-muted-foreground"
                    >
                      Password
                    </Label>
                    <IconInput
                      id="login-password"
                      icon={Lock}
                      type="password"
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                  </FieldGroup>

                  <Button
                    type="submit"
                    disabled={loginLoading}
                    className="mt-1 h-8 w-full text-[13px] font-medium transition-all duration-150 cursor-pointer"
                  >
                    {loginLoading ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Masuk...
                      </>
                    ) : (
                      "Masuk"
                    )}
                  </Button>
                </CardContent>
              </form>
            </TabsContent>

            {/* ── REGISTER TAB ── */}
            <TabsContent value="register" className="mt-0">
              <form onSubmit={handleRegisterSubmit}>
                <CardContent className="flex flex-col gap-3 px-0 pt-4 pb-0 max-h-[420px] overflow-y-auto">
                  {registerSuccess && (
                    <AlertBanner
                      type="success"
                      message="Registrasi berhasil! Mengalihkan ke halaman masuk..."
                    />
                  )}
                  {validationErrors.general && (
                    <AlertBanner
                      type="error"
                      message={validationErrors.general}
                    />
                  )}

                  <FieldGroup>
                    <Label
                      htmlFor="reg-name"
                      className="text-[12px] text-muted-foreground"
                    >
                      Nama Lengkap <span className="text-destructive">*</span>
                    </Label>
                    <IconInput
                      id="reg-name"
                      icon={User}
                      type="text"
                      placeholder="Nama Lengkap"
                      required
                      autoComplete="name"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                    />
                  </FieldGroup>

                  <FieldGroup>
                    <Label
                      htmlFor="reg-username"
                      className="text-[12px] text-muted-foreground"
                    >
                      Username <span className="text-destructive">*</span>
                    </Label>
                    <IconInput
                      id="reg-username"
                      icon={User}
                      type="text"
                      placeholder="username_karyawan"
                      required
                      autoComplete="username"
                      value={registerUsername}
                      onChange={(e) => setRegisterUsername(e.target.value)}
                      hasError={!!validationErrors.username}
                    />
                    <FieldError message={validationErrors.username} />
                  </FieldGroup>

                  <FieldGroup>
                    <Label
                      htmlFor="reg-email"
                      className="text-[12px] text-muted-foreground"
                    >
                      Email <span className="text-destructive">*</span>
                    </Label>
                    <IconInput
                      id="reg-email"
                      icon={Mail}
                      type="email"
                      placeholder="karyawan@perusahaan.com"
                      required
                      autoComplete="email"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      hasError={!!validationErrors.email}
                    />
                    <FieldError message={validationErrors.email} />
                  </FieldGroup>

                  <FieldGroup>
                    <Label
                      htmlFor="reg-password"
                      className="text-[12px] text-muted-foreground"
                    >
                      Password <span className="text-destructive">*</span>
                    </Label>
                    <IconInput
                      id="reg-password"
                      icon={Lock}
                      type="password"
                      placeholder="Min. 8 karakter"
                      required
                      autoComplete="new-password"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      hasError={!!validationErrors.password}
                    />
                    <FieldError message={validationErrors.password} />
                  </FieldGroup>

                  {/* Divider for optional fields */}
                  <div className="border-t border-border pt-3 -mx-0">
                    <p className="text-[11px] font-medium text-muted-foreground mb-3 uppercase tracking-widest">
                      Kepegawaian — opsional
                    </p>

                    <div className="flex flex-col gap-3">
                      <FieldGroup>
                        <Label
                          htmlFor="reg-position"
                          className="text-[12px] text-muted-foreground"
                        >
                          Jabatan
                        </Label>
                        <IconInput
                          id="reg-position"
                          icon={Briefcase}
                          type="text"
                          placeholder="Backend Developer"
                          value={registerPosition}
                          onChange={(e) => setRegisterPosition(e.target.value)}
                        />
                      </FieldGroup>

                      <FieldGroup>
                        <Label
                          htmlFor="reg-dept"
                          className="text-[12px] text-muted-foreground"
                        >
                          Departemen
                        </Label>
                        <IconInput
                          id="reg-dept"
                          icon={Building2}
                          type="text"
                          placeholder="Engineering"
                          value={registerDepartment}
                          onChange={(e) =>
                            setRegisterDepartment(e.target.value)
                          }
                        />
                      </FieldGroup>

                      <FieldGroup>
                        <Label
                          htmlFor="reg-emp-id"
                          className="text-[12px] text-muted-foreground"
                        >
                          Employee ID (NIK)
                        </Label>
                        <IconInput
                          id="reg-emp-id"
                          icon={IdCard}
                          type="text"
                          placeholder="EMP-001"
                          value={registerEmployeeId}
                          onChange={(e) =>
                            setRegisterEmployeeId(e.target.value)
                          }
                          hasError={!!validationErrors.employeeId}
                        />
                        <FieldError message={validationErrors.employeeId} />
                      </FieldGroup>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={registerLoading || registerSuccess}
                    className="h-8 w-full text-[13px] font-medium transition-all duration-150 cursor-pointer"
                  >
                    {registerLoading ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Mendaftar...
                      </>
                    ) : (
                      "Buat Akun"
                    )}
                  </Button>
                </CardContent>
              </form>
            </TabsContent>
          </Tabs>
        </CardHeader>

        {/* Bottom footer note */}
        <div className="px-5 py-3 border-t border-border">
          <p className="text-[11px] text-muted-foreground text-center">
            Platform internal — akses hanya untuk karyawan terdaftar.
          </p>
        </div>
      </Card>
    </div>
  );
}
