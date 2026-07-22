"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Mail,
  Lock,
  AlertCircle,
  Timer,
} from "lucide-react";
import { login, getSession } from "@/lib/auth-service";
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

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirect if already logged in
  useEffect(() => {
    getSession().then((session) => {
      if (session) router.push("/");
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      queryClient.clear();
      router.push("/");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Username/email atau password salah."
      );
      setLoading(false);
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
            Sign in to your account to continue
          </p>
        </div>
      </div>

      <div className="w-full max-w-[340px] rounded-lg border border-border bg-card p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive leading-normal">
              <AlertCircle className="h-3.5 w-3.5 mt-[1px] shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <FieldGroup>
            <Label htmlFor="email" className="text-[12px] font-medium text-muted-foreground">
              Username atau Email
            </Label>
            <IconInput
              id="email"
              type="text"
              placeholder="Username atau nama@perusahaan.com"
              icon={Mail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </FieldGroup>

          <FieldGroup>
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-[12px] font-medium text-muted-foreground">
                Password
              </Label>
            </div>
            <IconInput
              id="password"
              type="password"
              placeholder="••••••••"
              icon={Lock}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </FieldGroup>

          <Button
            type="submit"
            className="w-full h-8 text-[13px] font-medium mt-1"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Signing In...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-[12px] text-muted-foreground">
          Belum punya akun?{" "}
          <Link href="/register" className="font-medium text-foreground hover:underline">
            Daftar baru
          </Link>
        </div>
      </div>
    </div>
  );
}
