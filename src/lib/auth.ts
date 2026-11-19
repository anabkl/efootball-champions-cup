import { z } from "zod";

export const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, "3 à 24 caractères : lettres, chiffres et underscore.");
export const passwordSchema = z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères.").max(128);
export const registrationSchema = z.object({ displayName: z.string().trim().min(2).max(60), username: usernameSchema, password: passwordSchema, passwordConfirm: z.string(), efootballUsername: z.string().trim().min(2).max(60), selectedTeam: z.string().trim().max(60).optional() }).refine(data=>data.password===data.passwordConfirm,{message:"Les mots de passe ne correspondent pas.",path:["passwordConfirm"]});
export const loginSchema = z.object({ username: usernameSchema, password: z.string().min(1).max(128) });
