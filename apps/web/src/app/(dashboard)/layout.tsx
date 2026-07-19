"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { getSession, logout, UserSession } from "@/lib/auth-service";
import { getProjects, Project } from "@/lib/projects-service";
import { useQuery } from "@tanstack/react-query";
import ProjectSwitcher from "@/components/project/project-switcher";
import ProfileModal from "@/components/profile-modal";
import NotificationBell from "@/components/notification-bell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { useTheme } from "next-themes";
import {
  LayoutGrid,
  Loader2,
  LogOut,
  Clock,
  Settings,
  LineChart,
  CheckSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Timer,
  User as UserIcon,
  FileText,
  Sun,
  Moon,
} from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const projectId = params?.id as string | undefined;

  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const reloadSession = async () => {
    try {
      const s = await getSession();
      setSession(s);
    } catch (err) {
      console.error("Failed to reload session", err);
    }
  };

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: getProjects,
  });

  useEffect(() => {
    async function loadData() {
      try {
        const s = await getSession();
        if (!s) {
          // Hapus cookie better-auth secara manual di sisi client untuk mencegah loop redirect di middleware
          document.cookie = "better-auth.session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          document.cookie = "__Secure-better-auth.session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          document.cookie = "__secure-better-auth.session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          
          try {
            await logout();
          } catch (logoutErr) {
            console.error("Gagal memanggil API logout pada sesi tidak valid:", logoutErr);
          }
          
          router.push("/login");
          return;
        }
        setSession(s);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    }
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentProject = projects.find((p) => p.id === projectId);

  const navigationItems = [
    {
      id: "projects",
      label: "Projects",
      icon: LayoutGrid,
      href: "/projects",
    },
    {
      id: "issues",
      label: "Issues",
      icon: CheckSquare,
      href: projectId ? `/projects/${projectId}?tab=issues` : null,
    },
    {
      id: "timebook",
      label: "Time Book",
      icon: Clock,
      href: projectId ? `/projects/${projectId}?tab=timebook` : null,
    },
    {
      id: "reports",
      label: "Reports",
      icon: LineChart,
      href: projectId ? `/reports?projectId=${projectId}` : "/reports",
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      href: projectId ? `/projects/${projectId}?tab=settings` : null,
    },
    {
      id: "timesheets",
      label: "Timesheets & Approval",
      icon: FileText,
      href: "/timesheets",
    },
  ];

  const userInitials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "TF";

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={`flex h-full flex-col border-r border-border bg-card text-card-foreground transition-all duration-150 ease-in-out shrink-0 select-none ${
          sidebarOpen ? "w-60" : "w-14"
        }`}
      >
        {/* Sidebar Header: Project Switcher */}
        <div className="flex h-12 items-center justify-between border-b border-border px-3">
          {sidebarOpen ? (
            <ProjectSwitcher />
          ) : (
            <button
              onClick={() => router.push("/projects")}
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-accent mx-auto"
              title="Semua Proyek"
            >
              <Timer className="h-4.5 w-4.5" />
            </button>
          )}
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 space-y-1 p-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const disabled = !item.href;
            const isActive = item.href && (
              item.id === "projects"
                ? pathname === "/projects"
                : item.id === "timesheets"
                ? pathname.startsWith("/timesheets")
                : item.id === "reports"
                ? pathname.startsWith("/reports")
                : pathname.startsWith(projectId ? `/projects/${projectId}` : "_") && pathname.includes(item.id)
            );

            const content = (
              <div
                className={`flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors ${
                  disabled
                    ? "opacity-40 cursor-not-allowed text-muted-foreground"
                    : isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0`} />
                {sidebarOpen && <span>{item.label}</span>}
              </div>
            );

            if (disabled) {
              return <div key={item.id}>{content}</div>;
            }

            return (
              <Link key={item.id} href={item.href!} className="block outline-none">
                {content}
              </Link>
            );
          })}
        </nav>

        {/* Admin Navigation */}
        {session?.user?.isAdmin && (
          <div className="mt-4 px-2">
            {sidebarOpen && (
              <span className="px-2.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Administrasi
              </span>
            )}
            <nav className="space-y-1">
              <Link href="/admin/settings" className="block outline-none">
                <div
                  className={`flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors ${
                    pathname.startsWith("/admin/settings")
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                  }`}
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  {sidebarOpen && <span>App Settings</span>}
                </div>
              </Link>
              <Link href="/admin/users" className="block outline-none">
                <div
                  className={`flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors ${
                    pathname.startsWith("/admin/users")
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                  }`}
                >
                  <UserIcon className="h-4 w-4 shrink-0" />
                  {sidebarOpen && <span>Users &amp; Roles</span>}
                </div>
              </Link>
            </nav>
          </div>
        )}

        {/* Sidebar Footer: Profile */}
        <div className="border-t border-border p-2">
          {sidebarOpen ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button className="flex w-full items-center gap-2.5 rounded-md p-1.5 hover:bg-accent text-left outline-none" />
                }
              >
                <Avatar className="h-6 w-6">
                  {session?.user?.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <AvatarFallback className="text-[10px] font-bold">
                      {userInitials}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1 truncate">
                  <p className="text-[12px] font-medium truncate leading-none">
                    {session?.user?.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {session?.user?.email}
                  </p>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-50">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground px-2 py-1.5">
                    Akun Anda
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsProfileOpen(true)} className="text-[13px] cursor-pointer">
                  <UserIcon className="h-4 w-4 mr-2" />
                  Profil Saya
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-[13px] cursor-pointer">
                    <Sun className="h-4 w-4 mr-2 dark:hidden" />
                    <Moon className="h-4 w-4 mr-2 hidden dark:block" />
                    Tema Tampilan
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-36">
                    <DropdownMenuItem onClick={() => setTheme("light")} className="text-[13px] cursor-pointer">
                      <Sun className="h-4 w-4 mr-2" />
                      Terang
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("dark")} className="text-[13px] cursor-pointer">
                      <Moon className="h-4 w-4 mr-2" />
                      Gelap
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("system")} className="text-[13px] cursor-pointer">
                      <Settings className="h-4 w-4 mr-2" />
                      Sistem
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive text-[13px] cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button className="flex h-8 w-8 items-center justify-center rounded hover:bg-accent mx-auto outline-none" />
                }
              >
                <Avatar className="h-5 w-5">
                  {session?.user?.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <AvatarFallback className="text-[9px] font-bold">
                      {userInitials}
                    </AvatarFallback>
                  )}
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                <DropdownMenuItem onClick={() => setIsProfileOpen(true)} className="text-[13px] cursor-pointer">
                  <UserIcon className="h-4 w-4 mr-2" />
                  Profil Saya
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-[13px] cursor-pointer">
                    <Sun className="h-4 w-4 mr-2 dark:hidden" />
                    <Moon className="h-4 w-4 mr-2 hidden dark:block" />
                    Tema
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-36">
                    <DropdownMenuItem onClick={() => setTheme("light")} className="text-[13px] cursor-pointer">
                      <Sun className="h-4 w-4 mr-2" />
                      Terang
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("dark")} className="text-[13px] cursor-pointer">
                      <Moon className="h-4 w-4 mr-2" />
                      Gelap
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("system")} className="text-[13px] cursor-pointer">
                      <Settings className="h-4 w-4 mr-2" />
                      Sistem
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive text-[13px] cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex flex-1 flex-col overflow-hidden bg-background">
        {/* Topbar */}
        <header className="flex h-12 items-center justify-between border-b border-border bg-card px-4 shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </Button>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
              {currentProject ? (
                <>
                  <Link href="/projects" className="text-muted-foreground hover:underline">
                    Projects
                  </Link>
                  <span className="text-muted-foreground">/</span>
                  <span>{currentProject.name}</span>
                </>
              ) : (
                <span>Projects</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {session?.user?.isAdmin && (
              <span className="rounded bg-primary/15 border border-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary uppercase">
                Admin
              </span>
            )}
            {session?.user?.id && (
              <NotificationBell userId={session.user.id} />
            )}
            <Avatar className="h-6 w-6 border border-border">
              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <AvatarFallback className="text-[10px] font-semibold">
                  {userInitials}
                </AvatarFallback>
              )}
            </Avatar>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* User Profile Modal */}
      <ProfileModal
        open={isProfileOpen}
        onOpenChange={setIsProfileOpen}
        onSuccess={reloadSession}
      />
    </div>
  );
}
