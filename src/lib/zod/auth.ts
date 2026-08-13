import { z } from 'zod';

export const sendCodeSchema = z.object({
  email: z.string().trim().email(),
});

export const registerSchema = z.object({
  email: z.string().trim().email(),
  code: z.string().length(6, '验证码为 6 位数字'),
  username: z.string().trim().min(2).max(30),
  password: z
    .string()
    .min(8, '密码至少 8 位')
    .regex(/^(?=.*[a-zA-Z])(?=.*\d)/, '密码需同时包含字母和数字'),
  school: z.string().trim().min(1),
  college: z.string().trim().min(1),
  major: z.string().trim().min(1),
  grade: z.string().trim().min(1),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const creatorApplySchema = z.object({
  bio: z.string().trim().min(1).max(500),
  direction: z.string().trim().min(1).max(50),
  honor: z.string().trim().max(200).optional(),
  studentCardKey: z.string().trim().max(200).optional(),
});

export const studentProfileSchema = z.object({
  school: z.string(),
  college: z.string(),
  major: z.string(),
  grade: z.string(),
  verifyStatus: z.string(),
});

export const creatorProfileSchema = z.object({
  id: z.string(),
  bio: z.string(),
  direction: z.string(),
  honor: z.string().nullable(),
  verified: z.boolean(),
});

// AuthUser 响应（契约 §3）
export const authUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  role: z.enum(['STUDENT', 'CREATOR', 'ADMIN']),
  avatarColor: z.string(),
  student: studentProfileSchema.optional(),
  creator: creatorProfileSchema.nullable(),
  unreadCount: z.number(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SendCodeInput = z.infer<typeof sendCodeSchema>;
export type CreatorApplyInput = z.infer<typeof creatorApplySchema>;
