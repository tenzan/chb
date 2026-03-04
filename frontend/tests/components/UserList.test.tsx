import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { UserList } from "../../src/components/react/UserList";

const users = [
  { id: "1", email: "admin@test.com", name: "Admin User", roles: ["Admin"], phone: null, note: null, created_at: "2024-01-01", updated_at: "2024-01-01" },
  { id: "2", email: "tutor@test.com", name: "Tutor User", roles: ["Tutor"], phone: null, note: null, created_at: "2024-01-01", updated_at: "2024-01-01" },
];

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: users }),
  } as Response);
});

describe("UserList", () => {
  it("renders list of users with roles", async () => {
    render(<UserList />);
    await waitFor(() => expect(screen.getByText("Admin User")).toBeInTheDocument());
    expect(screen.getByText("Tutor User")).toBeInTheDocument();
    expect(screen.getByText("admin@test.com")).toBeInTheDocument();
  });

  it("shows invite button", async () => {
    render(<UserList />);
    await waitFor(() => expect(screen.getByRole("button", { name: /invite/i })).toBeInTheDocument());
  });

  it("renders role badges", async () => {
    render(<UserList />);
    await waitFor(() => expect(screen.getByText("Admin")).toBeInTheDocument());
    expect(screen.getByText("Tutor")).toBeInTheDocument();
  });
});
