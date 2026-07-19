import { NotificationDto } from "@trackflow/shared-types";

export interface GetNotificationsResponse {
  data: NotificationDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export async function getNotifications(
  unreadOnly?: boolean,
  page: number = 1,
  limit: number = 20,
): Promise<GetNotificationsResponse> {
  const query = new URLSearchParams();
  if (unreadOnly !== undefined) {
    query.set("unread", String(unreadOnly));
  }
  query.set("page", String(page));
  query.set("limit", String(limit));

  const res = await fetch(`/api/notifications?${query.toString()}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch notifications");
  }

  return res.json();
}

export async function markNotificationAsRead(id: string): Promise<NotificationDto> {
  const res = await fetch(`/api/notifications/${id}/read`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to mark notification as read");
  }

  return res.json();
}

export async function markAllNotificationsAsRead(): Promise<{ count: number }> {
  const res = await fetch(`/api/notifications/read-all`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to mark all notifications as read");
  }

  return res.json();
}
