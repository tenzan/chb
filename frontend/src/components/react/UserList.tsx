import { useState } from "react";
import { InviteUserModal } from "./InviteUserModal";
import { EditRolesModal } from "./EditRolesModal";

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

interface Props {
  users: User[];
}

export function UserList({ users: initialUsers }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [showInvite, setShowInvite] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const handleInviteSuccess = () => {
    setShowInvite(false);
  };

  const handleRolesUpdate = (userId: string, newRoles: string[]) => {
    setUsers(users.map((u) => (u.id === userId ? { ...u, roles: newRoles } : u)));
    setEditingUser(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{users.length} users</p>
        <button
          onClick={() => setShowInvite(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
        >
          Invite User
        </button>
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

      {showInvite && (
        <InviteUserModal
          onClose={() => setShowInvite(false)}
          onSuccess={handleInviteSuccess}
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
