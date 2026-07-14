import { invoke } from '@tauri-apps/api/core';

const BASE_URL = 'http://localhost:3000';

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

/**
 * Core request helper that automatically injects the Bearer token from the OS keyring
 */
async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${path}`;
  const headers = new Headers(options.headers || {});

  // 1. Get bearer token from Rust keyring securely
  try {
    const token = await invoke<string>('get_token');
    if (token && token.trim() !== '') {
      headers.set('Authorization', `Bearer ${token}`);
    }
  } catch (err) {
    console.error('[API Client] Failed to read token from keyring:', err);
  }

  // 2. Set default content type if body is present
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    let data: any = null;
    let errorMessage: string | null = null;

    if (response.status !== 204) {
      const text = await response.text();
      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        data = text;
      }
    }

    if (!response.ok) {
      errorMessage =
        data && typeof data === 'object' && data.message
          ? Array.isArray(data.message)
            ? data.message.join(', ')
            : String(data.message)
          : response.statusText || 'An error occurred';
    }

    return {
      data: response.ok ? (data as T) : null,
      error: errorMessage,
      status: response.status,
    };
  } catch (error: any) {
    console.error('[API Client] Request failed:', error);
    return {
      data: null,
      error: error.message || 'Network request failed',
      status: 0,
    };
  }
}

export const api = {
  get: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: any, options?: RequestInit) =>
    request<T>(path, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: any, options?: RequestInit) =>
    request<T>(path, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
