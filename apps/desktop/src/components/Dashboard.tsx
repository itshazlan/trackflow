import { useState } from 'react';
import { api, BASE_URL } from '../lib/api';
import { invoke } from '@tauri-apps/api/core';
import { LogOut, Play, Shield, User, Wifi } from 'lucide-react';

interface DashboardProps {
  user: any;
  onLogout: () => void;
}

export function Dashboard({ user, onLogout }: DashboardProps) {
  const [loggingOut, setLoggingOut] = useState(false);

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

        {/* Tasks Scaffolding Card */}
        <div className="rounded-lg border border-border border-dashed bg-card/50 p-6 flex flex-col items-center justify-center text-center space-y-3">
          <div className="rounded-full bg-secondary p-3 border border-border">
            <Play className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xs font-medium text-foreground">
              Ready to Track Time
            </h3>
            <p className="text-[10px] text-muted-foreground max-w-[240px]">
              Foundation is ready. Next slice will load your assigned projects
              and active tasks to start the timer.
            </p>
          </div>
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
