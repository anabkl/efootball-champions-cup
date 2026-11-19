"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";

function mutationError(label: string, error: { code?: string } | null) {
  if (error) throw new Error(`${label} (${error.code ?? "database_error"})`);
}

export async function createTournament(formData: FormData) {
  const user = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (name.length < 3 || name.length > 80 || code.length < 3 || code.length > 30) throw new Error("Nom ou code invalide.");
  const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const { error } = await createAdminClient().from("tournaments").insert({
    name,
    slug,
    invitation_code: code,
    created_by: user.id,
    min_participants: 6,
    status: "DRAFT",
  });
  mutationError("Création du tournoi impossible", error);
  revalidatePath("/admin");
}

export async function joinTournament(id: string) {
  const user = await requireUser();
  const { error } = await createAdminClient().rpc("app_join_tournament", { actor_id: user.id, tid: id });
  mutationError("Inscription impossible", error);
  revalidatePath("/dashboard");
}

export async function setRegistration(id: string, open: boolean) {
  const user = await requireAdmin();
  const { error } = await createAdminClient().rpc("app_admin_set_registration", { actor_id: user.id, tid: id, open });
  mutationError("Modification des inscriptions impossible", error);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function confirmMember(tid: string, pid: string, approved: boolean) {
  const user = await requireAdmin();
  const { error } = await createAdminClient().rpc("app_admin_confirm_member", { actor_id: user.id, tid, pid, approved });
  mutationError("Confirmation du joueur impossible", error);
  revalidatePath("/admin");
}

export async function startTournament(tid: string) {
  const user = await requireAdmin();
  const { error } = await createAdminClient().rpc("app_admin_start_tournament", { actor_id: user.id, tid });
  mutationError("Démarrage impossible", error);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function generateDraw(tid: string, groups: number) {
  const user = await requireAdmin();
  if (!Number.isInteger(groups) || groups < 2 || groups > 8) throw new Error("Nombre de groupes invalide.");
  const { error } = await createAdminClient().rpc("app_admin_generate_draw", { actor_id: user.id, tid, group_count: groups });
  mutationError("Tirage impossible", error);
  revalidatePath("/admin");
}

export async function confirmDraw(tid: string) {
  const user = await requireAdmin();
  const { error } = await createAdminClient().rpc("app_admin_confirm_draw", { actor_id: user.id, tid });
  mutationError("Confirmation du tirage impossible", error);
  revalidatePath("/admin");
}

export async function recordResult(matchId: string, home: number, away: number) {
  const user = await requireAdmin();
  if (![home, away].every((score) => Number.isInteger(score) && score >= 0 && score <= 99)) throw new Error("Score invalide.");
  const { error } = await createAdminClient().rpc("app_admin_record_result", {
    actor_id: user.id,
    mid: matchId,
    home_goals: home,
    away_goals: away,
    penalties_h: null,
    penalties_a: null,
  });
  mutationError("Enregistrement du score impossible", error);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function saveWhatsApp(formData: FormData) {
  const user = await requireUser();
  const phone = String(formData.get("whatsapp") ?? "").trim() || null;
  if (phone && !/^\+?[1-9][0-9]{7,14}$/.test(phone)) throw new Error("Numéro WhatsApp invalide.");
  const { error } = await createAdminClient().from("player_contacts").upsert({ profile_id: user.id, whatsapp_phone: phone });
  mutationError("Enregistrement du contact impossible", error);
  revalidatePath("/dashboard");
}

export async function publishAnnouncement(tid: string, body: string) {
  const user = await requireAdmin();
  const clean = body.trim();
  if (clean.length < 2 || clean.length > 500) throw new Error("L’annonce doit contenir entre 2 et 500 caractères.");
  const { error } = await createAdminClient().from("announcements").insert({ tournament_id: tid, body: clean, created_by: user.id });
  mutationError("Publication impossible", error);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}
