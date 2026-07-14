export interface TimeBlock {
  id: string;
  projectId: string;
  issueId: string | null;
  blockStart: string;
  blockEnd: string;
  isPaid: boolean;
  activity: {
    keyboardCount: number;
    mouseCount: number;
    activityLevel: 'none' | 'low' | 'medium' | 'high';
    activeAppName: string;
    activeWindowTitle: string;
  };
  screenshot: {
    id: string;
    r2ObjectKey: string;
    capturedAt: string;
  } | null;
}

export async function getTimeBlocks(
  projectId?: string,
  startDate?: string,
  endDate?: string
): Promise<TimeBlock[]> {
  const params = new URLSearchParams();
  if (projectId) params.append("projectId", projectId);
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);

  const res = await fetch(`/time-blocks?${params.toString()}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch time blocks");
  }

  return res.json();
}

export async function deleteTimeBlock(id: string, reason: string): Promise<void> {
  const res = await fetch(`/time-blocks/${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to delete time block");
  }
}

export async function overrideTimeBlock(
  id: string,
  action: "delete" | "mark_unpaid",
  reason: string
): Promise<void> {
  const res = await fetch(`/time-blocks/${id}/override`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, reason }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to override time block");
  }
}
