import { afterEach, describe, expect, it } from "vitest";
import { passwordSchema, registrationSchema, usernameSchema } from "../src/lib/auth";
import { getSupabasePublicConfig, getSupabaseServerConfig, SupabaseConfigurationError } from "../src/lib/supabase/config";

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const originalService = process.env.SUPABASE_SERVICE_ROLE_KEY;

afterEach(() => {
  for (const [key, value] of [["NEXT_PUBLIC_SUPABASE_URL", originalUrl], ["NEXT_PUBLIC_SUPABASE_ANON_KEY", originalAnon], ["SUPABASE_SERVICE_ROLE_KEY", originalService]] as const) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

describe("player credentials", () => {
  it("accepts an eight character password and rejects seven", () => {
    expect(passwordSchema.safeParse("12345678").success).toBe(true);
    expect(passwordSchema.safeParse("1234567").success).toBe(false);
  });
  it("normalizes and validates usernames without an email", () => {
    expect(usernameSchema.parse(" Amin_1 ")).toBe("amin_1");
    expect(usernameSchema.safeParse("amin@example.com").success).toBe(false);
  });
  it("rejects mismatched confirmation", () => {
    const result = registrationSchema.safeParse({ displayName: "Amin", username: "amin", efootballUsername: "AMIN", selectedTeam: "", password: "12345678", passwordConfirm: "87654321" });
    expect(result.success).toBe(false);
  });
  it("requires only the requested player fields", () => {
    const result = registrationSchema.parse({ displayName: "Amin", username: "amin", efootballUsername: "AMIN", selectedTeam: "", password: "12345678", passwordConfirm: "12345678" });
    expect(result).not.toHaveProperty("email");
  });
});

describe("Supabase configuration", () => {
  it("fails clearly when public variables are missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(() => getSupabasePublicConfig()).toThrow(SupabaseConfigurationError);
  });
  it("requires the service role only on the server", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-ref.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-anon-value";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => getSupabaseServerConfig()).toThrow(SupabaseConfigurationError);
    process.env.SUPABASE_SERVICE_ROLE_KEY = "server-secret-value";
    expect(getSupabaseServerConfig()).toEqual({ url: "https://test-ref.supabase.co", anonKey: "public-anon-value", serviceRoleKey: "server-secret-value" });
  });
});
