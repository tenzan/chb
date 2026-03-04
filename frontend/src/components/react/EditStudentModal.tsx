import { useState } from "react";

import { getApiUrl } from "../../lib/config";

interface Student {
  id: string;
  name: string;
  birthday: string | null;
  description: string | null;
  note: string | null;
}

interface Props {
  student: Student;
  onClose: () => void;
  onUpdate: (student: any) => void;
}

export function EditStudentModal({ student, onClose, onUpdate }: Props) {
  const [name, setName] = useState(student.name);
  const [birthday, setBirthday] = useState(student.birthday || "");
  const [description, setDescription] = useState(student.description || "");
  const [note, setNote] = useState(student.note || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${getApiUrl()}/api/admin/students/${student.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          birthday: birthday || undefined,
          description: description || undefined,
          note: note || undefined,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to update student");
        return;
      }

      onUpdate(body.data);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Edit Student</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>
          )}

          <div>
            <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              id="edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label htmlFor="edit-birthday" className="block text-sm font-medium text-gray-700 mb-1">
              Birthday
            </label>
            <input
              id="edit-birthday"
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label htmlFor="edit-desc" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={2}
            />
          </div>

          <div>
            <label htmlFor="edit-note" className="block text-sm font-medium text-gray-700 mb-1">
              Note
            </label>
            <textarea
              id="edit-note"
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
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
