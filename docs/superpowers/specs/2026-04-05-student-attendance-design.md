# Student Attendance Feature — Design Spec

## Overview

Track student attendance per subject on a calendar view. Staff can record whether a student attended, notified in advance of absence, or was a no-show. Requires an enrollment system to link students to subjects.

## Data Model

### `enrollments` table

Links students to subjects. A student must be enrolled in a subject before attendance can be recorded.

```sql
CREATE TABLE enrollments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id),
  subject_id TEXT NOT NULL REFERENCES subjects(id),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,          -- NULL = active enrollment
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(student_id, subject_id)
);
```

### `attendance` table

One record per student per subject per date. Three statuses:

- `present` — student attended (displayed as green circle `●`)
- `notified_absent` — student notified staff in advance (displayed as orange triangle `▲`)
- `absent` — student was a no-show (displayed as red cross `✕`)

```sql
CREATE TABLE attendance (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id),
  date TEXT NOT NULL,     -- 'YYYY-MM-DD'
  status TEXT NOT NULL CHECK(status IN ('present', 'notified_absent', 'absent')),
  note TEXT,
  recorded_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(enrollment_id, date)
);
```

## API Routes

### Enrollments

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/enrollments` | List enrollments. Filter: `?student_id=`, `?subject_id=` |
| POST | `/api/admin/enrollments` | Enroll student in subject: `{ student_id, subject_id }` |
| DELETE | `/api/admin/enrollments/[id]` | Unenroll (sets `ended_at`, soft delete) |

### Attendance

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/attendance` | Query attendance. Filter: `?student_id=`, `?subject_id=`, `?month=YYYY-MM` |
| POST | `/api/admin/attendance` | Record attendance (upsert): `{ enrollment_id, date, status, note? }` |
| PATCH | `/api/admin/attendance/[id]` | Update a single attendance record |

POST attendance upserts: if a record exists for that enrollment+date, it updates instead of creating a duplicate.

All routes require Admin or Personnel role.

## Admin UI

### Page: `/admin/enrollments` — Enrollment Management

- Table listing: Student name | Subject | Started date | Status (Active/Ended) | Actions
- "Enroll Student" button opens modal with student dropdown + subject dropdown
- Unenroll action sets `ended_at` (soft delete)
- Follows existing admin page patterns (vanilla JS, Tailwind, modal-based CRUD)

### Page: `/admin/attendance` — Calendar View

**Top controls:**
- Student dropdown (select which student to view)
- Month navigation: `← April 2026 →`

**Calendar grid:**
- Standard monthly calendar (7 columns for days of week)
- Each day cell shows the student's enrolled subjects with attendance symbols:
  - `●` green = present
  - `▲` orange = notified absent
  - `✕` red = absent
  - Empty = not yet recorded
- Subject name shown as small label next to each symbol

**Recording attendance (click a day):**
- Modal opens showing that student's active enrollments
- For each subject: a 3-way toggle button group (●/▲/✕) + optional note field
- Save records/updates attendance for all subjects at once
- Uses upsert POST endpoint

### Navigation

Two new sidebar items in `DashboardLayout.astro`:
- "Enrollments" → `/admin/enrollments`
- "Attendance" → `/admin/attendance`

## i18n

All UI strings in both `en.json` and `ru.json`:
- Nav labels: enrollments, attendance
- Enrollment page: enroll student, unenroll, active/ended status, empty states, errors
- Attendance page: calendar labels, month names, day names, status labels (present/notified/absent), modal titles, save/cancel, empty states
- Attendance statuses: present/notified absent/absent with Russian translations

## Validation (Zod)

- `createEnrollmentSchema`: `{ student_id: string, subject_id: string }`
- `createAttendanceSchema`: `{ enrollment_id: string, date: string (YYYY-MM-DD), status: enum, note?: string }`
- `updateAttendanceSchema`: `{ status?: enum, note?: string }`

## Patterns to Follow

- Astro SSR pages with vanilla JS `<script>` blocks (no React)
- `DashboardLayout` wrapper
- `getDB(locals)` for DB access
- `hasRole(locals.user!, 'Admin')` for auth checks
- `crypto.randomUUID()` for IDs
- `{ data: ... }` / `{ error: "..." }` response format
- `__t()` global function for client-side translations
- Modal-based forms matching existing subjects/users pages
