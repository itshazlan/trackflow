// Frontend Authentication Service for TrackFlow

export interface UserSession {
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
    username: string;
    phoneNumber: string | null;
    position: string | null;
    department: string | null;
    employeeId: string | null;
    joinDate: string | null;
    employmentStatus: 'active' | 'inactive' | 'on_leave';
    isAdmin: boolean;
    createdAt: string;
  };
  session: {
    id: string;
    userId: string;
    token: string;
    expiresAt: string;
    createdAt: string;
  };
}

export async function resolveIdentifier(identifier: string): Promise<string> {
  const trimmed = identifier.trim();
  if (trimmed.includes("@")) {
    return trimmed;
  }

  const res = await fetch("/api/auth/resolve-identifier", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ identifier: trimmed }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Username tidak ditemukan");
  }

  const data = await res.json();
  return data.email;
}

export async function login(identifier: string, password: string): Promise<UserSession> {
  const GENERIC_ERROR_MSG = "Username/email atau password salah";

  let email: string;
  try {
    email = await resolveIdentifier(identifier);
  } catch (err) {
    throw new Error(GENERIC_ERROR_MSG);
  }

  const res = await fetch("/api/auth/sign-in/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error(GENERIC_ERROR_MSG);
  }

  return res.json();
}

export async function register(payload: {
  name: string;
  email: string;
  username: string;
  password?: string;
  position?: string;
  department?: string;
  employeeId?: string;
  employmentStatus?: 'active' | 'inactive' | 'on_leave';
  isAdmin?: boolean;
}): Promise<UserSession> {
  const res = await fetch("/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
      position: payload.position || undefined,
      department: payload.department || undefined,
      employeeId: payload.employeeId || undefined,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Registration failed. Please check your inputs.");
  }

  return res.json();
}

export async function logout(): Promise<void> {
  const res = await fetch("/api/auth/sign-out", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to sign out.");
  }
}

export async function getSession(): Promise<UserSession | null> {
  try {
    const res = await fetch("/api/auth/get-session", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (res.status === 401 || res.status === 404) {
      return null;
    }

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data && data.user ? data : null;
  } catch (error) {
    console.error("Error getting session:", error);
    return null;
  }
}
