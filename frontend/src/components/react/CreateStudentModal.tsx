import { useState } from "react";

import { getApiUrl } from "../../lib/config";

interface Parent {
  id: string;
  name: string;
  email: string;
}

interface Props {
  parents: Parent[];
  onClose: () => void;
  onCreate: (student: any) => void;
}

export function CreateStudentModal({ parents, onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [parentUserId, setParentUserId] = useState(parents[0]?.id || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${getApiUrl()}/api/admin/students`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          parentUserId,
          birthday: birthday || undefined,
          description: description || undefined,
          note: note || undefined,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to create student");
        return;
      }

      const parent = parents.find((p) => p.id === parentUserId);
      onCreate({
        ...body.data,
        parents: parent ? [parent] : [],
      });
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Add Student</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>
          )}

          <div>
            <label htmlFor="student-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              id="student-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label htmlFor="student-parent" className="block text-sm font-medium text-gray-700 mb-1">
              Parent
            </label>
            <select
              id="student-parent"
              value={parentUserId}
              onChange={(e) => setParentUserId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="student-birthday" className="block text-sm font-medium text-gray-700 mb-1">
              Birthday (optional)
            </label>
            <input
              id="student-birthday"
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label htmlFor="student-desc" className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              id="student-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={2}
            />
          </div>

          <div>
            <label htmlFor="student-note" className="block text-sm font-medium text-gray-700 mb-1">
              Note (optional)
            </label>
            <textarea
              id="student-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={2}
            />
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
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
