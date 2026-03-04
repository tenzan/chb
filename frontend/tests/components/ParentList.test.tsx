import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ParentList } from "../../src/components/react/ParentList";

const parents = [
  { id: "1", email: "parent1@test.com", name: "Parent 1", phone: "123-456", note: null, created_at: "2024-01-01" },
  { id: "2", email: "parent2@test.com", name: "Parent 2", phone: null, note: null, created_at: "2024-01-01" },
];

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: parents }),
  } as Response);
});

describe("ParentList", () => {
  it("renders list of parents", async () => {
    render(<ParentList />);
    await waitFor(() => expect(screen.getByText("Parent 1")).toBeInTheDocument());
    expect(screen.getByText("Parent 2")).toBeInTheDocument();
    expect(screen.getByText("parent1@test.com")).toBeInTheDocument();
  });

  it("shows create button", async () => {
    render(<ParentList />);
    await waitFor(() => expect(screen.getByRole("button", { name: /add parent/i })).toBeInTheDocument());
  });
});
