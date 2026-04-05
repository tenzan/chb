# Student Attendance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add enrollment tracking (student-to-subject) and attendance recording with a calendar UI showing attendance symbols per day.

**Architecture:** Two new DB tables (enrollments, attendance), CRUD API routes for each, enrollment management page, and a calendar-based attendance page. All following existing Astro SSR + vanilla JS + Tailwind patterns.

**Tech Stack:** Astro SSR, D1 (SQLite), Zod, Vitest + Miniflare, Tailwind CSS, vanilla JS

---

## File Structure

**New files to create:**

| File | Responsibility |
|------|---------------|
| `migrations/0006_enrollments.sql` | Enrollments table DDL |
| `migrations/0007_attendance.sql` | Attendance table DDL |
| `src/pages/api/admin/enrollments/index.ts` | GET list + POST create enrollment |
| `src/pages/api/admin/enrollments/[id].ts` | DELETE (soft-delete) enrollment |
| `src/pages/api/admin/attendance/index.ts` | GET query + POST upsert attendance |
| `src/pages/api/admin/attendance/[id].ts` | PATCH update single attendance record |
| `src/pages/admin/enrollments.astro` | Enrollment management page |
| `src/pages/admin/attendance.astro` | Calendar attendance view |
| `tests/api/admin-enrollments.test.ts` | Enrollment API tests |
| `tests/api/admin-attendance.test.ts` | Attendance API tests |

**Existing files to modify:**

| File | Change |
|------|--------|
| `src/lib/validation.ts` | Add enrollment + attendance Zod schemas |
| `src/lib/types.ts` | Add Enrollment + Attendance interfaces |
| `src/layouts/DashboardLayout.astro` | Add nav items for Enrollments + Attendance |
| `src/i18n/en.json` | Add enrollment + attendance English strings |
| `src/i18n/ru.json` | Add enrollment + attendance Russian strings |
| `tests/setup/test-env.ts` | Add `enrollments` and `attendance` to TABLES cleanup list |
| `tests/setup/seed.ts` | Add `createTestSubject` and `createTestEnrollment` helpers |

---

### Task 1: Database Migrations

**Files:**
- Create: `migrations/0006_enrollments.sql`
- Create: `migrations/0007_attendance.sql`
- Modify: `tests/setup/test-env.ts`

- [ ] **Step 1: Create enrollments migration**

Create `migrations/0006_enrollments.sql` with a CREATE TABLE for enrollments: id (TEXT PK), student_id (TEXT NOT NULL FK to users), subject_id (TEXT NOT NULL FK to subjects), started_at (TEXT with datetime default), ended_at (TEXT nullable), created_at (TEXT with datetime default), UNIQUE(student_id, subject_id).

- [ ] **Step 2: Create attendance migration**

Create `migrations/0007_attendance.sql` with a CREATE TABLE for attendance: id (TEXT PK), enrollment_id (TEXT NOT NULL FK to enrollments), date (TEXT NOT NULL), status (TEXT NOT NULL CHECK IN present/notified_absent/absent), note (TEXT nullable), recorded_by (TEXT NOT NULL FK to users), created_at and updated_at (TEXT with datetime defaults), UNIQUE(enrollment_id, date).

- [ ] **Step 3: Update test-env.ts TABLES list**

In `tests/setup/test-env.ts`, add `'attendance'` and `'enrollments'` to the front of the TABLES array (they have foreign keys to other tables so must be deleted first).

- [ ] **Step 4: Run tests to verify migrations load correctly**

Run: `npx vitest run tests/api/health.test.ts`
Expected: PASS — confirms Miniflare can load the new migrations without errors.

- [ ] **Step 5: Commit**

```bash
git add migrations/0006_enrollments.sql migrations/0007_attendance.sql tests/setup/test-env.ts
git commit -m "feat: add enrollments and attendance database tables"
```

---

### Task 2: Validation Schemas and Types

**Files:**
- Modify: `src/lib/validation.ts`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add Zod schemas to validation.ts**

Add at the end of `src/lib/validation.ts`:

- `createEnrollmentSchema`: z.object with student_id (string min 1) and subject_id (string min 1)
- `ATTENDANCE_STATUSES` const: `['present', 'notified_absent', 'absent'] as const`
- `createAttendanceSchema`: z.object with enrollment_id (string min 1), date (string regex YYYY-MM-DD), status (z.enum of ATTENDANCE_STATUSES), note (string optional)
- `updateAttendanceSchema`: z.object with status (z.enum optional), note (string optional)

- [ ] **Step 2: Add TypeScript interfaces to types.ts**

Add `Enrollment` interface: id, student_id, subject_id, student_name, subject_name, started_at, ended_at (string|null), created_at.

Add `AttendanceRecord` interface: id, enrollment_id, date, status ('present'|'notified_absent'|'absent'), note (string|null), recorded_by, created_at, updated_at.

