export interface Issue {
  id: string;
  projectId: string;
  trackerId: string;
  statusId: string;
  title: string;
  number?: number;
  displayId?: string;
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
  restrictedToRole: 'manager' | 'developer' | 'reporter_qa' | null;
}

export interface Tracker {
  id: string;
  name: string;
}

export interface ProjectMember {
  id: string;
  name: string;
  email: string;
  username: string;
  role: 'manager' | 'developer' | 'reporter_qa';
  invitedAt: string;
}

export interface TemplateField {
  label: string;
  required: boolean;
  helperText?: string;
}

export interface IssueTemplate {
  id: string;
  projectId: string | null;
  trackerId: string;
  name: string;
  titlePattern: string | null;
  descriptionPattern: string | null;
  createdAt: string;
  tracker?: {
    id: string;
    name: string;
  };
}

export interface IssueAttachment {
  id: string;
  issueId: string;
  fileName: string;
  r2ObjectKey: string;
  uploadedBy: string;
  uploadedAt: string;
}

export async function getIssues(projectId: string): Promise<Issue[]> {
  const res = await fetch(`/api/projects/${projectId}/issues`, {
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
    trackerId: string;
    statusId?: string;
    title: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    assigneeId?: string | null;
    dueDate?: string | null;
  }
): Promise<Issue> {
  const res = await fetch(`/api/projects/${projectId}/issues`, {
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
  const res = await fetch(`/api/projects/${projectId}/issues/${issueId}`, {
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
  const res = await fetch(`/api/projects/${projectId}/issues/${issueId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to delete issue");
  }
}

export async function updateIssueStatus(issueId: string, statusId: string): Promise<Issue> {
  const res = await fetch(`/api/issues/${issueId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ statusId }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to update issue status");
  }

  return res.json();
}

export async function getProjectStatuses(projectId: string): Promise<IssueStatus[]> {
  const res = await fetch(`/api/projects/${projectId}/statuses`, {
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
  const res = await fetch("/api/trackers", {
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
  const res = await fetch(`/api/projects/${projectId}/members`, {
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

export async function addProjectMember(
  projectId: string,
  userId: string,
  role: 'manager' | 'developer' | 'reporter_qa',
): Promise<ProjectMember> {
  const res = await fetch(`/api/projects/${projectId}/members`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, role }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to add project member");
  }

  return res.json();
}

export async function updateProjectMemberRole(
  projectId: string,
  userId: string,
  role: 'manager' | 'developer' | 'reporter_qa',
): Promise<ProjectMember> {
  const res = await fetch(`/api/projects/${projectId}/members/${userId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to update project member role");
  }

  return res.json();
}

export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/members/${userId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to remove project member");
  }
}

export async function getSystemUsers(): Promise<Array<{ id: string; name: string; email: string; username: string }>> {
  const res = await fetch("/api/users", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch system users");
  }

  return res.json();
}

export async function createProjectStatus(
  projectId: string,
  payload: { name: string; orderIndex: number; restrictedToRole: string | null }
): Promise<IssueStatus> {
  const res = await fetch(`/api/projects/${projectId}/statuses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to create status");
  }

  return res.json();
}

export async function updateProjectStatus(
  projectId: string,
  statusId: string,
  payload: Partial<{ name: string; orderIndex: number; restrictedToRole: string | null }>
): Promise<IssueStatus> {
  const res = await fetch(`/api/projects/${projectId}/statuses/${statusId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to update status");
  }

  return res.json();
}

export async function deleteProjectStatus(projectId: string, statusId: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/statuses/${statusId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to delete status");
  }
}

export async function reorderProjectStatuses(projectId: string, statusIds: string[]): Promise<IssueStatus[]> {
  const res = await fetch(`/api/projects/${projectId}/statuses/reorder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ statusIds }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to reorder statuses");
  }

  return res.json();
}

export async function getProjectTemplates(projectId: string): Promise<IssueTemplate[]> {
  const res = await fetch(`/api/projects/${projectId}/templates`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch project templates");
  }

  return res.json();
}

export async function createProjectTemplate(
  projectId: string,
  payload: { name: string; trackerId: string; titlePattern?: string; descriptionPattern?: string }
): Promise<IssueTemplate> {
  const res = await fetch(`/api/projects/${projectId}/templates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to create project template");
  }

  return res.json();
}

export async function updateProjectTemplate(
  projectId: string,
  templateId: string,
  payload: Partial<{ name: string; trackerId: string; titlePattern: string | null; descriptionPattern: string | null }>
): Promise<IssueTemplate> {
  const res = await fetch(`/api/projects/${projectId}/templates/${templateId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to update template");
  }

  return res.json();
}

export async function deleteProjectTemplate(projectId: string, templateId: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/templates/${templateId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to delete template");
  }
}

export async function getIssueAttachments(issueId: string): Promise<IssueAttachment[]> {
  const res = await fetch(`/api/issues/${issueId}/attachments`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to fetch attachments");
  }

  return res.json();
}

export async function createIssueAttachment(
  issueId: string,
  file: File
): Promise<IssueAttachment> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`/api/issues/${issueId}/attachments`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to upload attachment");
  }

  return res.json();
}

export async function deleteIssueAttachment(issueId: string, attachmentId: string): Promise<void> {
  const res = await fetch(`/api/issues/${issueId}/attachments/${attachmentId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to delete attachment");
  }
}
