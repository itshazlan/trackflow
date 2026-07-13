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
