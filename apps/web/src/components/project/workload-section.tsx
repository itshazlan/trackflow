"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Users, AlertCircle, BarChart3 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { getProjectWorkload, WorkloadMember } from "@/lib/projects-service";
import { getProjectStatuses, IssueStatus } from "@/lib/issues-service";

interface WorkloadSectionProps {
  projectId: string;
}

export default function WorkloadSection({ projectId }: WorkloadSectionProps) {
  const router = useRouter();

  const {
    data: workloadData,
    isLoading: isWorkloadLoading,
    error: workloadError,
  } = useQuery({
    queryKey: ["project-workload", projectId],
    queryFn: () => getProjectWorkload(projectId),
    enabled: !!projectId,
  });

  const {
    data: statuses = [],
    isLoading: isStatusesLoading,
  } = useQuery<IssueStatus[]>({
    queryKey: ["project-statuses", projectId],
    queryFn: () => getProjectStatuses(projectId),
    enabled: !!projectId,
  });

  if (isWorkloadLoading || isStatusesLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (workloadError) {
    return (
      <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>
          Gagal mengambil data beban kerja: {(workloadError as Error).message}
        </span>
      </div>
    );
  }

  const members = workloadData?.members || [];

  const handleDrillDown = (userId: string, statusId?: string, isOverdue?: boolean) => {
    let url = `/projects/${projectId}?tab=issues&assigneeId=${userId}`;
    if (statusId) {
      url += `&statusId=${statusId}`;
    }
    if (isOverdue) {
      url += `&filter=overdue`;
    }
    router.push(url);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <BarChart3 className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground tracking-tight">
              Workload Overview
            </h2>
            <p className="text-xs text-muted-foreground">
              Distribusi alokasi tiket dan beban kerja seluruh anggota proyek
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 border border-border px-3 py-1.5 rounded-lg">
          <Users className="h-3.5 w-3.5" />
          <span>Total {members.length} anggota tim</span>
        </div>
      </div>

      {/* Workload Table */}
      {members.length === 0 ? (
        <div className="p-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
          Belum ada anggota dalam proyek ini.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-2xs">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-muted/20">
                <TableHead className="w-56 pl-4 font-semibold text-xs">
                  Anggota Tim
                </TableHead>
                <TableHead className="w-24 text-center font-semibold text-xs whitespace-nowrap">
                  Total Tiket
                </TableHead>
                {statuses.map((status) => (
                  <TableHead
                    key={status.id}
                    className="text-center font-semibold text-xs whitespace-nowrap min-w-[100px]"
                  >
                    {status.name}
                  </TableHead>
                ))}
                <TableHead className="w-28 text-center font-bold text-xs text-destructive bg-destructive/10 whitespace-nowrap">
                  Overdue
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const initials = member.name
                  ? member.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)
                  : "?";

                return (
                  <TableRow key={member.userId} className="hover:bg-muted/30 transition-colors">
                    {/* Member Column */}
                    <TableCell className="pl-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-7 w-7 border border-border shrink-0">
                          {member.avatar ? (
                            <img
                              src={member.avatar}
                              alt={member.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <AvatarFallback className="text-[10px] font-bold">
                              {initials}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {member.name}
                          </span>
                          <span className="text-[10.5px] text-muted-foreground truncate font-mono">
                            @{member.username || "user"} •{" "}
                            <span className="capitalize font-sans font-medium text-[10px] text-muted-foreground/80">
                              {member.role.replace("_", " ")}
                            </span>
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Total Assigned Column */}
                    <TableCell className="text-center py-3">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {member.totalAssigned}
                      </span>
                    </TableCell>

                    {/* Status Columns */}
                    {statuses.map((status) => {
                      const count = member.byStatus?.[status.id] || 0;
                      return (
                        <TableCell key={status.id} className="text-center py-3">
                          {count > 0 ? (
                            <button
                              onClick={() =>
                                handleDrillDown(member.userId, status.id)
                              }
                              className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-secondary hover:bg-primary/20 text-foreground hover:text-primary border border-border px-2 text-xs font-mono font-bold cursor-pointer transition-colors"
                              title={`Filter tiket status ${status.name} milik ${member.name}`}
                            >
                              {count}
                            </button>
                          ) : (
                            <span className="text-muted-foreground/40 text-xs font-mono">
                              0
                            </span>
                          )}
                        </TableCell>
                      );
                    })}

                    {/* Overdue Column */}
                    <TableCell className="text-center py-3 bg-destructive/5">
                      {member.overdueCount > 0 ? (
                        <button
                          onClick={() =>
                            handleDrillDown(member.userId, undefined, true)
                          }
                          className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-destructive/15 text-destructive hover:bg-destructive/30 border border-destructive/30 px-2 text-xs font-mono font-extrabold cursor-pointer transition-colors animate-pulse"
                          title={`Filter tiket overdue milik ${member.name}`}
                        >
                          {member.overdueCount}
                        </button>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs font-mono">
                          0
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