- [ ] **Step 3: Commit**

```bash
git add src/lib/validation.ts src/lib/types.ts
git commit -m "feat: add enrollment and attendance validation schemas and types"
```

---

### Task 3: Seed Helpers

**Files:**
- Modify: `tests/setup/seed.ts`

- [ ] **Step 1: Add createTestSubject and createTestEnrollment helpers**

Add `createTestSubject(options?: { id?, name?, description? })` — inserts into subjects table, returns { id, name }.

Add `createTestEnrollment(options: { id?, studentId, subjectId })` — inserts into enrollments table, returns { id, studentId, subjectId }.

Both follow the existing `createTestUser` pattern using `getTestDB()` and prepared statements.

- [ ] **Step 2: Run existing tests to verify seed helpers don't break anything**

Run: `npx vitest run tests/api/admin-subjects.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/setup/seed.ts
git commit -m "feat: add test seed helpers for subjects and enrollments"
```

---

### Task 4: Enrollment API — Tests First

**Files:**
- Create: `tests/api/admin-enrollments.test.ts`

- [ ] **Step 1: Write enrollment API tests**

Tests to write (follow the pattern in `tests/api/admin-subjects.test.ts`):

**POST /api/admin/enrollments:**
- enrolls a student in a subject (201, returns id/student_id/subject_id)
- rejects duplicate enrollment (409)
- returns 404 for non-existent student
- returns 404 for non-existent subject
- validates required fields (400)
- requires Admin role (403)

**GET /api/admin/enrollments:**
- lists all enrollments with student_name and subject_name via JOINs
- filters by student_id query param
- filters by subject_id query param
- requires Admin role (403)

**DELETE /api/admin/enrollments/:id:**
- soft-deletes by setting ended_at (verify row still exists with non-null ended_at)
- returns 404 for non-existent enrollment
- requires Admin role (403)

Use the same mock user pattern: `adminUser` with Admin role, `tutorUser` with Tutor role. Seed roles + test users before each test. Use `createTestSubject` and direct DB inserts for enrollments.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/api/admin-enrollments.test.ts`
Expected: FAIL — route files don't exist yet.

- [ ] **Step 3: Commit**

```bash
git add tests/api/admin-enrollments.test.ts
git commit -m "test: add enrollment API tests (red)"
```

---

### Task 5: Enrollment API — Implementation

**Files:**
- Create: `src/pages/api/admin/enrollments/index.ts`
- Create: `src/pages/api/admin/enrollments/[id].ts`

- [ ] **Step 1: Create enrollment list + create route**

`src/pages/api/admin/enrollments/index.ts` — exports GET and POST:

**GET:** Admin-only. Queries enrollments with JOINs to users (student_name) and subjects (subject_name). Supports optional `student_id` and `subject_id` query params as WHERE filters. Returns `{ data: [...] }`.

**POST:** Admin-only. Validates body with `createEnrollmentSchema`. Checks student and subject exist (404 if not). Checks for existing enrollment with same student_id+subject_id (409 if exists). Inserts with `generateId()`. Returns 201 with `{ data: { id, student_id, subject_id } }`.

- [ ] **Step 2: Create enrollment delete route**

`src/pages/api/admin/enrollments/[id].ts` — exports DELETE:

Admin-only. Checks enrollment exists (404). Sets `ended_at` to current timestamp (soft delete). Returns `{ data: { id } }`.

- [ ] **Step 3: Run enrollment tests**

Run: `npx vitest run tests/api/admin-enrollments.test.ts`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/admin/enrollments/
git commit -m "feat: implement enrollment API routes"
```

---

### Task 6: Attendance API — Tests First

**Files:**
- Create: `tests/api/admin-attendance.test.ts`

- [ ] **Step 1: Write attendance API tests**

Create a shared helper `setupStudentWithEnrollment()` that seeds roles, creates admin user, student, subject, and enrollment — returns all four.

**POST /api/admin/attendance:**
- records attendance for an enrollment (201, returns enrollment_id/date/status)
- upserts: when record exists for same enrollment+date, updates it (200, only 1 row in DB)
- records attendance with a note
- returns 404 for non-existent enrollment
- validates date format (rejects "April 1" — expects YYYY-MM-DD)
- validates status enum (rejects "late")
- requires Admin role (403)

