import { useState } from 'react';
import { api } from '../lib/api';
import { invoke } from '@tauri-apps/api/core';
import { Eye, EyeOff, Loader2, Lock, User } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: any) => void;
}

// Deliberately generic — mirrors the web app's behavior of not revealing
// whether a username exists, whether login failed on identifier resolution
// or on the password itself.
const GENERIC_ERROR_MSG = 'Username/email atau password salah';

async function resolveIdentifier(identifier: string): Promise<string> {
  const trimmed = identifier.trim();
  if (trimmed.includes('@')) {
    return trimmed;
  }

  const res = await api.post<{ email: string }>('/auth/resolve-identifier', {
    identifier: trimmed,
  });

  if (res.error || !res.data) {
    throw new Error(GENERIC_ERROR_MSG);
  }

  return res.data.email;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError('Username/email dan password wajib diisi');
      return;
    }

    setLoading(true);
    setError(null);

    let email: string;
    try {
      email = await resolveIdentifier(identifier);
    } catch (err) {
      setError(GENERIC_ERROR_MSG);
      setLoading(false);
      return;
    }

    const response = await api.post<{ token: string; user: any }>(
      '/api/auth/sign-in/email',
      { email, password }
    );

    if (response.error || !response.data) {
      setError(GENERIC_ERROR_MSG);
      setLoading(false);
      return;
    }

    try {
      const { token, user } = response.data;

      // Save token securely in OS Keychain
      await invoke('save_token', { token });

      onLoginSuccess(user);
    } catch (err: any) {
      console.error('[Login] Failed to save token:', err);
      setError('Authentication succeeded, but secure token storage failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-card p-6 shadow-2xl">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="rounded-full bg-foreground/10 p-3">
            <svg
              className="h-6 w-6 text-foreground"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            TrackFlow Desktop
          </h1>
          <p className="text-xs text-muted-foreground">
            Sign in to start tracking your tasks
          </p>
        </div>

        {error && (
          <div className="rounded border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive-foreground">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1">
            <label
              htmlFor="identifier"
              className="text-xs font-medium text-muted-foreground"
            >
              Username atau Email
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                <User className="h-4 w-4" />
              </span>
              <input
                id="identifier"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="developer atau developer@trackflow.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={loading}
                className="w-full rounded border border-input bg-background py-2 pl-10 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-foreground focus:ring-1 focus:ring-foreground focus:outline-none disabled:opacity-50"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="text-xs font-medium text-muted-foreground"
            >
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                <Lock className="h-4 w-4" />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full rounded border border-input bg-background py-2 pl-10 pr-10 text-xs text-foreground placeholder:text-muted-foreground focus:border-foreground focus:ring-1 focus:ring-foreground focus:outline-none disabled:opacity-50"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center rounded bg-primary py-2 text-xs font-medium text-primary-foreground hover:bg-primary/95 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
