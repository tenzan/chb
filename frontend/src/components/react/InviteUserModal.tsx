import { useState, useRef } from "react";
import { getApiUrl } from "../../lib/config";

const ROLES = ["Admin", "Personnel", "Tutor", "Accountant", "Parent"];

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function InviteUserModal({ onClose, onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [roleName, setRoleName] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!roleName) {
      setError("Please select a role");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${getApiUrl()}/api/admin/invites`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, roleName }),
      });

      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to create invite");
        return;
      }

      setInviteToken(body.data.inviteToken);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Invite User</h3>

        {inviteToken ? (
          <div>
            <p className="text-sm text-gray-600 mb-2">Invite created! Share this link:</p>
            <div className="bg-gray-50 p-3 rounded-md text-sm break-all">
              {window.location.origin}/accept-invite?token={inviteToken}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/accept-invite?token=${inviteToken}`
                  );
                }}
                className="flex-1 border border-blue-600 text-blue-600 py-2 px-4 rounded-md hover:bg-blue-50"
              >
                Copy Link
              </button>
              <button
                onClick={onSuccess}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>
            )}

            <div>
              <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <div className="space-y-2">
                {ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value={r}
                      checked={roleName === r}
                      onChange={(e) => setRoleName(e.target.value)}
                      className="text-blue-600"
                    />
                    <span className="text-sm text-gray-700">{r}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !roleName}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create Invite"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
