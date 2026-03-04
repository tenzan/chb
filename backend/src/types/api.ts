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
