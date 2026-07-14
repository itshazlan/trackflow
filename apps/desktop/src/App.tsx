import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { api } from './lib/api';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

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
        const response = await api.get<{ session: any; user: any }>('/api/auth/session');

        if (response.error || !response.data) {
          console.warn('[App Auth] Session invalid, clearing token.', response.error);
          // Delete invalid token
          await invoke('delete_token');
          setUser(null);
        } else {
          // Session is valid
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
