import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StudentList } from "../../src/components/react/StudentList";

const students = [
  {
    id: "1",
    name: "Student 1",
    birthday: "2010-05-15",
    description: null,
    note: null,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
    parents: [{ id: "p1", name: "Parent 1", email: "parent1@test.com" }],
  },
  {
    id: "2",
    name: "Student 2",
    birthday: null,
    description: null,
    note: null,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
    parents: [],
  },
];

const parents = [
  { id: "p1", name: "Parent 1", email: "parent1@test.com" },
];

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
    if (String(url).includes("/students")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: students }),
      } as Response);
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data: parents }),
    } as Response);
  });
});

describe("StudentList", () => {
  it("renders list of students", async () => {
    render(<StudentList />);
    await waitFor(() => expect(screen.getByText("Student 1")).toBeInTheDocument());
    expect(screen.getByText("Student 2")).toBeInTheDocument();
  });

  it("shows parent name", async () => {
    render(<StudentList />);
    await waitFor(() => expect(screen.getByText("Parent 1")).toBeInTheDocument());
  });

  it("shows create/edit buttons", async () => {
    render(<StudentList />);
    await waitFor(() => expect(screen.getByRole("button", { name: /add student/i })).toBeInTheDocument());
  });

  describe("search", () => {
    it("filters students by name", async () => {
      const user = userEvent.setup();
      render(<StudentList />);
      await waitFor(() => expect(screen.getByText("Student 1")).toBeInTheDocument());

      await user.type(screen.getByPlaceholderText(/search/i), "Student 1");

      expect(screen.getByText("Student 1")).toBeInTheDocument();
      expect(screen.queryByText("Student 2")).not.toBeInTheDocument();
    });

    it("filters students by parent name", async () => {
      const user = userEvent.setup();
      render(<StudentList />);
      await waitFor(() => expect(screen.getByText("Student 1")).toBeInTheDocument());

      await user.type(screen.getByPlaceholderText(/search/i), "Parent 1");

      expect(screen.getByText("Student 1")).toBeInTheDocument();
      expect(screen.queryByText("Student 2")).not.toBeInTheDocument();
    });

    it("is case-insensitive", async () => {
      const user = userEvent.setup();
      render(<StudentList />);
      await waitFor(() => expect(screen.getByText("Student 1")).toBeInTheDocument());

      await user.type(screen.getByPlaceholderText(/search/i), "student 1");

      expect(screen.getByText("Student 1")).toBeInTheDocument();
      expect(screen.queryByText("Student 2")).not.toBeInTheDocument();
    });

    it("shows filtered count", async () => {
      const user = userEvent.setup();
      render(<StudentList />);
      await waitFor(() => expect(screen.getByText("2 students")).toBeInTheDocument());

      await user.type(screen.getByPlaceholderText(/search/i), "Student 1");

      expect(screen.getByText("1 of 2 students")).toBeInTheDocument();
    });

    it("clears search with X button", async () => {
      const user = userEvent.setup();
      render(<StudentList />);
      await waitFor(() => expect(screen.getByText("Student 1")).toBeInTheDocument());

      await user.type(screen.getByPlaceholderText(/search/i), "Student 1");
      expect(screen.queryByText("Student 2")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /✕/ }));

      expect(screen.getByText("Student 1")).toBeInTheDocument();
      expect(screen.getByText("Student 2")).toBeInTheDocument();
      expect(screen.getByText("2 students")).toBeInTheDocument();
    });
  });
});
