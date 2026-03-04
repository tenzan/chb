import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiClient, ApiError } from "../../src/lib/api";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock import.meta.env
vi.stubGlobal("import", { meta: { env: { PUBLIC_API_URL: "http://test:8787" } } });

describe("ApiClient", () => {
  let client: ApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ApiClient("http://test:8787");
  });

  it("login sends correct request", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { id: "1", email: "test@test.com", name: "Test", roles: ["Admin"] },
        }),
    });

    const result = await client.login("test@test.com", "password");
    expect(result.email).toBe("test@test.com");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://test:8787/api/auth/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      })
    );
  });

  it("throws ApiError on failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Invalid credentials" }),
    });

    await expect(client.login("test@test.com", "wrong")).rejects.toThrow(ApiError);
  });

  it("me sends correct request", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { id: "1", email: "test@test.com", name: "Test", roles: ["Admin"] },
        }),
    });

    const result = await client.me();
    expect(result.email).toBe("test@test.com");
  });
});
