"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Clock, Loader2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getRecentlyViewedIssues,
  RecentlyViewedIssue,
} from "@/lib/issues-service";

const COLOR_PALETTES = [
  "bg-indigo-500/10 text-indigo-600 border-indigo-500/30 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/40",
  "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/40",
  "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/40",
  "bg-rose-500/10 text-rose-600 border-rose-500/30 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/40",
  "bg-sky-500/10 text-sky-600 border-sky-500/30 dark:bg-sky-500/20 dark:text-sky-400 dark:border-sky-500/40",
  "bg-purple-500/10 text-purple-600 border-purple-500/30 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/40",
];

const PROJECT_COLOR_MAP: Record<string, string> = {};

function getProjectColor(projectKey: string): string {
  if (!projectKey) return COLOR_PALETTES[0];
  if (!PROJECT_COLOR_MAP[projectKey]) {
    let hash = 0;
    for (let i = 0; i < projectKey.length; i++) {
      hash = projectKey.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % COLOR_PALETTES.length;
    PROJECT_COLOR_MAP[projectKey] = COLOR_PALETTES[index];
  }
  return PROJECT_COLOR_MAP[projectKey];
}

export default function RecentlyViewedMenu() {
  const router = useRouter();

  const { data: issues = [], isLoading, refetch } = useQuery<RecentlyViewedIssue[]>({
    queryKey: ["recently-viewed"],
    queryFn: getRecentlyViewedIssues,
    staleTime: 5000,
  });

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) refetch(); }}>
      <DropdownMenuTrigger
        render={
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent focus:outline-none transition-colors relative" />
        }
      >
        <Clock className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <History className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">
              Dilihat Baru-baru Ini
            </span>
          </div>
          {issues.length > 0 && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {issues.length} tiket
            </span>
          )}
        </div>

        <div className="max-h-[320px] overflow-y-auto py-1 scrollbar-thin">
          {isLoading ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : issues.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Belum ada issue yang baru saja dilihat
            </div>
          ) : (
            issues.map((item) => {
              const badgeColor = getProjectColor(item.projectKey);
              return (
                <DropdownMenuItem
                  key={item.id}
                  onClick={() =>
                    router.push(`/projects/${item.projectId}/issues/${item.id}`)
                  }
                  className="flex items-start gap-2.5 px-3 py-2 cursor-pointer hover:bg-accent/60 focus:bg-accent text-left"
                >
                  <span
                    className={`mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 border ${badgeColor}`}
                  >
                    {item.displayId || `${item.projectKey}-${item.number}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate leading-snug">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-muted-foreground truncate">
                        {item.projectName}
                      </span>
                      {item.status && (
                        <>
                          <span className="text-[9px] text-muted-foreground/60">•</span>
                          <span className="text-[9.5px] font-medium text-muted-foreground">
                            {item.status.name}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </DropdownMenuItem>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
