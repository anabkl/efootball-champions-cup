const PLACEHOLDERS = ["your-project", "your-anon-key", "example", "placeholder"];

export class SupabaseConfigurationError extends Error {
  constructor(message = "Supabase n’est pas configuré. Ajoutez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local, puis redémarrez l’application.") {
    super(message);
    this.name = "SupabaseConfigurationError";
  }
}

export function getSupabaseServerConfig() {
  const { url, anonKey } = getSupabasePublicConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey || PLACEHOLDERS.some((value) => serviceRoleKey.includes(value))) {
    throw new SupabaseConfigurationError(
      "L’authentification serveur n’est pas configurée. Ajoutez SUPABASE_SERVICE_ROLE_KEY dans .env.local, puis redémarrez l’application.",
    );
  }
  return { url, anonKey, serviceRoleKey };
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

export function isSupabaseServerConfigured() {
  try { getSupabaseServerConfig(); return true; } catch { return false; }
}

export const SUPABASE_CONFIGURATION_MESSAGE = "Supabase n’est pas encore configuré. Copiez .env.example vers .env.local, renseignez l’URL, la clé publique anon et la clé service-role réservée au serveur, puis redémarrez l’application.";
