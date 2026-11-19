import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "./session";

export const currentSession = cache(getCurrentSession);

export async function requireUser() {
  const session = await currentSession();
  if (!session) redirect("/login");
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN" || !user.isSuperAdmin) redirect("/dashboard");
  return user;
}
