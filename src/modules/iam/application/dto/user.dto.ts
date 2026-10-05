import { z } from "zod";

export const LoginSchema = z.object({
  email: z.email({ error: "Format email tidak valid" }),
  password: z
    .string({ error: "Kata sandi wajib diisi" })
    .min(1, { error: "Kata sandi wajib diisi" }),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const CreateUserSchema = z.object({
  email: z.email({ error: "Format email tidak valid" }),
  password: z
    .string({ error: "Kata sandi wajib diisi" })
    .min(6, { error: "Kata sandi minimal 6 karakter" }),
  fullName: z
    .string({ error: "Nama lengkap wajib diisi" })
    .min(1, { error: "Nama lengkap wajib diisi" }),
  roleId: z.uuid({ error: "Role tidak valid" }),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  fullName: z.string().min(1, { error: "Nama lengkap wajib diisi" }).optional(),
  roleId: z.uuid({ error: "Role tidak valid" }).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
