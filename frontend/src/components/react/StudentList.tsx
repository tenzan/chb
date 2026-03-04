import { useEffect, useState } from "react";
import { getApiUrl } from "../../lib/config";
import { CreateStudentModal } from "./CreateStudentModal";
import { EditStudentModal } from "./EditStudentModal";

interface Student {
  id: string;
  name: string;
  birthday: string | null;
  description: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  parents: Array<{ id: string; name: string; email: string }>;
}

interface Parent {
  id: string;
  name: string;
  email: string;
}

export function StudentList() {
  const [students, setStudents] = useState<Student[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredStudents = students.filter((student) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (student.name.toLowerCase().includes(q)) return true;
    return student.parents.some((p) => p.name.toLowerCase().includes(q));
  });

  useEffect(() => {
    Promise.all([
      fetch(`${getApiUrl()}/api/admin/students`, { credentials: "include" }).then((r) =>
        r.ok ? r.json() : { data: [] }
      ),
      fetch(`${getApiUrl()}/api/admin/parents`, { credentials: "include" }).then((r) =>
        r.ok ? r.json() : { data: [] }
      ),
    ])
      .then(([studentsBody, parentsBody]) => {
        setStudents(studentsBody.data);
        setParents(parentsBody.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = (newStudent: Student) => {
    setStudents([newStudent, ...students]);
    setShowCreate(false);
  };

  const handleUpdate = (updated: Student) => {
    setStudents(students.map((s) => (s.id === updated.id ? updated : s)));
    setEditingStudent(null);
  };

  if (loading) {
    return <p className="text-gray-500">Loading...</p>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">
          {searchQuery
            ? `${filteredStudents.length} of ${students.length} students`
            : `${students.length} students`}
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
        >
          Add Student
        </button>
      </div>

      <div className="relative mb-4">
        <input
          type="text"
          placeholder="Search by student or parent name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Birthday</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parents</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredStudents.map((student) => (
              <tr key={student.id}>
                <td className="px-4 py-3 text-sm text-gray-900">{student.name}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{student.birthday || "-"}</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {student.parents.map((p) => p.name).join(", ") || "-"}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setEditingStudent(student)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateStudentModal
          parents={parents}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}

      {editingStudent && (
        <EditStudentModal
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
