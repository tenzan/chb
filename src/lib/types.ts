export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiError {
  error: string;
}

export interface Student {
  id: string;
  name: string;
  birthday: string | null;
  description: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  parents: ParentInfo[];
}

export interface ParentInfo {
  id: string;
  name: string;
  email: string;
}

export interface ParentUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  note: string | null;
  created_at: string;
}

export interface UserWithRoles {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  note: string | null;
  roles: string[];
  created_at: string;
  updated_at: string;
}

export interface Enrollment {
  id: string;
  student_id: string;
  subject_id: string;
  student_name: string;
  subject_name: string;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  enrollment_id: string;
  date: string;
  status: 'present' | 'notified_absent' | 'absent';
  note: string | null;
  recorded_by: string;
  created_at: string;
  updated_at: string;
}
