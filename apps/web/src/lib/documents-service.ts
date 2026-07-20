import { DocumentContainerDto, DocumentFileDto, DocumentDetailDto } from "@trackflow/shared-types";

export interface PaginatedDocumentContainers {
  data: DocumentContainerDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export async function getDocuments(
  projectId: string,
  page = 1,
  limit = 20,
): Promise<PaginatedDocumentContainers> {
  const res = await fetch(`/api/projects/${projectId}/documents?page=${page}&limit=${limit}`, {
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

export async function createDocumentContainer(
  projectId: string,
  payload: {
    title: string;
    category: string;
    description?: string;
  },
): Promise<DocumentContainerDto> {
  const res = await fetch(`/api/projects/${projectId}/documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to create document container");
  }

  return res.json();
}

export async function getDocumentContainerDetail(
  projectId: string,
  documentId: string,
): Promise<DocumentDetailDto> {
  const res = await fetch(`/api/projects/${projectId}/documents/${documentId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch document container details");
  }

  return res.json();
}

export async function updateDocumentContainer(
  projectId: string,
  documentId: string,
  payload: {
    title?: string;
    category?: string;
    description?: string | null;
  },
): Promise<Partial<DocumentContainerDto>> {
  const res = await fetch(`/api/projects/${projectId}/documents/${documentId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to update document container");
  }

  return res.json();
}

export async function deleteDocumentContainer(
  projectId: string,
  documentId: string,
): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/documents/${documentId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to delete document container");
  }
}

export async function requestFileUpload(
  projectId: string,
  documentId: string,
  payload: {
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
  },
): Promise<{ fileId: string; uploadUrl: string }> {
  const res = await fetch(`/api/projects/${projectId}/documents/${documentId}/files`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to request file upload URL");
  }

  return res.json();
}

export async function confirmFileUpload(
  projectId: string,
  documentId: string,
  fileId: string,
): Promise<DocumentFileDto> {
  const res = await fetch(`/api/projects/${projectId}/documents/${documentId}/files/${fileId}/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to confirm file upload");
  }

  return res.json();
}

export async function getFileDownloadUrl(
  projectId: string,
  documentId: string,
  fileId: string,
): Promise<string> {
  const res = await fetch(`/api/projects/${projectId}/documents/${documentId}/files/${fileId}/download`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to get file download URL");
  }

  const data = await res.json();
  return data.downloadUrl;
}

export async function deleteFile(
  projectId: string,
  documentId: string,
  fileId: string,
): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/documents/${documentId}/files/${fileId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to delete file");
  }
}
