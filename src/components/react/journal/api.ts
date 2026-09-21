import type {
  JournalLesson,
  JournalStudent,
  LessonStatus,
  Program,
  StudentGroup,
  TopicCategory,
} from "../../../lib/journal";

export type { JournalLesson, JournalStudent, LessonStatus, Program, StudentGroup, TopicCategory };

export interface StudentInput {
  name: string;
  schoolClass: string;
  birthDate: string;
  phone: string;
  parentPhone: string;
  program: Program;
  groupId: string | null;
}

export type LessonPatch = Partial<Pick<JournalLesson, "date" | "time" | "status" | "topic" | "essay">>;

export class JournalApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: Record<string, unknown>
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/journal${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });

  if (res.status === 401) {
    window.location.href = "/login";
    throw new JournalApiError("Authentication required", 401, {});
  }

  const body = await res.json();
  if (!res.ok) {
    throw new JournalApiError(body.error || "Request failed", res.status, body);
  }
  return body.data as T;
}

// keepalive lets pending saves finish even if the tab is being closed
const send = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
  keepalive: true,
});

export const journalApi = {
  listStudents: () => request<JournalStudent[]>("/students"),
  createStudent: (data: StudentInput) => request<JournalStudent>("/students", send("POST", data)),
  updateStudent: (id: string, data: Partial<StudentInput>) =>
    request<JournalStudent>(`/students/${id}`, send("PATCH", data)),
  deleteStudent: (id: string) => request<{ id: string }>(`/students/${id}`, send("DELETE")),

  createLesson: (studentId: string, data: LessonPatch & { date: string }) =>
    request<JournalLesson>(`/students/${studentId}/lessons`, send("POST", data)),
  updateLesson: (id: string, data: LessonPatch) =>
    request<JournalLesson>(`/lessons/${id}`, send("PATCH", data)),
  deleteLesson: (id: string) => request<{ id: string }>(`/lessons/${id}`, send("DELETE")),

  listGroups: () => request<StudentGroup[]>("/groups"),
  createGroup: (label: string) => request<StudentGroup>("/groups", send("POST", { label })),
  renameGroup: (id: string, label: string) =>
    request<StudentGroup>(`/groups/${id}`, send("PATCH", { label })),
  deleteGroup: (id: string, force = false) =>
    request<{ id: string }>(`/groups/${id}${force ? "?force=true" : ""}`, send("DELETE")),

  listTopics: () => request<TopicCategory[]>("/topics"),
  createTopic: (categoryId: string, text: string) =>
    request<{ id: string; categoryId: string; text: string }>("/topics", send("POST", { categoryId, text })),
  deleteTopic: (id: string) => request<{ id: string }>(`/topics/${id}`, send("DELETE")),
};
