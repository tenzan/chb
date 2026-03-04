import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StudentList } from "../../src/components/react/StudentList";

describe("StudentList", () => {
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

  it("renders list of students", () => {
    render(<StudentList students={students} />);
    expect(screen.getByText("Student 1")).toBeInTheDocument();
    expect(screen.getByText("Student 2")).toBeInTheDocument();
  });

  it("shows parent name", () => {
    render(<StudentList students={students} />);
    expect(screen.getByText("Parent 1")).toBeInTheDocument();
  });

  it("shows create/edit buttons", () => {
    render(<StudentList students={students} />);
    expect(screen.getByRole("button", { name: /add student/i })).toBeInTheDocument();
  });
});
