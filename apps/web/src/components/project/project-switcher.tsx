"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProjects, createProject, checkProjectKey, Project } from "@/lib/projects-service";
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
  ChevronDown,
  Search,
  Plus,
  Check,
  FolderOpen,
  CornerDownRight,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface ProjectSwitcherProps {
  currentProjectId?: string;
}

export default function ProjectSwitcher({ currentProjectId }: ProjectSwitcherProps) {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const activeProjectId = (params?.id as string | undefined) || currentProjectId;

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  // Create project dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectKey, setNewProjectKey] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newProjectParentId, setNewProjectParentId] = useState("");
  const [createError, setCreateError] = useState("");
  const [keyError, setKeyError] = useState("");
  const [isCheckingKey, setIsCheckingKey] = useState(false);
  const [isKeyAvailable, setIsKeyAvailable] = useState<boolean | null>(null);
  const [isKeyManuallyEdited, setIsKeyManuallyEdited] = useState(false);

  // Fetch projects via TanStack Query
  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: getProjects,
  });

  // Create project mutation
  const createMutation = useMutation({
    mutationFn: ({
      name,
      key,
      description,
      parentProjectId,
    }: {
      name: string;
      key: string;
      description?: string;
      parentProjectId?: string;
    }) => createProject(name, key, description, parentProjectId),
    onSuccess: (newProj) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setIsCreateOpen(false);
      setNewProjectName("");
      setNewProjectKey("");
      setNewProjectDesc("");
      setNewProjectParentId("");
      setCreateError("");
      setKeyError("");
      setIsKeyAvailable(null);
      setIsKeyManuallyEdited(false);
      // Navigate to the newly created project
      router.push(`/projects/${newProj.id}?tab=issues`);
    },
    onError: (err: Error) => {
      setCreateError(err.message || "Gagal membuat proyek baru.");
    },
  });

  const generateKeyFromName = (name: string): string => {
    const cleaned = name.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    let base = cleaned;
    if (base.length > 0 && !/^[A-Z]/.test(base)) {
      base = "P" + base;
    }
    let key = base.substring(0, 5);
    while (key.length > 0 && key.length < 5) {
      key += "X";
    }
    return key;
  };

  const handleNameChange = (val: string) => {
    setNewProjectName(val);
    if (!isKeyManuallyEdited) {
      const suggestedKey = generateKeyFromName(val);
      setNewProjectKey(suggestedKey);
      
      if (suggestedKey.length > 0 && !/^[A-Z][A-Z0-9_-]{1,9}$/.test(suggestedKey)) {
        setKeyError("Kode proyek harus alfanumerik (dapat berisi - atau _), 2-10 karakter, dan diawali dengan huruf.");
      } else {
        setKeyError("");
      }
      setIsKeyAvailable(null);
    }
  };

  const checkKeyUniqueness = async (keyToCheck: string) => {
    if (!/^[A-Z][A-Z0-9_-]{1,9}$/.test(keyToCheck)) {
      setKeyError("Kode proyek harus alfanumerik (dapat berisi - atau _), 2-10 karakter, dan diawali dengan huruf.");
      setIsKeyAvailable(false);
      return;
    }
    setIsCheckingKey(true);
    try {
      const res = await checkProjectKey(keyToCheck);
      setIsKeyAvailable(res.available);
      if (!res.available) {
        setKeyError("Kode Proyek sudah digunakan.");
      } else {
        setKeyError("");
      }
    } catch (err) {
      console.error("Error checking key uniqueness:", err);
    } finally {
      setIsCheckingKey(false);
    }
  };

  const handleKeyChange = (val: string) => {
    setIsKeyManuallyEdited(true);
    const cleaned = val.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    setNewProjectKey(cleaned.substring(0, 10));
    setIsKeyAvailable(null);

    if (cleaned.length > 0 && !/^[A-Z][A-Z0-9_-]{1,9}$/.test(cleaned)) {
      setKeyError("Kode proyek harus alfanumerik (dapat berisi - atau _), 2-10 karakter, dan diawali dengan huruf.");
    } else {
      setKeyError("");
    }
  };

  const handleKeyBlur = () => {
    if (newProjectKey) {
      checkKeyUniqueness(newProjectKey);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !newProjectKey.trim() || keyError) return;
    createMutation.mutate({
      name: newProjectName.trim(),
      key: newProjectKey.trim(),
      description: newProjectDesc.trim() || undefined,
      parentProjectId: newProjectParentId || undefined,
    });
  };

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Find currently active project
  const activeProject = useMemo(() => {
    return projects.find((p) => p.id === activeProjectId);
  }, [projects, activeProjectId]);

  // Sort and filter projects recursively
  const filteredAndSortedProjects = useMemo(() => {
    // 1. Group projects by hierarchy
    const roots = projects.filter((p) => !p.parentProjectId && !p.parent_project_id);
    const result: { project: Project; isSub: boolean }[] = [];

    roots.forEach((root) => {
      // Add root project
      result.push({ project: root, isSub: false });
      
      // Find and add immediate subprojects
      const subs = projects.filter(
        (p) => p.parentProjectId === root.id || p.parent_project_id === root.id
      );
      subs.forEach((sub) => {
        result.push({ project: sub, isSub: true });
      });
    });

    // Add orphans
    projects.forEach((p) => {
      if (!result.some((r) => r.project.id === p.id)) {
        result.push({ project: p, isSub: !!(p.parentProjectId || p.parent_project_id) });
      }
    });

    // 2. Filter based on search query
    if (!search.trim()) return result;
    return result.filter(({ project }) =>
      project.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [projects, search]);

  const handleSelectProject = (projectId: string) => {
    setIsOpen(false);
    // Read the last opened tab for this project from localStorage
    let lastTab = "issues";
    if (typeof window !== "undefined") {
      lastTab = localStorage.getItem(`trackflow:last-tab:${projectId}`) || "issues";
    }
    router.push(`/projects/${projectId}?tab=${lastTab}`);
  };

  return (
    <div className="relative inline-block text-left w-full" ref={popoverRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-md p-1.5 hover:bg-accent hover:text-accent-foreground text-left text-[13px] font-medium outline-none truncate gap-1 border border-transparent active:scale-[0.98] transition-all"
      >
        <div className="flex items-center gap-2 truncate">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground font-semibold text-[10px]">
            {activeProject ? (
              activeProject.name[0].toUpperCase()
            ) : (
              <FolderOpen className="h-3 w-3" />
            )}
          </div>
          <span className="truncate">
            {activeProject ? activeProject.name : "Pilih Proyek..."}
          </span>
        </div>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }} />
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-60 rounded-lg border border-border bg-card text-card-foreground shadow-md z-50 p-1 flex flex-col gap-1 anim-fade-in">
          {/* Search Box */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border/60">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Cari proyek..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-[12px] placeholder-muted-foreground focus:outline-none w-full text-foreground"
              autoFocus
            />
          </div>

          {/* List Area */}
          <div className="max-h-52 overflow-y-auto flex flex-col gap-0.5 p-0.5">
            {isLoading ? (
              <div className="flex items-center justify-center py-4 text-xs text-muted-foreground gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Memuat...</span>
              </div>
            ) : filteredAndSortedProjects.length === 0 ? (
              <div className="text-center py-4 text-xs text-muted-foreground italic">
                Tidak ada proyek ditemukan.
              </div>
            ) : (
              filteredAndSortedProjects.map(({ project, isSub }) => {
                const isActive = project.id === activeProjectId;
                return (
                  <button
                    key={project.id}
                    onClick={() => handleSelectProject(project.id)}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-md text-[12.5px] text-left transition-colors cursor-pointer group ${
                      isSub ? "pl-5 text-muted-foreground" : "text-foreground font-medium"
                    } ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {isSub && <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />}
                      <span className="truncate">{project.name}</span>
                    </div>
                    {isActive && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Create Button Footer */}
          <div className="border-t border-border/60 p-0.5 mt-0.5">
            <button
              onClick={() => {
                setIsOpen(false);
                setIsCreateOpen(true);
                setCreateError("");
              }}
              className="flex w-full items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-semibold text-primary hover:bg-primary/5 text-left cursor-pointer transition-colors"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              Buat Proyek Baru
            </button>
          </div>
        </div>
      )}

      {/* Create Project Modal Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <form onSubmit={handleCreateSubmit}>
            <DialogHeader>
              <DialogTitle className="text-[14px] font-semibold">Buat Proyek Baru</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-3.5 py-4 text-xs">
              {createError && (
                <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive leading-normal">
                  <AlertCircle className="h-3.5 w-3.5 mt-[1px] shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-proj-name" className="text-[11px] font-semibold text-muted-foreground">
                  Nama Proyek <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="new-proj-name"
                  type="text"
                  required
                  placeholder="Contoh: TrackFlow Web"
                  value={newProjectName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="h-8.5 text-[12px]"
                  disabled={createMutation.isPending}
                />
              </div>

              {/* Project Key */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="new-proj-key" className="text-[11px] font-semibold text-muted-foreground">
                    Kode Proyek (Project Key) <span className="text-red-500">*</span>
                  </Label>
                  {isCheckingKey && (
                    <span className="text-[10px] text-muted-foreground animate-pulse">Memeriksa...</span>
                  )}
                  {!isCheckingKey && isKeyAvailable === true && (
                    <span className="text-[10px] text-emerald-500 font-medium">Tersedia</span>
                  )}
                </div>
                <Input
                  id="new-proj-key"
                  type="text"
                  required
                  placeholder="Contoh: TRACK, MOB"
                  className={`h-8.5 text-[12px] uppercase ${keyError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  value={newProjectKey}
                  onChange={(e) => handleKeyChange(e.target.value)}
                  onBlur={handleKeyBlur}
                  disabled={createMutation.isPending}
                />
                {keyError && (
                  <span className="text-[10px] text-destructive mt-0.5">{keyError}</span>
                )}
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-proj-desc" className="text-[11px] font-semibold text-muted-foreground">
                  Deskripsi Proyek
                </Label>
                <textarea
                  id="new-proj-desc"
                  placeholder="Tulis ringkasan mengenai proyek ini..."
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  className="min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-[12px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  disabled={createMutation.isPending}
                />
              </div>

              {/* Parent Project Selector */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-proj-parent" className="text-[11px] font-semibold text-muted-foreground">
                  Proyek Induk (Opsional)
                </Label>
                <select
                  id="new-proj-parent"
                  value={newProjectParentId}
                  onChange={(e) => setNewProjectParentId(e.target.value)}
                  className="h-8.5 rounded-md border border-input bg-card px-2.5 text-[12px] outline-none"
                  disabled={createMutation.isPending}
                >
                  <option value="">-- Tanpa Proyek Induk (Proyek Utama) --</option>
                  {projects
                    .filter((p) => !p.parentProjectId && !p.parent_project_id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-8 text-[12px]"
                onClick={() => setIsCreateOpen(false)}
                disabled={createMutation.isPending}
              >
                Batal
              </Button>
              <Button type="submit" className="h-8 text-[12px]" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Membuat...
                  </>
                ) : (
                  "Buat Proyek"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
