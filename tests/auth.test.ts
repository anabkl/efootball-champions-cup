import { afterEach, describe, expect, it } from "vitest";
import { passwordSchema, registrationSchema, usernameToEmail } from "../src/lib/auth";
import { getSupabasePublicConfig, SupabaseConfigurationError } from "../src/lib/supabase/config";

const originalUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
afterEach(()=>{if(originalUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=originalUrl;if(originalKey===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY=originalKey;});

describe("player credentials",()=>{
  it("accepts an eight character password and rejects seven",()=>{expect(passwordSchema.safeParse("12345678").success).toBe(true);expect(passwordSchema.safeParse("1234567").success).toBe(false)});
  it("rejects mismatched confirmation",()=>{const result=registrationSchema.safeParse({displayName:"Anas",username:"anas_1",efootballUsername:"ANAS",selectedTeam:"",password:"12345678",passwordConfirm:"87654321"});expect(result.success).toBe(false)});
  it("maps username internally without asking the player for email",()=>expect(usernameToEmail("Anas_1")).toBe("anas_1@players.efootball-champions-cup.invalid"));
});

describe("Supabase configuration",()=>{
  it("fails clearly when public variables are missing",()=>{delete process.env.NEXT_PUBLIC_SUPABASE_URL;delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;expect(()=>getSupabasePublicConfig()).toThrow(SupabaseConfigurationError)});
  it("rejects placeholder values from .env.example",()=>{process.env.NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co";process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key";expect(()=>getSupabasePublicConfig()).toThrow(SupabaseConfigurationError)});
  it("returns configured values without logging them",()=>{process.env.NEXT_PUBLIC_SUPABASE_URL="https://test-ref.supabase.co";process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY="public-anon-value";expect(getSupabasePublicConfig()).toEqual({url:"https://test-ref.supabase.co",anonKey:"public-anon-value"})});
});
