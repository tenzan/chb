import { useState } from "react";

const ALL_ROLES = ["Admin", "Personnel", "Tutor", "Accountant", "Parent"];

interface Props {
  user: { id: string; name: string; roles: string[] };
  onClose: () => void;
  onUpdate: (userId: string, newRoles: string[]) => void;
}

export function EditRolesModal({ user, onClose, onUpdate }: Props) {
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set(user.roles));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleRole = (role: string) => {
    const next = new Set(selectedRoles);
    if (next.has(role)) {
      next.delete(role);
    } else {
      next.add(role);
    }
    setSelectedRoles(next);
  };

  const handleSave = async () => {
    setError("");
    setLoading(true);

    const add = [...selectedRoles].filter((r) => !user.roles.includes(r));
    const remove = user.roles.filter((r) => !selectedRoles.has(r));

    if (add.length === 0 && remove.length === 0) {
      onClose();
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${user.id}/roles`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ add, remove }),
      });

      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to update roles");
        return;
      }

      onUpdate(user.id, body.data.roles);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-sm">
        <h3 className="text-lg font-semibold mb-4">Edit Roles - {user.name}</h3>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm mb-4">{error}</div>
        )}

        <div className="space-y-2 mb-4">
          {ALL_ROLES.map((role) => (
            <label key={role} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedRoles.has(role)}
                onChange={() => toggleRole(role)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">{role}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
