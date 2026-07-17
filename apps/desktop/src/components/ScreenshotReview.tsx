import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Eye, Check, Trash2, Clock } from 'lucide-react';

interface PendingReviewData {
  id: string;
  screenshot_path: string;
}

export function ScreenshotReview() {
  const [data, setData] = useState<PendingReviewData | null>(null);
  const [countdown, setCountdown] = useState(90);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPendingReview() {
      try {
        const res = await invoke<PendingReviewData | null>('get_pending_review');
        if (res) {
          setData(res);
          setCountdown(90);
          setError(null);
        } else {
          setError('No pending screenshot found.');
        }
      } catch (err) {
        console.error('Failed to get pending review:', err);
        setError('Error loading screenshot.');
      } finally {
        setLoading(false);
      }
    }
    void fetchPendingReview();

    let unlistenFn: (() => void) | null = null;
    const setupListener = async () => {
      try {
        const unlisten = await listen('review-data-changed', () => {
          void fetchPendingReview();
        });
        unlistenFn = unlisten;
      } catch (err) {
        console.error('Failed to listen to review-data-changed event:', err);
      }
    };
    void setupListener();

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  // 90 seconds countdown effect
  useEffect(() => {
    if (loading || error || !data) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          void handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, error, data]);

  const handleSubmit = async () => {
    if (!data) return;
    try {
      await invoke('submit_review', { id: data.id });
    } catch (err) {
      console.error('Failed to submit review:', err);
    }
  };

  const handleDiscard = async () => {
    if (!data) return;
    try {
      await invoke('discard_review', { id: data.id });
    } catch (err) {
      console.error('Failed to discard review:', err);
    }
  };

  const handlePreview = async () => {
    if (!data) return;
    try {
      // If screenshot_path contains multiple comma-separated screenshots, get the first one
      const primaryPath = data.screenshot_path.split(',')[0];
      await invoke('open_preview_window', { screenshotPath: primaryPath });
    } catch (err) {
      console.error('Failed to open preview:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950/90 text-white rounded-2xl border border-zinc-800 backdrop-blur-md">
        <div className="text-xs text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950/90 text-white rounded-2xl border border-zinc-800 backdrop-blur-md p-4">
        <div className="text-center">
          <div className="text-xs text-zinc-400">{error || 'No review data'}</div>
          <button
            onClick={() => window.close()}
            className="mt-2 text-[10px] bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded text-zinc-300"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Get the first screenshot path from the list (which can be comma-separated)
  const primaryScreenshotPath = data.screenshot_path.split(',')[0];
  const imageSrc = convertFileSrc(primaryScreenshotPath);

  return (
    <div className="flex h-screen flex-col justify-between bg-zinc-950/95 text-white p-3.5 rounded-2xl border border-zinc-800/80 shadow-2xl backdrop-blur-lg overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          Screenshot Captured
        </span>
        <div className="flex items-center space-x-1 text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded text-[10px] font-bold">
          <Clock className="h-3 w-3" />
          <span>{countdown}s</span>
        </div>
      </div>

      {/* Thumbnail */}
      <div className="relative flex-1 my-2 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 group">
        <img
          src={imageSrc}
          alt="Activity Thumbnail"
          className="h-full w-full object-cover opacity-85 transition-opacity group-hover:opacity-100"
        />
        <button
          onClick={handlePreview}
          className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
          title="Click to Preview Fullscreen"
        >
          <div className="flex items-center space-x-1 bg-zinc-900/90 px-2 py-1 rounded text-[10px] font-semibold border border-zinc-700">
            <Eye className="h-3 w-3 text-zinc-300" />
            <span>Preview</span>
          </div>
        </button>
      </div>

      {/* Buttons */}
      <div className="flex space-x-2">
        <button
          onClick={handleDiscard}
          className="flex-1 flex items-center justify-center space-x-1 bg-red-950/30 hover:bg-red-900/40 border border-red-900/30 text-red-400 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Discard</span>
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 flex items-center justify-center space-x-1 bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
        >
          <Check className="h-3.5 w-3.5" />
          <span>Submit</span>
        </button>
      </div>
    </div>
  );
}
