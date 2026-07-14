export interface Issue {
  id: string;
  projectId: string;
  trackerId: string;
  statusId: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate: string | null;
  dueDate: string | null;
  estimatedHours: string | null;
  createdBy: string;
  createdAt: string;
  assignee?: {
    id: string;
    name: string;
    email: string;
  } | null;
  status?: {
    id: string;
    name: string;
  } | null;
  tracker?: {
    id: string;
    name: string;
  } | null;
}

export interface IssueStatus {
  id: string;
  projectId: string;
  name: string;
  orderIndex: number;
}

export interface Tracker {
  id: string;
  name: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: 'manager' | 'developer' | 'reporter_qa';
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export async function getIssues(projectId: string): Promise<Issue[]> {
  const res = await fetch(`/projects/${projectId}/issues`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch issues");
  }

  return res.json();
}

export async function createIssue(
  projectId: string,
  payload: {
    title: string;
    description?: string;
    statusId: string;
    trackerId: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    assigneeId?: string | null;
    dueDate?: string | null;
  }
): Promise<Issue> {
  const res = await fetch(`/projects/${projectId}/issues`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to create issue");
  }

  return res.json();
}

export async function updateIssue(
  projectId: string,
  issueId: string,
  payload: Partial<{
    title: string;
    description: string | null;
    statusId: string;
    trackerId: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    assigneeId: string | null;
    dueDate: string | null;
  }>
): Promise<Issue> {
  const res = await fetch(`/projects/${projectId}/issues/${issueId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to update issue");
  }

  return res.json();
}

export async function deleteIssue(projectId: string, issueId: string): Promise<void> {
  const res = await fetch(`/projects/${projectId}/issues/${issueId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to delete issue");
  }
}

export async function getProjectStatuses(projectId: string): Promise<IssueStatus[]> {
  const res = await fetch(`/projects/${projectId}/statuses`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch project statuses");
  }

  return res.json();
}

export async function getTrackers(): Promise<Tracker[]> {
  const res = await fetch("/trackers", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch trackers");
  }

  return res.json();
}

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const res = await fetch(`/projects/${projectId}/members`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch project members");
  }

  return res.json();
}
