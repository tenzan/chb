import { useEffect, useState } from "react";
import { getApiUrl } from "../../lib/config";
import { InviteUserModal } from "./InviteUserModal";
import { CreateUserModal } from "./CreateUserModal";
import { EditRolesModal } from "./EditRolesModal";
import { PendingInvites } from "./PendingInvites";

interface User {
  id: string;
  email: string;
  name: string;
  roles: string[];
  phone: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export function UserList() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [inviteRefreshKey, setInviteRefreshKey] = useState(0);

  const fetchUsers = () => {
    fetch(`${getApiUrl()}/api/admin/users`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((body) => setUsers(body.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleInviteSuccess = () => {
    setShowInvite(false);
    setInviteRefreshKey((k) => k + 1);
  };

  const handleCreateSuccess = () => {
    setShowCreate(false);
    fetchUsers();
  };

  const handleRolesUpdate = (userId: string, newRoles: string[]) => {
    setUsers(users.map((u) => (u.id === userId ? { ...u, roles: newRoles } : u)));
    setEditingUser(null);
  };

  if (loading) {
    return <p className="text-gray-500">Loading...</p>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{users.length} users</p>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
          >
            Create User
          </button>
          <button
            onClick={() => setShowInvite(true)}
            className="border border-blue-600 text-blue-600 px-4 py-2 rounded-md text-sm hover:bg-blue-50"
          >
            Invite User
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roles</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3 text-sm text-gray-900">{user.name}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{user.email}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {user.roles.map((role) => (
                      <span
                        key={role}
                        className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setEditingUser(user)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Edit Roles
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PendingInvites refreshKey={inviteRefreshKey} />

      {showInvite && (
        <InviteUserModal
          onClose={() => setShowInvite(false)}
          onSuccess={handleInviteSuccess}
        />
      )}

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {editingUser && (
        <EditRolesModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUpdate={handleRolesUpdate}
        />
      )}
    </div>
  );
}
