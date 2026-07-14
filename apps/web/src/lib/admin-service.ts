export interface AppSettings {
  id: string;
  companyName: string;
  screenshotRetentionDays: number;
  updatedAt: string;
}

export interface UserEmployment {
  id: string;
  userId: string;
  position: string | null;
  department: string | null;
  employeeId: string | null;
  joinDate: string | null;
  employmentStatus: "active" | "inactive" | "on_leave";
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  username: string;
  image: string | null;
  isAdmin: boolean;
  employment?: UserEmployment;
}

export async function getAdminSettings(): Promise<AppSettings> {
  const res = await fetch("/api/admin/settings", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch admin settings");
  }

  return res.json();
}

export async function updateAdminSettings(
  companyName?: string,
  screenshotRetentionDays?: number
): Promise<AppSettings> {
  const res = await fetch("/api/admin/settings", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ companyName, screenshotRetentionDays }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || "Failed to update admin settings");
  }

  return res.json();
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const res = await fetch("/api/admin/users", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch user list");
  }

  return res.json();
}

export async function updateAdminUser(
  id: string,
  data: {
    name?: string;
    username?: string;
    isAdmin?: boolean;
  }
): Promise<AdminUser> {
  const res = await fetch(`/api/admin/users/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || "Failed to update user profile");
  }

  return res.json();
}

export async function updateAdminUserEmployment(
  id: string,
  data: {
    position?: string;
    department?: string;
    employeeId?: string;
    joinDate?: string;
    employmentStatus?: "active" | "inactive" | "on_leave";
  }
): Promise<UserEmployment> {
  const res = await fetch(`/api/admin/users/${id}/employment`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || "Failed to update user employment data");
  }

  return res.json();
}
