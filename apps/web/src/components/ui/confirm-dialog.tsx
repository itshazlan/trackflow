"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConfirmOptions {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
}

type Resolver = (value: boolean) => void;

interface DialogState extends ConfirmOptions {
  open: boolean;
  resolve: Resolver | null;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ConfirmContext = React.createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<DialogState>({
    open: false,
    description: "",
    resolve: null,
  });

  const confirm = React.useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, open: true, resolve });
    });
  }, []);

  const handleResolve = (value: boolean) => {
    state.resolve?.(value);
    setState((s) => ({ ...s, open: false, resolve: null }));
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      <Dialog open={state.open} onOpenChange={(open) => { if (!open) handleResolve(false); }}>
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex items-start gap-3">
              {state.variant === "destructive" ? (
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/15">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </span>
              ) : (
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                </span>
              )}
              <div className="flex flex-col gap-1">
                <DialogTitle className="text-[14px] font-semibold leading-snug">
                  {state.title ?? "Konfirmasi"}
                </DialogTitle>
                <p className="text-[12.5px] text-muted-foreground leading-relaxed">
                  {state.description}
                </p>
              </div>
            </div>
          </DialogHeader>

          <DialogFooter className="gap-2">
            {state.cancelLabel !== "" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-[12px]"
                onClick={() => handleResolve(false)}
              >
                {state.cancelLabel ?? "Batal"}
              </Button>
            )}
            <Button
              variant={state.variant === "destructive" ? "destructive" : "default"}
              size="sm"
              className="h-8 text-[12px]"
              onClick={() => handleResolve(true)}
            >
              {state.confirmLabel ?? "Ya, Lanjutkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
