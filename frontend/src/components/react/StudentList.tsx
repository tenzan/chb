import { useState } from "react";
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

interface Props {
  students: Student[];
  parents?: Parent[];
}

export function StudentList({ students: initialStudents, parents = [] }: Props) {
  const [students, setStudents] = useState(initialStudents);
  const [showCreate, setShowCreate] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const handleCreate = (newStudent: Student) => {
    setStudents([newStudent, ...students]);
    setShowCreate(false);
  };

  const handleUpdate = (updated: Student) => {
    setStudents(students.map((s) => (s.id === updated.id ? updated : s)));
    setEditingStudent(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{students.length} students</p>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
        >
          Add Student
        </button>
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
            {students.map((student) => (
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
