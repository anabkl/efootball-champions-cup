import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "./supabase/config";
export const supabase = () => {const {url,anonKey}=getSupabasePublicConfig();return createBrowserClient(url,anonKey);};
