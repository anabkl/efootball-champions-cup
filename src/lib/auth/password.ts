import "server-only";

import { hash, parseOptions, verify } from "@node-rs/argon2";

const ARGON2_POLICY = {
  algorithm: 2,
  version: 1,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

let dummyHash: Promise<string> | undefined;

export function hashPassword(password: string) {
  return hash(password, ARGON2_POLICY);
}

export function verifyPassword(passwordHash: string, password: string) {
  return verify(passwordHash, password);
}

export async function verifyPasswordOrDummy(passwordHash: string | null, password: string) {
  if (passwordHash) return verifyPassword(passwordHash, password);
  dummyHash ??= hashPassword("constant-dummy-password-never-used-for-login");
  await verifyPassword(await dummyHash, password);
  return false;
}

export function passwordHashNeedsUpgrade(passwordHash: string) {
  const parsed = parseOptions(passwordHash);
  return parsed.algorithm !== ARGON2_POLICY.algorithm
    || parsed.version !== ARGON2_POLICY.version
    || parsed.memoryCost !== ARGON2_POLICY.memoryCost
    || parsed.timeCost !== ARGON2_POLICY.timeCost
    || parsed.parallelism !== ARGON2_POLICY.parallelism
    || parsed.outputLen !== ARGON2_POLICY.outputLen
    || parsed.saltLen < 16;
}
