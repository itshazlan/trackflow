export interface ReportItem {
  date: string;
  user: string;
  project: string;
  issue: string;
  type: string;
  durationMinutes: number;
  description: string;
}

export interface ReportData {
  totalMinutes: number;
  items: ReportItem[];
  metadata: {
    projectId: string | null;
    userId: string | null;
    startDate: string | null;
    endDate: string | null;
    generatedAt: string;
  };
}

export async function getReportPreview(
  projectId?: string,
  userId?: string,
  startDate?: string,
  endDate?: string
): Promise<ReportData> {
  const params = new URLSearchParams();
  if (projectId) params.append("projectId", projectId);
  if (userId) params.append("userId", userId);
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);

  const res = await fetch(`/api/reports/hours/preview?${params.toString()}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch report preview data");
  }

  return res.json();
}

export async function downloadReport(
  format: "pdf" | "csv",
  projectId?: string,
  userId?: string,
  startDate?: string,
  endDate?: string
): Promise<void> {
  const params = new URLSearchParams();
  params.append("format", format);
  if (projectId) params.append("projectId", projectId);
  if (userId) params.append("userId", userId);
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);

  const res = await fetch(`/api/reports/hours?${params.toString()}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || "Failed to download report file");
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `report-hours-${Date.now()}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
