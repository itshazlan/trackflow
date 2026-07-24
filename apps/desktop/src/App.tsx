import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { api } from './lib/api';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { ScreenshotReview } from './components/ScreenshotReview';
import { ScreenshotPreview } from './components/ScreenshotPreview';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [windowLabel, setWindowLabel] = useState<string>('main');
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const label = getCurrentWindow().label;
      setWindowLabel(label);
      if (label === 'screenshot-widget') {
        document.documentElement.classList.add('screenshot-widget-window');
        document.documentElement.style.backgroundColor = 'transparent';
        document.body.style.backgroundColor = 'transparent';
        const root = document.getElementById('root');
        if (root) {
          root.style.backgroundColor = 'transparent';
        }
      }
    } catch (e) {
      console.warn('[App] Failed to get window label:', e);
    }
  }, []);

  useEffect(() => {
    async function checkAuth() {
      try {
        // 1. Retrieve the token from OS Keychain
        const token = await invoke<string>('get_token');

        if (!token || token.trim() === '') {
          setUser(null);
          setLoading(false);
          return;
        }

        // 2. Verify token validity by fetching session from backend
        console.log('[App Auth] Found token in keychain, verifying session with backend...');
        const response = await api.get<{ session: any; user: any }>('/api/auth/get-session');
        console.log('[App Auth] Session response:', {
          status: response.status,
          hasData: !!response.data,
          error: response.error,
        });

        if (response.status === 401) {
          console.warn('[App Auth] Session invalid (401), clearing token from keychain.');
          await invoke('delete_token');
          setUser(null);
        } else if (response.error) {
          console.warn('[App Auth] Connection/validation error (status ' + response.status + '). Retaining token in keychain.', response.error);
          setUser(null);
        } else if (response.data) {
          // Session is valid
          console.log('[App Auth] Session valid, logging in user:', response.data.user.email);
          setUser(response.data.user);
        }
      } catch (err) {
        console.error('[App Auth] Error verifying session:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    void checkAuth();
  }, []);

  // Slicing: Global Sync Service event handler for 401 Unauthorized token expirations
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;

    const setupListener = async () => {
      try {
        const unlisten = await listen('sync-unauthorized', async () => {
          console.warn('[App Auth] Received sync-unauthorized from background sync service. Session expired. Redirecting to login...');
          try {
            await invoke('delete_token');
            await invoke('set_active_task', { projectId: null, issueId: null });
          } catch (e) {
            console.error('[App Auth] Failed to clean up token/task on unauthorized event:', e);
          }
          setUser(null);
        });
        unlistenFn = unlisten;
      } catch (err) {
        console.error('[App Auth] Failed to register sync-unauthorized listener:', err);
      }
    };

    void setupListener();

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  if (windowLabel === 'screenshot-widget') {
    return <ScreenshotReview />;
  }

  if (windowLabel === 'screenshot-preview') {
    return <ScreenshotPreview />;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Initializing TrackFlow...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={(u) => setUser(u)} />;
  }

  return <Dashboard user={user} onLogout={() => setUser(null)} />;
}
