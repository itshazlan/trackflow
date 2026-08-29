export interface TimeBlockInput {
  blockStart: Date | string;
  blockEnd: Date | string;
}

export interface ManualEntryInput {
  durationMinutes: number;
}

export interface PeriodInput {
  start: Date;
  end: Date;
}

function toTimestamp(value: Date | string): number | null {
  const date = value instanceof Date ? value : new Date(value);
  const ts = date.getTime();
  return Number.isFinite(ts) ? ts : null;
}

export function calculateTotalMinutes(
  timeBlocks: TimeBlockInput[],
  manualEntries: ManualEntryInput[],
  period: PeriodInput,
): number {
  const periodStart = period.start.getTime();
  const periodEnd = period.end.getTime();

  const intervals: Array<[number, number]> = [];

  for (const block of timeBlocks) {
    const start = toTimestamp(block.blockStart);
    const end = toTimestamp(block.blockEnd);
    if (start === null || end === null || end <= start) continue;

    const clippedStart = Math.max(start, periodStart);
    const clippedEnd = Math.min(end, periodEnd);
    if (clippedEnd <= clippedStart) continue;

    intervals.push([clippedStart, clippedEnd]);
  }

  intervals.sort((a, b) => a[0] - b[0]);

  const merged: Array<[number, number]> = [];
  for (const [start, end] of intervals) {
    const last = merged[merged.length - 1];
    if (last && start < last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  let totalMs = 0;
  for (const [start, end] of merged) {
    totalMs += end - start;
  }

  let totalMinutes = totalMs / 60000;

  for (const entry of manualEntries) {
    const duration = entry.durationMinutes;
    if (Number.isFinite(duration) && duration > 0) {
      totalMinutes += duration;
    }
  }

  return Math.round(totalMinutes);
}
