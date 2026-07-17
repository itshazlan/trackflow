import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export function ScreenshotPreview() {
  const [screenshotPath, setScreenshotPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPreviewPath() {
      try {
        const path = await invoke<string | null>('get_preview_path');
        setScreenshotPath(path);
      } catch (err) {
        console.error('Failed to get preview path:', err);
      } finally {
        setLoading(false);
      }
    }
    void fetchPreviewPath();

    let unlistenFn: (() => void) | null = null;
    const setupListener = async () => {
      try {
        const unlisten = await listen('preview-path-changed', () => {
          void fetchPreviewPath();
        });
        unlistenFn = unlisten;
      } catch (err) {
        console.error('Failed to listen to preview-path-changed event:', err);
      }
    };
    void setupListener();

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="text-sm text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (!screenshotPath) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-white p-4">
        <div className="text-center">
          <div className="text-sm text-zinc-400">No preview screenshot found.</div>
          <button
            onClick={() => window.close()}
            className="mt-3 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded text-xs text-zinc-300 transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  // Get first path in case of comma-separated string
  const primaryPath = screenshotPath.split(',')[0];
  const imageSrc = convertFileSrc(primaryPath);

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-white overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-900 bg-zinc-950 select-none">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-zinc-200">Screenshot Preview</span>
          <span className="text-[9px] text-zinc-500 font-mono truncate max-w-[500px]" title={primaryPath}>
            {primaryPath}
          </span>
        </div>
        <button
          onClick={() => window.close()}
          className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>

      {/* Image Container */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-zinc-900/50">
        <img
          src={imageSrc}
          alt="Full Resolution Screenshot"
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-zinc-800/50"
        />
      </div>
    </div>
  );
}
