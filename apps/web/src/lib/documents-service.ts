import { DocumentDto } from "@trackflow/shared-types";

export async function getDocuments(projectId: string): Promise<DocumentDto[]> {
  const res = await fetch(`/api/projects/${projectId}/documents`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch documents");
  }

  return res.json();
}

export async function requestUpload(
  projectId: string,
  payload: {
    fileName: string;
    category: string;
    mimeType: string;
    fileSizeBytes: number;
    description?: string;
  },
): Promise<{ documentId: string; uploadUrl: string }> {
  const res = await fetch(`/api/projects/${projectId}/documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to initiate document upload");
  }

  return res.json();
}

export async function confirmUpload(projectId: string, documentId: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/documents/${documentId}/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to confirm upload");
  }
}

export async function getDownloadUrl(projectId: string, documentId: string): Promise<string> {
  const res = await fetch(`/api/projects/${projectId}/documents/${documentId}/download`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to get download URL");
  }

  const data = await res.json();
  return data.downloadUrl;
}

export async function deleteDocument(projectId: string, documentId: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/documents/${documentId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to delete document");
  }
}