**GET /api/admin/attendance:**
- filters by student_id and month (returns only matching month's records)
- returns subject_name and student_name via JOINs
- requires Admin role (403)

**PATCH /api/admin/attendance/:id:**
- updates attendance status
- updates attendance note
- returns 404 for non-existent attendance
- requires Admin role (403)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/api/admin-attendance.test.ts`
Expected: FAIL — route files don't exist yet.

- [ ] **Step 3: Commit**

```bash
git add tests/api/admin-attendance.test.ts
git commit -m "test: add attendance API tests (red)"
```

---

### Task 7: Attendance API — Implementation

**Files:**
- Create: `src/pages/api/admin/attendance/index.ts`
- Create: `src/pages/api/admin/attendance/[id].ts`

- [ ] **Step 1: Create attendance list + upsert route**

`src/pages/api/admin/attendance/index.ts` — exports GET and POST:

**GET:** Admin-only. Queries attendance with JOINs through enrollments to subjects and users. Supports optional `student_id`, `subject_id`, and `month` (YYYY-MM) filters. Month filter uses `a.date LIKE ?` with `month + "%"`. Returns `{ data: [...] }` with subject_name, student_name, etc.

**POST:** Admin-only. Validates with `createAttendanceSchema`. Checks enrollment exists (404). Checks if attendance record already exists for enrollment_id+date:
- If exists: UPDATE status, note, recorded_by, updated_at. Return 200.
- If not: INSERT new record with `generateId()`. Return 201.
Uses `locals.user!.id` as `recorded_by`.

- [ ] **Step 2: Create attendance PATCH route**

`src/pages/api/admin/attendance/[id].ts` — exports PATCH:

Admin-only. Checks record exists (404). Validates with `updateAttendanceSchema`. Dynamic SET clauses for provided fields (same pattern as subjects PATCH). Returns updated record.

- [ ] **Step 3: Run all attendance and enrollment tests**

Run: `npx vitest run tests/api/admin-enrollments.test.ts tests/api/admin-attendance.test.ts`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/admin/attendance/
git commit -m "feat: implement attendance API routes with upsert"
```

---

### Task 8: i18n Translations

**Files:**
- Modify: `src/i18n/en.json`
- Modify: `src/i18n/ru.json`

- [ ] **Step 1: Add English translations**

In `nav` section add: `"enrollments": "Enrollments"`, `"attendance": "Attendance"`

Add `"enrollments"` section with: enrollStudent, unenroll, student, subject, started, status, active, ended, enrollmentCount/enrollmentCountOne (with {count} param), noEnrollments, selectStudent, selectSubject, confirmUnenroll (with {student} and {subject} params), failedSave, failedUnenroll, alreadyEnrolled.

Add `"attendance"` section with: recordAttendance, present ("Present"), notifiedAbsent ("Notified"), absent ("Absent"), notRecorded, noEnrollmentsForStudent, selectStudent, noteOptional, failedSave, failedLoad, today, monthNames (array of 12 month names), dayNamesShort (array: Mon-Sun).

- [ ] **Step 2: Add Russian translations**

Nav: `"enrollments": "Зачисления"`, `"attendance": "Посещаемость"`

Enrollments section: enrollStudent="Зачислить ученика", unenroll="Отчислить", student="Ученик", subject="Предмет", started="Начало", status="Статус", active="Активно", ended="Завершено", enrollmentCount="{count} зачислений", enrollmentCountOne="{count} зачисление", noEnrollments="Зачислений пока нет...", selectStudent="Выберите ученика", selectSubject="Выберите предмет", confirmUnenroll="Отчислить \"{student}\" от \"{subject}\"?", failedSave="Не удалось сохранить зачисление", failedUnenroll="Не удалось отчислить", alreadyEnrolled="Ученик уже зачислен на этот предмет".

Attendance section: recordAttendance="Отметить посещаемость", present="Присутствовал", notifiedAbsent="Предупредил", absent="Отсутствовал", notRecorded="Не отмечено", noEnrollmentsForStudent="У этого ученика нет активных зачислений.", selectStudent="Выберите ученика", noteOptional="Заметка (необязательно)", failedSave="Не удалось сохранить посещаемость", failedLoad="Не удалось загрузить посещаемость", today="Сегодня", monthNames=["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"], dayNamesShort=["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].

- [ ] **Step 3: Commit**

```bash
git add src/i18n/en.json src/i18n/ru.json
git commit -m "feat: add enrollment and attendance i18n translations (en + ru)"
```

---

### Task 9: Navigation Update

**Files:**
- Modify: `src/layouts/DashboardLayout.astro`

- [ ] **Step 1: Add nav items**

In `DashboardLayout.astro` around line 13-18, add two new items to the `navItems` array after "subjects" and before "deployments":

```typescript
{ href: "/admin/enrollments", label: t(locale, "nav.enrollments") },
{ href: "/admin/attendance", label: t(locale, "nav.attendance") },
```

- [ ] **Step 2: Commit**

```bash
git add src/layouts/DashboardLayout.astro
git commit -m "feat: add enrollments and attendance to admin sidebar nav"
```

---

### Task 10: Enrollments Admin Page

**Files:**
- Create: `src/pages/admin/enrollments.astro`

- [ ] **Step 1: Create the enrollments page**

Follow the pattern from `src/pages/admin/subjects.astro`. Key elements:

**HTML structure:**
- Wrapped in `DashboardLayout` with title from i18n `nav.enrollments`
- Top bar: enrollment count + "Enroll Student" button
- Table with columns: Student, Subject, Started, Status (Active/Ended badge), Actions
- Enroll modal: form with student dropdown + subject dropdown
- Unenroll confirmation modal

**Script logic:**
- `loadEnrollments()`: GET `/api/admin/enrollments`, populate table
- `loadDropdowns()`: parallel fetch students + subjects for the modal selects
- `renderEnrollments()`: build table rows with escapeHtml, show Active/Ended status badges (green/gray)
- Add enrollment: POST to `/api/admin/enrollments` with student_id + subject_id
- Unenroll: DELETE to `/api/admin/enrollments/:id`, refresh table
- All strings via `__t()` global function
- Use `escapeHtml()` for all dynamic content rendered as HTML (same pattern as subjects page)

- [ ] **Step 2: Verify page loads in browser**

Open `http://localhost:4321/admin/enrollments` — should show the enrollment table with "Enroll Student" button.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/enrollments.astro
git commit -m "feat: add enrollments admin page with CRUD UI"
```

---

### Task 11: Attendance Calendar Admin Page

**Files:**
- Create: `src/pages/admin/attendance.astro`

- [ ] **Step 1: Create the attendance calendar page**

Follow the pattern from `src/pages/admin/subjects.astro` for the Astro wrapper. Key elements:

**HTML structure:**
- Wrapped in `DashboardLayout` with title from i18n `nav.attendance`
- Top controls: student dropdown (left), month nav arrows + month label + "Today" button (right)
- Calendar container: 7-column grid header row with day name abbreviations (Mon-Sun from i18n), then a `#calendar-grid` div filled by JS
- "Select a student" placeholder shown when no student selected
- Attendance modal: title with date, list of enrolled subjects each with 3-way status toggle buttons and a note input, save/cancel

**Script state:**
- `currentYear`, `currentMonth`: track displayed month
- `attendance[]`: loaded attendance records for current student+month
- `enrollments[]`: active enrollments for current student
- `selectedDate`: which day was clicked
- `STATUS_SYMBOLS` map: present -> green circle, notified_absent -> orange triangle, absent -> red cross

**Calendar rendering:**
- Calculate first day of month, days in month, starting day-of-week offset (Monday = 0)
- Empty gray cells before first day, then day cells with date number and attendance symbols
- Each day cell has `data-date="YYYY-MM-DD"` and is clickable
- Today's date gets a blue circle highlight
- Each attendance symbol shows colored icon + 3-letter subject abbreviation

**Attendance modal logic:**
- On day click: `openAttendanceModal(date)` — shows all enrolled subjects
- Each subject row: 3 toggle buttons (present/notified/absent) with color states, plus note input
- Pre-select existing attendance status for that day if present
- Status toggle: clicking a button highlights it, unhighlights others in same row
- Save: iterate all subject rows, POST to `/api/admin/attendance` for each one that has a selected status

**Data loading:**
- `loadStudents()`: populate student dropdown from `/api/admin/students`
- `loadEnrollments(studentId)`: GET enrollments filtered by student, keep only active ones
- `loadAttendance()`: GET attendance filtered by student_id + month
- Student change: reload enrollments + attendance, re-render calendar
- Month nav: reload attendance, re-render calendar

- [ ] **Step 2: Verify page loads in browser**

Open `http://localhost:4321/admin/attendance` — should show the student dropdown and calendar grid.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/attendance.astro
git commit -m "feat: add attendance calendar admin page with recording UI"
```

---

### Task 12: Run Full Test Suite

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: ALL PASS (existing tests + new enrollment + attendance tests)

- [ ] **Step 2: If any failures, fix and re-run**

- [ ] **Step 3: Final commit if any fixes were needed**

---

### Task 13: Manual Smoke Test

- [ ] **Step 1: Test enrollment flow**

1. Go to `/admin/enrollments`
2. Click "Enroll Student" — verify both dropdowns load
3. Select a student + subject, save — verify row appears
4. Click "Unenroll" — verify status changes to "Ended"

- [ ] **Step 2: Test attendance flow**

1. Go to `/admin/attendance`
2. Select a student from dropdown — verify calendar renders
3. Click a day — verify modal shows enrolled subjects with status buttons
4. Click a status button, add a note, save — verify symbol appears on calendar
5. Click the same day again — verify previous status is pre-selected
6. Navigate months — verify data loads correctly

- [ ] **Step 3: Test i18n**

1. Switch to Russian (RU button)
2. Verify nav labels show Russian text
3. Verify Russian labels on both pages
4. Verify Russian month names and day names on calendar
