import { z } from "zod";

export const PASSWORD_MIN = 10;

export const emailField = z.email("invalid_email").trim().toLowerCase();
export const passwordField = z.string().min(PASSWORD_MIN, "password_too_short").max(128);
export const nameField = z.string().trim().min(1, "required").max(40);

export const loginSchema = z.object({ email: emailField, password: z.string().min(1, "required") });

export const setupSchema = z.object({
  setupToken: z.string().min(1, "required"),
  householdName: z.string().trim().min(1, "required").max(60),
  name: nameField,
  email: emailField,
  password: passwordField,
});

export const inviteSchema = z.object({
  token: z.string().min(1),
  name: nameField,
  email: emailField,
  password: passwordField,
});

export const resetSchema = z.object({ token: z.string().min(1), password: passwordField });

export const twoFactorSchema = z.object({
  code: z.string().trim().min(6, "invalid_code").max(32),
  method: z.enum(["totp", "backup"]),
  trustDevice: z.boolean(),
});
