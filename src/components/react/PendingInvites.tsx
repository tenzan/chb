import { useEffect, useState } from "react";

interface Invite {
  id: string;
  email: string;
  role_name: string;
  token: string | null;
  expires_at: string;
  used_at: string | null;
  created_at: string;
  created_by_name: string;
}

interface Props {
  refreshKey?: number;
}

export function PendingInvites({ refreshKey = 0 }: Props) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/admin/invites", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((body) => setInvites(body.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const pendingInvites = invites.filter(
    (i) => !i.used_at && new Date(i.expires_at) > new Date()
  );

  if (loading || pendingInvites.length === 0) return null;

  const copyLink = (invite: Invite) => {
    if (!invite.token) return;
    const url = `${window.location.origin}/accept-invite?token=${invite.token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const revokeInvite = async (id: string) => {
    const res = await fetch(`/api/admin/invites/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      setInvites(invites.filter((i) => i.id !== id));
    }
  };

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        Pending Invites ({pendingInvites.length})
      </h3>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invite Link</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {pendingInvites.map((invite) => (
              <tr key={invite.id}>
                <td className="px-4 py-3 text-sm text-gray-900">{invite.email}</td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                    {invite.role_name}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(invite.expires_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  {invite.token ? (
                    <button
                      onClick={() => copyLink(invite)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {copiedId === invite.id ? "Copied!" : "Copy Link"}
                    </button>
                  ) : (
                    <span className="text-sm text-gray-400">N/A</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => revokeInvite(invite.id)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
