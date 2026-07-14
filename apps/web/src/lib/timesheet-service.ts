export interface TimesheetApproval {
  id: string;
  timesheetId: string;
  reviewedBy: string;
  decision: "approved" | "rejected";
  note: string | null;
  reviewedAt: string;
  reviewer: {
    id: string;
    name: string;
    email: string;
  };
}

export interface Timesheet {
  id: string;
  userId: string;
  projectId: string;
  periodStart: string;
  periodEnd: string;
  totalMinutes: number;
  status: "draft" | "submitted" | "approved" | "rejected";
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  approvals?: TimesheetApproval[];
}

export interface ManualTimeEntry {
  id: string;
  userId: string;
  projectId: string;
  issueId: string | null;
  durationMinutes: number;
  description: string;
  entryDate: string;
  approvalStatus: "pending" | "approved" | "rejected";
  createdAt: string;
}

export async function getTimesheets(projectId?: string): Promise<Timesheet[]> {
  const params = new URLSearchParams();
  if (projectId) params.append("projectId", projectId);

  const res = await fetch(`/timesheets?${params.toString()}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch timesheets");
  }

  return res.json();
}

export async function getTimesheetDetail(id: string): Promise<Timesheet> {
  const res = await fetch(`/timesheets/${id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch timesheet details");
  }

  return res.json();
}

export async function createTimesheet(
  projectId: string,
  periodStart: string,
  periodEnd: string
): Promise<Timesheet> {
  const res = await fetch("/timesheets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ projectId, periodStart, periodEnd }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to create timesheet");
  }

  return res.json();
}

export async function submitTimesheet(id: string): Promise<Timesheet> {
  const res = await fetch(`/timesheets/${id}/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to submit timesheet");
  }

  return res.json();
}

export async function approveTimesheet(
  id: string,
  decision: "approved" | "rejected",
  note?: string
): Promise<Timesheet> {
  const res = await fetch(`/timesheets/${id}/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ decision, note }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to review timesheet");
  }

  return res.json();
}

export async function getManualEntries(projectId?: string): Promise<ManualTimeEntry[]> {
  const params = new URLSearchParams();
  if (projectId) params.append("projectId", projectId);

  const res = await fetch(`/manual-time-entries?${params.toString()}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch manual entries");
  }

  return res.json();
}

export async function createManualEntry(
  projectId: string,
  issueId: string | null,
  durationMinutes: number,
  description: string,
  entryDate: string
): Promise<ManualTimeEntry> {
  const res = await fetch("/manual-time-entries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ projectId, issueId, durationMinutes, description, entryDate }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to create manual time entry");
  }

  return res.json();
}
