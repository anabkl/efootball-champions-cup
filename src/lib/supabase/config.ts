const PLACEHOLDERS = ["your-project", "your-anon-key", "example", "placeholder"];

export class SupabaseConfigurationError extends Error {
  constructor() {
    super("Supabase n’est pas configuré. Ajoutez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local, puis redémarrez l’application.");
    this.name = "SupabaseConfigurationError";
  }
}

export function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const invalid = !url || !anonKey || !URL.canParse(url) || PLACEHOLDERS.some(value => url.includes(value) || anonKey.includes(value));
  if (invalid) throw new SupabaseConfigurationError();
  return { url, anonKey };
}

export function isSupabaseConfigured() {
  try { getSupabasePublicConfig(); return true; } catch { return false; }
}

export const SUPABASE_CONFIGURATION_MESSAGE = "Supabase n’est pas encore configuré. Copiez .env.example vers .env.local, renseignez l’URL et la clé publique anon de votre projet, puis redémarrez le serveur.";
