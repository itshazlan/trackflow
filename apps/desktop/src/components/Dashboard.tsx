import { useEffect, useState } from 'react';
import { api, BASE_URL } from '../lib/api';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { ChevronDown, LogOut, Play, Shield, User, Wifi } from 'lucide-react';

interface DashboardProps {
  user: any;
  onLogout: () => void;
}

interface TimerStateResponse {
  status: 'Idle' | 'Running' | 'Paused';
  start_time: number | null;
  accumulated_seconds: number;
}

interface ScreenshotEventPayload {
  path: string;
  window_title: string;
  app_name: string;
}

export function Dashboard({ user, onLogout }: DashboardProps) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [appVersion, setAppVersion] = useState('0.1.0');

  // Slicing: Project & Task Selection states
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [issues, setIssues] = useState<any[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string>('');
  const [activityNote, setActivityNote] = useState<string>('');
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Slicing: Timer states
  const [timerStatus, setTimerStatus] = useState<'Idle' | 'Running' | 'Paused'>('Idle');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [accumulatedSeconds, setAccumulatedSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Slicing: Accessibility Permission state
  const [hasPermission, setHasPermission] = useState(true);

  // Slicing: Screenshot Toast notification states
  const [showToast, setShowToast] = useState(false);
  const [toastDetails, setToastDetails] = useState<{
    appName: string;
    windowTitle: string;
  } | null>(null);

  // Sync / restore timer state helper
  const syncTimerState = async () => {
    try {
      const state = await invoke<TimerStateResponse>('get_timer_state');
      const validStatus = (state.status === 'Running' || state.status === 'Paused' || state.status === 'Idle')
        ? state.status
        : 'Idle';
      setTimerStatus(validStatus);
      setStartTime(state.start_time);
      setAccumulatedSeconds(state.accumulated_seconds);

      if (state.status === 'Running' && state.start_time) {
        const now = Math.floor(Date.now() / 1000);
        setElapsedSeconds(state.accumulated_seconds + (now - state.start_time));
      } else {
        setElapsedSeconds(state.accumulated_seconds);
      }
    } catch (err) {
      console.error('[Dashboard Timer] Failed to sync timer state:', err);
    }
  };

  // Check input hook accessibility permission periodically
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const allowed = await invoke<boolean>('check_input_permission');
        setHasPermission(allowed);
      } catch (err) {
        console.error('[Dashboard] Failed to check input permissions:', err);
      }
    };

    void checkPermission();

    const interval = setInterval(async () => {
      try {
        const allowed = await invoke<boolean>('check_input_permission');
        setHasPermission(allowed);
      } catch (err) {
        console.error('[Dashboard] Failed to check input permissions:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Listen for screenshot-taken event from Rust
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;
    let toastTimeout: ReturnType<typeof setTimeout> | null = null;

    const setupListener = async () => {
      try {
        const unlisten = await listen<ScreenshotEventPayload>('screenshot-taken', (event) => {
          const payload = event.payload;
          setToastDetails({
            appName: payload.app_name || 'System',
            windowTitle: payload.window_title || 'Active Screen',
          });
          setShowToast(true);

          // Play camera shutter sound
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav');
          audio.volume = 0.25;
          audio.play().catch((err) => {
            console.warn('[Dashboard Shutter] Audio play failed:', err);
          });

          // Automatically hide toast after 4 seconds
          if (toastTimeout) clearTimeout(toastTimeout);
          toastTimeout = setTimeout(() => {
            setShowToast(false);
          }, 4000);
        });
        unlistenFn = unlisten;
      } catch (err) {
        console.error('[Dashboard Notification] Failed to listen to screenshot-taken event:', err);
      }
    };

    void setupListener();

    return () => {
      if (unlistenFn) unlistenFn();
      if (toastTimeout) clearTimeout(toastTimeout);
    };
  }, []);

  // Initialize and restore active state on mount
  useEffect(() => {
    async function initDashboard() {
      setLoadingProjects(true);
      setError(null);

      // Load dynamic app version from Tauri configuration
      try {
        const version = await getVersion();
        setAppVersion(version);
      } catch (err) {
        console.error('Failed to get app version:', err);
      }

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
        const [activeProjId, activeIssueId, _activeIssueTitle, _activeNote] = await invoke<[string | null, string | null, string | null, string | null]>('get_active_task');

        if (activeProjId && projectList.some((p) => p.id === activeProjId)) {
          setSelectedProjectId(activeProjId);

          // Fetch issues for this project
          setLoadingIssues(true);
          const issuesRes = await api.get<any[]>(`/projects/${activeProjId}/issues`);

          if (!issuesRes.error && issuesRes.data) {
            // Filter issues assigned to this user and exclude Done issues
            const assignedIssues = issuesRes.data.filter(
              (issue: any) =>
                issue.assignee?.id === user.id &&
                issue.status?.name?.toLowerCase() !== 'done'
            );
            setIssues(assignedIssues);

            if (activeIssueId && assignedIssues.some((i) => i.id === activeIssueId)) {
              setSelectedIssueId(activeIssueId);
            } else if (!activeIssueId && _activeIssueTitle === 'Activity (Tanpa Tiket)') {
              setSelectedIssueId('activity');
              if (_activeNote) {
                setActivityNote(_activeNote);
              }
            }
          }
          setLoadingIssues(false);
        }
      } catch (err) {
        console.error('[Dashboard Init] Failed to restore active task:', err);
      }

      // 3. Load active timer state from Rust core
      await syncTimerState();

      setLoadingProjects(false);
    }

    void initDashboard();
  }, [user.id]);

  // Real-time UI elapsed counter effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (timerStatus === 'Running' && startTime) {
      interval = setInterval(() => {
        const now = Math.floor(Date.now() / 1000);
        setElapsedSeconds(accumulatedSeconds + (now - startTime));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerStatus, startTime, accumulatedSeconds]);

  // Listen for timer-state-changed event from Rust (synchronized from tray menu actions)
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;

    const setupListener = async () => {
      try {
        const unlisten = await listen<TimerStateResponse>('timer-state-changed', (event) => {
          const state = event.payload;
          setTimerStatus(state.status);
          setStartTime(state.start_time);
          setAccumulatedSeconds(state.accumulated_seconds);

          if (state.status === 'Running' && state.start_time) {
            const now = Math.floor(Date.now() / 1000);
            setElapsedSeconds(state.accumulated_seconds + (now - state.start_time));
          } else {
            setElapsedSeconds(state.accumulated_seconds);
          }
        });
        unlistenFn = unlisten;
      } catch (err) {
        console.error('[Dashboard Timer Listener] Failed to listen to timer-state-changed:', err);
      }
    };

    void setupListener();

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  // Dynamic window resizing based on task selection
  useEffect(() => {
    async function adjustWindowSize() {
      try {
        const win = getCurrentWindow();
        if (win.label === 'main') {
          if (selectedIssueId === 'activity') {
            await win.setSize(new LogicalSize(460, 640));
          } else {
            await win.setSize(new LogicalSize(460, 580));
          }
        }
      } catch (err) {
        console.warn('[Dashboard Resize] Failed to resize window:', err);
      }
    }
    void adjustWindowSize();
  }, [selectedIssueId]);

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
        issueTitle: null,
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
        (issue: any) =>
          issue.assignee?.id === user.id &&
          issue.status?.name?.toLowerCase() !== 'done'
      );
      setIssues(assignedIssues);
    }
    setLoadingIssues(false);
  };

  const handleIssueChange = async (issueId: string) => {
    setSelectedIssueId(issueId);
    setError(null);

    let resolvedIssueId: string | null = null;
    let resolvedIssueTitle: string | null = null;
    let resolvedNote: string | null = null;

    if (issueId === 'activity') {
      resolvedIssueTitle = 'Activity (Tanpa Tiket)';
      resolvedNote = activityNote || null;
    } else {
      const selectedIssue = issues.find((issue) => issue.id === issueId);
      resolvedIssueId = issueId || null;
      resolvedIssueTitle = selectedIssue ? selectedIssue.title : null;
    }

    // Sync state to Rust
    try {
      await invoke('set_active_task', {
        projectId: selectedProjectId || null,
        issueId: resolvedIssueId,
        issueTitle: resolvedIssueTitle,
        note: resolvedNote,
      });
    } catch (err) {
      console.error('[Dashboard] Failed to sync active task to Rust:', err);
    }
  };

  const handleNoteChange = async (noteVal: string) => {
    setActivityNote(noteVal);
    if (selectedIssueId === 'activity') {
      try {
        await invoke('set_active_task', {
          projectId: selectedProjectId || null,
          issueId: null,
          issueTitle: 'Activity (Tanpa Tiket)',
          note: noteVal || null,
        });
      } catch (err) {
        console.error('[Dashboard] Failed to sync note to Rust:', err);
      }
    }
  };

  const handleStartTimer = async () => {
    setError(null);
    try {
      await invoke('start_timer');
      await syncTimerState();
    } catch (err: any) {
      setError(String(err));
    }
  };

  const handlePauseTimer = async () => {
    setError(null);
    try {
      await invoke('pause_timer');
      await syncTimerState();
    } catch (err: any) {
      setError(String(err));
    }
  };

  const handleStopTimer = async () => {
    setError(null);
    try {
      await invoke('stop_timer');
      await syncTimerState();
    } catch (err: any) {
      setError(String(err));
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      // Best effort timer stop on logout
      await invoke('stop_timer');
    } catch (e) {
      console.warn('[Dashboard] Stop timer on logout error:', e);
    }

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
      await invoke('set_active_task', { projectId: null, issueId: null, issueTitle: null });
    } catch (err) {
      console.error('[Dashboard] Failed to delete token from keychain:', err);
    }

    setLoggingOut(false);
    onLogout();
  };

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num: number) => String(num).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground animate-in fade-in duration-300">
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
      <main className="flex-1 overflow-y-auto p-4 flex flex-col justify-center space-y-4">
        {/* Permission Warning Banner */}
        {!hasPermission && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3.5 flex flex-col space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-start space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-amber-500 shrink-0 mt-0.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-semibold text-amber-500">
                  Accessibility Permission Required
                </h4>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">
                  TrackFlow requires Accessibility permission to measure global keyboard and mouse activity levels. Without it, your activity level will be recorded as "none".
                </p>
              </div>
            </div>
            <div className="text-[9px] text-muted-foreground bg-[#0a0a0c] p-2 rounded border border-border">
              Go to <strong className="text-foreground">System Settings &gt; Privacy & Security &gt; Accessibility</strong> and enable <strong className="text-foreground">TrackFlow (or Terminal/VSCode if in development)</strong>.
            </div>
          </div>
        )}

        {/* User Card */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center space-x-3">
            {user.image ? (
              <img
                src={
                  user.image.startsWith('/')
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
                  disabled={timerStatus !== 'Idle'}
                  className="w-full appearance-none rounded border border-input bg-background py-2 pl-3 pr-10 text-xs text-foreground focus:border-foreground focus:ring-1 focus:ring-foreground focus:outline-none transition-colors cursor-pointer disabled:opacity-50"
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
              <div className="space-y-2">
                <div className="relative">
                  <select
                    value={selectedIssueId}
                    onChange={(e) => handleIssueChange(e.target.value)}
                    disabled={timerStatus !== 'Idle' || !selectedProjectId}
                    className="w-full appearance-none rounded border border-input bg-background py-2 pl-3 pr-10 text-xs text-foreground focus:border-foreground focus:ring-1 focus:ring-foreground focus:outline-none disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {!selectedProjectId ? (
                      <option value="" className="bg-[#0a0a0c]">Select a project first...</option>
                    ) : (
                      <>
                        <option value="" className="bg-[#0a0a0c]">Select a task...</option>
                        <option value="activity" className="bg-[#0a0a0c]">Activity (Tanpa Tiket)</option>
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

                {selectedIssueId === 'activity' && (
                  <div className="space-y-1 pt-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Deskripsi (opsional)
                    </label>
                    <input
                      type="text"
                      value={activityNote}
                      onChange={(e) => handleNoteChange(e.target.value)}
                      disabled={timerStatus !== 'Idle'}
                      placeholder="Apa yang sedang Anda kerjakan?"
                      className="w-full rounded border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-foreground focus:ring-1 focus:ring-foreground focus:outline-none transition-colors"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons & Status Card */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Time Tracker
            </h3>
            <div className="flex items-center space-x-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${timerStatus === 'Running' ? 'bg-emerald-500 animate-pulse' :
                  timerStatus === 'Paused' ? 'bg-amber-500 animate-pulse' : 'bg-muted-foreground'
                }`} />
              <span className="text-[10px] font-medium text-muted-foreground">
                {timerStatus} {timerStatus !== 'Idle' && `(${formatTime(elapsedSeconds)})`}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex space-x-2.5">
            {timerStatus === 'Idle' || timerStatus === 'Paused' ? (
              <button
                onClick={handleStartTimer}
                disabled={!selectedProjectId || !selectedIssueId}
                className="flex-1 flex items-center justify-center space-x-1.5 bg-foreground text-background font-semibold py-2 px-4 rounded text-xs hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>{timerStatus === 'Paused' ? 'Resume' : 'Start'}</span>
              </button>
            ) : (
              <button
                onClick={handlePauseTimer}
                className="flex-1 flex items-center justify-center space-x-1.5 bg-secondary hover:bg-secondary/80 text-foreground font-semibold py-2 px-4 rounded text-xs transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><rect x="14" y="4" width="4" height="16" rx="1"></rect><rect x="6" y="4" width="4" height="16" rx="1"></rect></svg>
                <span>Pause</span>
              </button>
            )}

            {timerStatus !== 'Idle' && (
              <button
                onClick={handleStopTimer}
                className="flex-1 flex items-center justify-center space-x-1.5 bg-destructive/10 hover:bg-destructive/25 text-destructive-foreground font-semibold py-2 px-4 rounded text-xs transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><rect x="4" y="4" width="16" height="16" rx="1"></rect></svg>
                <span>Stop</span>
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Toast Notification for Screenshot */}
      {showToast && toastDetails && (
        <div className="fixed bottom-12 left-4 right-4 z-50 rounded-lg border border-emerald-500/20 bg-emerald-950/90 backdrop-blur-md p-3.5 flex items-center space-x-3 shadow-lg shadow-emerald-950/20 animate-in slide-in-from-bottom-6 duration-300">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
              Screenshot Captured
            </h4>
            <p className="text-[10px] text-foreground font-medium truncate mt-0.5">
              {toastDetails.appName}
            </p>
            <p className="text-[9px] text-muted-foreground truncate leading-normal">
              {toastDetails.windowTitle}
            </p>
          </div>
        </div>
      )}

      {/* Footer bar */}
      <footer className="border-t border-border bg-card px-4 py-2 text-[9px] text-muted-foreground flex justify-between">
        <span>Desktop Client v{appVersion}</span>
        <span>Secure Storage Enabled</span>
      </footer>
    </div>
  );
}
