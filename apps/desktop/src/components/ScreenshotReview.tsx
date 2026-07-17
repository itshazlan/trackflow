import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Eye, Clock } from 'lucide-react';

interface PendingReviewData {
  id: string;
  screenshot_path: string;
}

export function ScreenshotReview() {
  const [data, setData] = useState<PendingReviewData | null>(null);
  const [countdown, setCountdown] = useState(15);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync initial pending review and start timer state
  useEffect(() => {
    async function initWidget() {
      try {
        const res = await invoke<PendingReviewData | null>('get_pending_review');
        if (res) {
          setData(res);
          setError(null);
        } else {
          setError('No pending screenshot found.');
        }

        // Get session timer state
        const state = await invoke<{ status: string; start_time: number | null; accumulated_seconds: number }>('get_timer_state');
        if (state.status === 'Running' && state.start_time) {
          const now = Math.floor(Date.now() / 1000);
          setElapsedSeconds(state.accumulated_seconds + (now - state.start_time));
        } else {
          setElapsedSeconds(state.accumulated_seconds);
        }
      } catch (err) {
        console.error('Failed to initialize widget:', err);
        setError('Error loading screenshot.');
      } finally {
        setLoading(false);
      }
    }
    void initWidget();

    // Listen to window focus and document visibilitychange events (triggered on win.show() / win.set_focus())
    const handleFocus = () => {
      void initWidget();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    // Listen to review-data-changed event to re-fetch
    let unlistenReview: (() => void) | null = null;
    listen('review-data-changed', () => {
      void initWidget();
    }).then((unlisten) => {
      unlistenReview = unlisten;
    });

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      if (unlistenReview) unlistenReview();
    };
  }, []);

  // Listen to Rust countdown ticks and paused events
  useEffect(() => {
    let unlistenTick: (() => void) | null = null;
    let unlistenPaused: (() => void) | null = null;

    const setupListeners = async () => {
      unlistenTick = await listen<number>('countdown-tick', (event) => {
        setCountdown(event.payload);
        setIsPaused(false);
      });

      unlistenPaused = await listen('countdown-paused', () => {
        setIsPaused(true);
      });
    };

    void setupListeners();

    return () => {
      if (unlistenTick) unlistenTick();
      if (unlistenPaused) unlistenPaused();
    };
  }, []);

  // Continuous background session timer tick
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
      const primaryPath = data.screenshot_path.split(',')[0];
      await invoke('open_screenshot_preview', { screenshotPath: primaryPath });
    } catch (err) {
      console.error('Failed to open preview:', err);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const getProgressBarColor = () => {
    if (isPaused) return 'bg-zinc-500';
    if (countdown > 5) return 'bg-emerald-500';
    if (countdown > 2) return 'bg-amber-500';
    return 'bg-red-500 animate-pulse';
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

  const primaryScreenshotPath = data.screenshot_path.split(',')[0];
  const imageSrc = convertFileSrc(primaryScreenshotPath);

  return (
    <div className="flex h-screen flex-col justify-between bg-zinc-950/95 text-white p-3 rounded-2xl border border-zinc-800/80 shadow-2xl backdrop-blur-lg overflow-hidden select-none">
      {/* Thumbnail */}
      <div className="relative h-16 rounded overflow-hidden border border-zinc-850 bg-zinc-900 group">
        <img
          src={imageSrc}
          alt="Screenshot Preview"
          className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
        />
        <button
          onClick={handlePreview}
          className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <div className="flex items-center space-x-1 bg-zinc-900/90 px-2 py-0.5 rounded text-[9px] font-semibold border border-zinc-700">
            <Eye className="h-3 w-3 text-zinc-300" />
            <span>Preview</span>
          </div>
        </button>
      </div>

      {/* Info / Timer Row */}
      <div className="flex items-center justify-between text-[10px] font-medium text-zinc-350 px-0.5">
        <div className="flex items-center space-x-1 font-mono text-zinc-300 bg-zinc-900/50 px-1.5 py-0.5 rounded border border-zinc-800/65">
          <Clock className="h-3 w-3 text-zinc-400" />
          <span>{formatTime(elapsedSeconds)}</span>
        </div>
        <div className="text-zinc-400 font-semibold">
          {isPaused ? (
            <span className="text-zinc-500 animate-pulse">Pengiriman ditunda</span>
          ) : (
            <span>Mengirim dalam <span className="text-amber-500 font-mono font-bold text-[11px]">{countdown}s</span></span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-1.5">
        <button
          onClick={handlePreview}
          className="flex-1 bg-zinc-850 hover:bg-zinc-850/80 border border-zinc-800 text-zinc-200 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer"
        >
          Preview
        </button>
        <button
          onClick={handleDiscard}
          className="flex-1 bg-red-950/30 hover:bg-red-900/30 border border-red-900/20 text-red-400 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer"
        >
          Discard
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer"
        >
          Submit
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${getProgressBarColor()}`}
          style={{ width: `${isPaused ? 100 : (countdown / 15) * 100}%` }}
        />
      </div>
    </div>
  );
}
