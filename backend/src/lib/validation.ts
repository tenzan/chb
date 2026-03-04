import { z } from "zod";

const VALID_ROLES = ["Admin", "Personnel", "Tutor", "Accountant", "Parent"] as const;

export const loginSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  password: z.string().min(1),
  turnstileToken: z.string().optional().default(""),
});

export const inviteSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  roleName: z.enum(VALID_ROLES),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1),
  password: z.string().min(6),
});

export const createParentSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
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

export const createUserSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  name: z.string().min(1),
  password: z.string().min(6),
  roles: z.array(z.enum(VALID_ROLES)).min(1),
  phone: z.string().optional(),
  note: z.string().optional(),
});
