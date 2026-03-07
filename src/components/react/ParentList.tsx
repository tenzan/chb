import { useEffect, useState } from "react";
import { CreateParentModal } from "./CreateParentModal";

interface Parent {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  note: string | null;
  created_at: string;
}

export function ParentList() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetch("/api/admin/parents", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((body) => setParents(body.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = (newParent: Parent) => {
    setParents([newParent, ...parents]);
    setShowCreate(false);
  };

  if (loading) {
    return <p className="text-gray-500">Loading...</p>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{parents.length} parents</p>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
        >
          Add Parent
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {parents.map((parent) => (
              <tr key={parent.id}>
                <td className="px-4 py-3 text-sm text-gray-900">{parent.name}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{parent.email}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{parent.phone || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateParentModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
