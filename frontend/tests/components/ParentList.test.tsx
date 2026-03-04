import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ParentList } from "../../src/components/react/ParentList";

describe("ParentList", () => {
  const parents = [
    { id: "1", email: "parent1@test.com", name: "Parent 1", phone: "123-456", note: null, created_at: "2024-01-01" },
    { id: "2", email: "parent2@test.com", name: "Parent 2", phone: null, note: null, created_at: "2024-01-01" },
  ];

  it("renders list of parents", () => {
    render(<ParentList parents={parents} />);
    expect(screen.getByText("Parent 1")).toBeInTheDocument();
    expect(screen.getByText("Parent 2")).toBeInTheDocument();
    expect(screen.getByText("parent1@test.com")).toBeInTheDocument();
  });

  it("shows create button", () => {
    render(<ParentList parents={parents} />);
    expect(screen.getByRole("button", { name: /add parent/i })).toBeInTheDocument();
  });
});
