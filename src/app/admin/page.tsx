import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ActionButton } from "@/components/action-button";
import { confirmMember, createTournament, setRegistration, startTournament } from "@/app/actions/tournament";
import { DrawControls } from "@/components/draw-controls";
import { ResultForm } from "@/components/result-form";
import { AnnouncementForm } from "@/components/announcement-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ConfigurationNotice } from "@/components/configuration-notice";

export const instant = false;
type Player = { display_name: string; efootball_username: string };

export default async function Admin() {
  await connection();
  if (!isSupabaseConfigured()) return <ConfigurationNotice/>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "ADMIN") redirect("/dashboard");
  const { data: tournament } = await supabase.from("tournaments").select("id,name,status,min_participants").in("status", ["DRAFT","REGISTRATION_OPEN","REGISTRATION_CLOSED","DRAW_READY","DRAW_COMPLETED","IN_PROGRESS","PAUSED","COMPLETED"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!tournament) return <main className="mx-auto max-w-xl p-8"><p className="auth-kicker">Organizer</p><h1 className="mt-3 text-4xl font-black">Créer le tournoi</h1><p className="mt-4 text-slate-400">Initialisez votre première compétition. Le minimum est fixé à six joueurs.</p><form action={createTournament} className="mt-7 grid gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-5"><label className="text-sm font-bold text-slate-300">Nom<input name="name" required minLength={3} defaultValue="eFootball Champions Cup" className="mt-2 min-h-11 w-full rounded-lg border p-3"/></label><label className="text-sm font-bold text-slate-300">Code d’invitation<input name="code" required minLength={3} defaultValue="EFC-2026" className="mt-2 min-h-11 w-full rounded-lg border p-3"/></label><button className="min-h-11 rounded-lg bg-cyan-400 px-4 font-bold text-slate-950">Créer le tournoi</button></form></main>;
  const [{ data: members }, { data: matches }, { data: contacts }] = await Promise.all([
    supabase.from("tournament_members").select("profile_id,status,competition_status,profiles(display_name,efootball_username)").eq("tournament_id", tournament.id),
    supabase.from("matches").select("id,round,status,home_score,away_score,home_profile:profiles!matches_home_profile_id_fkey(display_name),away_profile:profiles!matches_away_profile_id_fkey(display_name)").eq("tournament_id", tournament.id).order("round"),
    supabase.from("player_contacts").select("profile_id,whatsapp_phone"),
  ]);
  const phones = new Map(contacts?.map(c => [c.profile_id, c.whatsapp_phone]));
  const confirmed = members?.filter(m => m.status === "CONFIRMED").length ?? 0;
  const startable = tournament.status === "DRAW_COMPLETED" && confirmed >= tournament.min_participants;
  return <main className="mx-auto max-w-6xl p-8">
    <p className="auth-kicker">Organizer control room</p><div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-4xl font-black">{tournament.name}</h1><p className="mt-2 text-slate-400">Statut : {tournament.status} · {confirmed} confirmés · minimum {tournament.min_participants}</p></div><div className="flex flex-wrap gap-2"><ActionButton label={tournament.status === "REGISTRATION_OPEN" ? "Fermer les inscriptions" : "Ouvrir les inscriptions"} action={setRegistration.bind(null, tournament.id, tournament.status !== "REGISTRATION_OPEN")}/><ActionButton label="START TOURNAMENT" disabled={!startable} action={startTournament.bind(null, tournament.id)}/></div></div>
    <section className="mt-9 rounded-2xl border border-white/10 bg-white/[.035] p-5"><h2 className="text-xl font-bold">Tirage et groupes</h2><p className="mt-1 text-sm text-slate-400">Fermez les inscriptions, prévisualisez le format, puis confirmez le tirage.</p><div className="mt-4"><DrawControls tournamentId={tournament.id} count={confirmed} status={tournament.status}/></div></section>
    <section className="mt-9"><h2 className="text-xl font-bold">Participants ({members?.length ?? 0})</h2><div className="mt-4 grid gap-3">{members?.map(m=>{const player=m.profiles as unknown as Player;const phone=phones.get(m.profile_id);return <article className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4" key={m.profile_id}><div><b>{player?.display_name}</b><p className="text-sm text-slate-400">{player?.efootball_username} · {m.status} · {m.competition_status}</p></div><div className="flex flex-wrap gap-2">{phone&&<a className="rounded-lg border border-green-400/20 bg-green-400/10 px-3 py-2 text-sm font-bold text-green-300" href={`https://wa.me/${phone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer">WhatsApp</a>}{m.status === "PENDING"&&<><ActionButton label="Accepter" action={confirmMember.bind(null,tournament.id,m.profile_id,true)}/><ActionButton kind="danger" label="Refuser" action={confirmMember.bind(null,tournament.id,m.profile_id,false)}/></>}</div></article>})}</div></section>
    <section className="mt-9"><h2 className="text-xl font-bold">Annonce</h2><AnnouncementForm tournamentId={tournament.id}/></section>
    <section className="mt-9"><h2 className="text-xl font-bold">Résultats officiels</h2><div className="mt-4 grid gap-3">{matches?.map(m=>{const home=m.home_profile as unknown as {display_name:string}|null,away=m.away_profile as unknown as {display_name:string}|null;return <article key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4"><div><p className="text-xs font-bold text-cyan-300">{m.round.replaceAll("_"," ")}</p><p className="mt-1">{home?.display_name ?? "À déterminer"} — {away?.display_name ?? "À déterminer"} {m.status === "COMPLETED"&&<b className="ml-2 text-yellow-300">{m.home_score}-{m.away_score}</b>}</p></div>{home&&away&&<ResultForm id={m.id}/>}</article>})}</div></section>
  </main>;
}
