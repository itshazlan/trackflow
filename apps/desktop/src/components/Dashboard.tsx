import { useEffect, useState } from 'react';
import { api, BASE_URL } from '../lib/api';
import { invoke } from '@tauri-apps/api/core';
import { ChevronDown, LogOut, Play, Shield, User, Wifi } from 'lucide-react';

interface DashboardProps {
  user: any;
  onLogout: () => void;
}

export function Dashboard({ user, onLogout }: DashboardProps) {
  const [loggingOut, setLoggingOut] = useState(false);

  // Slicing: Project & Task Selection states
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [issues, setIssues] = useState<any[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string>('');
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize and restore active state on mount
  useEffect(() => {
    async function initDashboard() {
      setLoadingProjects(true);
      setError(null);

      // 1. Fetch projects from backend
      const res = await api.get<any[]>('/projects');
      if (res.error) {
        setError('Failed to load projects: ' + res.error);
        setLoadingProjects(false);
        return;
      }

      const projectList = res.data || [];
      setProjects(projectList);

      // 2. Check if there's an active tracking task stored in Rust core
      try {
        const [activeProjId, activeIssueId] = await invoke<[string | null, string | null]>('get_active_task');
        
        if (activeProjId && projectList.some((p) => p.id === activeProjId)) {
          setSelectedProjectId(activeProjId);

          // Fetch issues for this project
          setLoadingIssues(true);
          const issuesRes = await api.get<any[]>(`/projects/${activeProjId}/issues`);
          
          if (!issuesRes.error && issuesRes.data) {
            // Filter issues assigned to this user
            const assignedIssues = issuesRes.data.filter(
              (issue: any) => issue.assignee?.id === user.id
            );
            setIssues(assignedIssues);

            if (activeIssueId && assignedIssues.some((i) => i.id === activeIssueId)) {
              setSelectedIssueId(activeIssueId);
            }
          }
          setLoadingIssues(false);
        }
      } catch (err) {
        console.error('[Dashboard Init] Failed to restore active task:', err);
      } finally {
        setLoadingProjects(false);
      }
    }

    void initDashboard();
  }, [user.id]);

  const handleProjectChange = async (projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedIssueId('');
    setIssues([]);
    setError(null);

    // Sync state to Rust (clear active task since project changed)
    try {
      await invoke('set_active_task', {
        projectId: projectId || null,
        issueId: null,
      });
    } catch (err) {
      console.error('[Dashboard] Failed to sync active task to Rust:', err);
    }

    if (!projectId) return;

    setLoadingIssues(true);
    const res = await api.get<any[]>(`/projects/${projectId}/issues`);
    if (res.error) {
      setError('Failed to load tasks: ' + res.error);
    } else if (res.data) {
      const assignedIssues = res.data.filter(
        (issue: any) => issue.assignee?.id === user.id
      );
      setIssues(assignedIssues);
    }
    setLoadingIssues(false);
  };

  const handleIssueChange = async (issueId: string) => {
    setSelectedIssueId(issueId);
    setError(null);

    // Sync state to Rust
    try {
      await invoke('set_active_task', {
        projectId: selectedProjectId || null,
        issueId: issueId || null,
      });
    } catch (err) {
      console.error('[Dashboard] Failed to sync active task to Rust:', err);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      // Call backend sign-out (optional, best effort)
      await api.post('/api/auth/sign-out');
    } catch (e) {
      console.warn('[Dashboard] Backend logout error:', e);
    }

    try {
      // Delete token from OS Keychain
      await invoke('delete_token');
      // Also clear active task in Rust core
      await invoke('set_active_task', { projectId: null, issueId: null });
    } catch (err) {
      console.error('[Dashboard] Failed to delete token from keychain:', err);
    }

    setLoggingOut(false);
    onLogout();
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Header bar */}
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center space-x-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
            TrackFlow
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
            <Wifi className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[10px] font-medium">Connected</span>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center space-x-1 text-xs text-muted-foreground hover:text-destructive-foreground hover:bg-destructive/10 p-1 rounded transition-colors disabled:opacity-50"
            title="Log Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* User Card */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center space-x-3">
            {user.image ? (
              <img
                src={
                  user.image.startsWith('/api/uploads/')
                    ? `${BASE_URL}${user.image.replace('/api/uploads/', '/uploads/')}`
                    : user.image.startsWith('/')
                    ? `${BASE_URL}${user.image}`
                    : user.image
                }
                alt={user.name || 'User Avatar'}
                className="h-9 w-9 rounded-full object-cover border border-border"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.parentElement?.querySelector('.avatar-fallback');
                  if (fallback) {
                    fallback.classList.remove('hidden');
                  }
                }}
              />
            ) : null}
            <div className={`avatar-fallback flex h-9 w-9 items-center justify-center rounded-full bg-secondary border border-border ${user.image ? 'hidden' : ''}`}>
              <User className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-foreground">
                {user.name || user.username || 'Employee'}
              </h2>
              <p className="text-[10px] text-muted-foreground">
                {user.email || 'developer@trackflow.com'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 pt-1.5 border-t border-border">
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              Role:{' '}
              <strong className="text-foreground">
                {user.isAdmin ? 'Administrator' : 'Developer'}
              </strong>
            </span>
          </div>
        </div>

        {/* Project & Task Selector Card */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-4 shadow-sm">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Task Selection
          </h3>

          {error && (
            <div className="rounded border border-destructive/50 bg-destructive/10 p-2.5 text-[11px] text-destructive-foreground">
              {error}
            </div>
          )}

          {/* Project Selection */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Project
            </label>
            {loadingProjects ? (
              <div className="h-8 w-full rounded border border-border bg-secondary animate-pulse" />
            ) : (
              <div className="relative">
                <select
                  value={selectedProjectId}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  className="w-full appearance-none rounded border border-input bg-background py-2 pl-3 pr-10 text-xs text-foreground focus:border-foreground focus:ring-1 focus:ring-foreground focus:outline-none transition-colors cursor-pointer"
                >
                  <option value="" className="bg-[#0a0a0c]">Select a project...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id} className="bg-[#0a0a0c]">
                      {project.name}
                    </option>
                  ))}
                </select>
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground">
                  <ChevronDown className="h-4 w-4" />
                </span>
              </div>
            )}
          </div>

          {/* Task/Issue Selection */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Assigned Task
            </label>
            {loadingIssues ? (
              <div className="h-8 w-full rounded border border-border bg-secondary animate-pulse" />
            ) : (
              <div className="relative">
                <select
                  value={selectedIssueId}
                  onChange={(e) => handleIssueChange(e.target.value)}
                  disabled={!selectedProjectId || issues.length === 0}
                  className="w-full appearance-none rounded border border-input bg-background py-2 pl-3 pr-10 text-xs text-foreground focus:border-foreground focus:ring-1 focus:ring-foreground focus:outline-none disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {!selectedProjectId ? (
                    <option value="" className="bg-[#0a0a0c]">Select a project first...</option>
                  ) : issues.length === 0 ? (
                    <option value="" className="bg-[#0a0a0c]">No tasks assigned to you</option>
                  ) : (
                    <>
                      <option value="" className="bg-[#0a0a0c]">Select a task...</option>
                      {issues.map((issue) => (
                        <option key={issue.id} value={issue.id} className="bg-[#0a0a0c]">
                          {issue.displayId ? `[${issue.displayId}] ` : ''}{issue.title}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground">
                  <ChevronDown className="h-4 w-4" />
                </span>
              </div>
            )}
          </div>

          {/* Active Tracker Feedback */}
          {selectedIssueId && (
            <div className="flex items-center space-x-3 pt-3 border-t border-border">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <Play className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-foreground truncate">
                  Active Task Configured
                </p>
                <p className="text-[9px] text-muted-foreground truncate">
                  Rust Core tracking state synchronized successfully.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer bar */}
      <footer className="border-t border-border bg-card px-4 py-2 text-[9px] text-muted-foreground flex justify-between">
        <span>Desktop Client v0.1.0</span>
        <span>Secure Storage Enabled</span>
      </footer>
    </div>
  );
}
