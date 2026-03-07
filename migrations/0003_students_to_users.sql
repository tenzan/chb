-- Add Student role
INSERT INTO roles (name) VALUES ('Student');

-- Add student-specific columns to users
ALTER TABLE users ADD COLUMN birthday TEXT;
ALTER TABLE users ADD COLUMN description TEXT;

-- Move students into users (no password — can't log in yet)
INSERT INTO users (id, name, birthday, description, note, created_at, updated_at)
  SELECT id, name, birthday, description, note, created_at, updated_at FROM students;

-- Assign Student role to migrated users
INSERT INTO user_roles (user_id, role_id)
  SELECT s.id, r.id FROM students s, roles r WHERE r.name = 'Student';

-- Rebuild parent_students with clean column names
CREATE TABLE parent_students_new (
  parent_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  PRIMARY KEY (parent_id, student_id)
);
INSERT INTO parent_students_new (parent_id, student_id, created_at)
  SELECT parent_user_id, student_id, created_at FROM parent_students;
DROP TABLE parent_students;
ALTER TABLE parent_students_new RENAME TO parent_students;

-- Drop old students table
DROP TABLE students;
