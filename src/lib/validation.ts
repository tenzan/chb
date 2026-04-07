import { z } from "zod";

const VALID_ROLES = [
  "Admin",
  "Personnel",
  "Tutor",
  "Accountant",
  "Parent",
  "Student",
] as const;

export const loginSchema = z.object({
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1),
  turnstileToken: z.string().optional().default(""),
});

export const inviteSchema = z.object({
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase()),
  roleName: z.enum(VALID_ROLES),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1),
  password: z.string().min(6),
});

export const createParentSchema = z.object({
  email: z
    .union([
      z.string().email().transform((v) => v.toLowerCase()),
      z.literal(""),
      z.undefined(),
    ])
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  name: z.string().min(1),
  phone: z.string().optional(),
  note: z.string().optional(),
});

export const createStudentSchema = z.object({
  name: z.string().min(1),
  parentUserId: z.string().min(1),
  birthday: z.string().optional(),
  description: z.string().optional(),
  note: z.string().optional(),
});

export const updateStudentSchema = z.object({
  name: z.string().min(1).optional(),
  birthday: z.string().optional(),
  description: z.string().optional(),
  note: z.string().optional(),
});

export const manageRolesSchema = z.object({
  add: z.array(z.enum(VALID_ROLES)).default([]),
  remove: z.array(z.enum(VALID_ROLES)).default([]),
});

export const generatePasswordResetSchema = z.object({
  userId: z.string().min(1),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
});

export const createSubjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const updateSubjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

export const createUserSchema = z.object({
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase()),
  name: z.string().min(1),
  password: z.string().min(6),
  roles: z.array(z.enum(VALID_ROLES)).min(1),
  phone: z.string().optional(),
  note: z.string().optional(),
});

export const createEnrollmentSchema = z.object({
  student_id: z.string().min(1),
  subject_id: z.string().min(1),
});

const ATTENDANCE_STATUSES = ['present', 'notified_absent', 'absent'] as const;

export const createAttendanceSchema = z.object({
  enrollment_id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  status: z.enum(ATTENDANCE_STATUSES),
  note: z.string().optional(),
});

export const updateAttendanceSchema = z.object({
  status: z.enum(ATTENDANCE_STATUSES).optional(),
  note: z.string().optional(),
});
