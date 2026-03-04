import { useEffect, useState } from "react";
import { getApiUrl } from "../../lib/config";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

interface Props {
  children: React.ReactNode;
}

export function AuthGuard({ children }: Props) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${getApiUrl()}/api/auth/me`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Not authenticated");
        return res.json();
      })
      .then((body) => {
        setUser(body.data);
        setLoading(false);
      })
      .catch(() => {
        window.location.href = "/login";
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
}

export function useAuth(): AuthUser | null {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    fetch(`${getApiUrl()}/api/auth/me`, { credentials: "include" })
      .then((res) => res.ok ? res.json() : null)
      .then((body) => body && setUser(body.data))
      .catch(() => {});
  }, []);

  return user;
}
