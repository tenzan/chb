export class ApiClient {
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const res = await fetch(path, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const body = await res.json();

    if (!res.ok) {
      throw new ApiError(body.error || "Request failed", res.status);
    }

    return body.data;
  }

  // Auth
  async login(email: string, password: string) {
    return this.request<{
      id: string;
      email: string;
      name: string;
      roles: string[];
    }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async logout() {
    return this.request("/api/auth/logout", { method: "POST" });
  }

  async me() {
    return this.request<{
      id: string;
      email: string;
      name: string;
      roles: string[];
    }>("/api/auth/me");
  }

  // Users
  async getUsers() {
    return this.request<
      Array<{
        id: string;
        email: string;
        name: string;
        roles: string[];
      }>
    >("/api/admin/users");
  }

  async createUser(data: {
    email: string;
    name: string;
    password: string;
    roles: string[];
  }) {
    return this.request("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async manageRoles(
    userId: string,
    data: { add?: string[]; remove?: string[] }
  ) {
    return this.request(`/api/admin/users/${userId}/roles`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Invites
  async createInvite(email: string, roleName: string) {
    return this.request<{ inviteToken: string }>("/api/admin/invites", {
      method: "POST",
      body: JSON.stringify({ email, roleName }),
    });
  }

  async acceptInvite(token: string, name: string, password: string) {
    return this.request("/api/admin/invites/accept", {
      method: "POST",
      body: JSON.stringify({ token, name, password }),
    });
  }

  // Parents
  async getParents() {
    return this.request<
      Array<{
        id: string;
        email: string;
        name: string;
        phone: string | null;
        note: string | null;
      }>
    >("/api/admin/parents");
  }

  async createParent(data: {
    email: string;
    name: string;
    phone?: string;
    note?: string;
  }) {
    return this.request("/api/admin/parents", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Students
  async getStudents(parentUserId?: string) {
    const query = parentUserId ? `?parentUserId=${parentUserId}` : "";
    return this.request<
      Array<{
        id: string;
        name: string;
        birthday: string | null;
        description: string | null;
        note: string | null;
        parents: Array<{ id: string; name: string; email: string }>;
      }>
    >(`/api/admin/students${query}`);
  }

  async createStudent(data: {
    name: string;
    parentUserId: string;
    birthday?: string;
    description?: string;
    note?: string;
  }) {
    return this.request("/api/admin/students", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateStudent(
    id: string,
    data: {
      name?: string;
      birthday?: string;
      description?: string;
      note?: string;
    }
  ) {
    return this.request(`/api/admin/students/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async linkParentToStudent(studentId: string, parentUserId: string) {
    return this.request(`/api/admin/students/${studentId}/link-parent`, {
      method: "POST",
      body: JSON.stringify({ parentUserId }),
    });
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const api = new ApiClient();
