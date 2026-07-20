// Shared types and interfaces for TrackFlow

export type ProjectRole = 'manager' | 'developer' | 'reporter_qa';

export type EmploymentStatus = 'active' | 'inactive' | 'on_leave';

export interface UserDto {
  id: string;
  email: string;
  name: string;
  image?: string;
  username: string;
  phoneNumber?: string;
  position?: string;
  department?: string;
  employeeId?: string;
  joinDate?: string;
  employmentStatus: EmploymentStatus;
  isAdmin: boolean;
}

export type NotificationType =
  | 'project_member_added'
  | 'issue_assigned'
  | 'issue_mentioned'
  | 'timesheet_approved'
  | 'timeblock_overridden';

export type NotificationEntityType = 'project' | 'issue' | 'timesheet' | 'time_block';

export interface NotificationDto {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType: NotificationEntityType;
  entityId: string;
  isRead: boolean;
  createdAt: string;
}

export type DocumentCategory = 'project_doc' | 'supporting_file' | 'third_party';

export interface DocumentDto {
  id: string;
  projectId: string;
  fileName: string;
  category: DocumentCategory;
  description?: string;
  fileSizeBytes: number;
  mimeType: string;
  r2ObjectKey: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: string;
  confirmedAt?: string;
}


