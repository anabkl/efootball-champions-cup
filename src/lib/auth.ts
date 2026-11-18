import { z } from "zod";

export const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, "3–24 characters: letters, numbers, underscore.");
export const passwordSchema = z.string().min(10, "Use at least 10 characters.").max(128);
export const registrationSchema = z.object({ displayName: z.string().trim().min(2).max(60), username: usernameSchema, password: passwordSchema, efootballUsername: z.string().trim().min(2).max(60), selectedTeam: z.string().trim().max(60).optional() });
export const loginSchema = z.object({ username: usernameSchema, password: z.string().min(1).max(128) });
export function usernameToEmail(username: string) { return `${username.toLowerCase()}@players.efootball-champions-cup.invalid`; }
