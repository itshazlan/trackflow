export interface Project {
  id: string;
  name: string;
  key: string;
  issueSequence: number;
  description: string | null;
  createdBy: string;
  createdAt: string;
  parentProjectId?: string | null;
  parent_project_id?: string | null;
  archivedAt?: string | null;
  archivedBy?: string | null;
}

export async function getProjects(): Promise<Project[]> {
  const res = await fetch("/api/projects", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch projects");
  }

  return res.json();
}

export async function createProject(
  name: string,
  key: string,
  description?: string,
  parentProjectId?: string,
  members?: Array<{ userId: string; role: "manager" | "developer" | "reporter_qa" }>,
): Promise<Project> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, key, description, parentProjectId, members }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to create project");
  }

  return res.json();
}

export async function checkProjectKey(key: string): Promise<{ available: boolean }> {
  const res = await fetch(`/api/projects/check-key/${key}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to check project key");
  }

  return res.json();
}

export async function deleteProject(id: string, confirmKey: string): Promise<void> {
  const res = await fetch(`/api/projects/${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ confirmKey }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to delete project");
  }
}

export async function archiveProject(id: string): Promise<Project> {
  const res = await fetch(`/api/projects/${id}/archive`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to archive project");
  }

  return res.json();
}

export async function restoreProject(id: string): Promise<Project> {
  const res = await fetch(`/api/projects/${id}/restore`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to restore project");
  }

  return res.json();
}

export async function getProjectDetail(id: string): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch project detail (${res.status})`);
  }

  return res.json();
}

export async function getSubProjects(id: string): Promise<Project[]> {
  const res = await fetch(`/api/projects/${id}/sub-projects`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch sub-projects");
  }

  return res.json();
}

export async function createSubProject(
  parentId: string,
  name: string,
  key: string,
  description?: string,
): Promise<Project> {
  const res = await fetch(`/api/projects/${parentId}/sub-projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, key, description }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to create sub-project");
  }

  return res.json();
}

export async function updateProject(
  id: string,
  data: { name?: string; description?: string }
): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to update project");
  }

  return res.json();
}
