export interface DashboardSummary {
  todayMinutes: number;
  overdueCount: number;
  activeTimerStatus?: {
    isTracking?: boolean;
    projectName?: string;
    issueTitle?: string;
  } | null;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const res = await fetch("/api/dashboard/summary", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch dashboard summary");
  }

  return res.json();
}
