import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("Argon2id password handling", () => {
  it("stores a PHC hash and verifies the password", async () => {
    const { hashPassword, passwordHashNeedsUpgrade, verifyPassword } = await import("../src/lib/auth/password");
    const passwordHash = await hashPassword("a-correct-password");
    expect(passwordHash).toMatch(/^\$argon2id\$/);
    expect(passwordHash).not.toContain("a-correct-password");
    expect(await verifyPassword(passwordHash, "a-correct-password")).toBe(true);
    expect(await verifyPassword(passwordHash, "wrong-password")).toBe(false);
    expect(passwordHashNeedsUpgrade(passwordHash)).toBe(false);
  });
});
