export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
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
