import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ActionButton } from "@/components/action-button";
import { joinTournament, saveWhatsApp } from "@/app/actions/tournament";

export const instant = false;
type Named = { display_name: string; efootball_username?: string };

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: tournament }, { data: contact }] = await Promise.all([
    supabase.from("profiles").select("display_name,efootball_username,selected_team").eq("id", user.id).single(),
    supabase.from("tournaments").select("id,name,status,min_participants").in("status", ["REGISTRATION_OPEN","REGISTRATION_CLOSED","DRAW_READY","DRAW_COMPLETED","IN_PROGRESS","PAUSED","COMPLETED"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("player_contacts").select("whatsapp_phone").eq("profile_id", user.id).maybeSingle(),
  ]);
  if (!tournament) return <main className="mx-auto p-8"><p className="auth-kicker">Player dashboard</p><h1 className="mt-3 text-4xl font-black">Bienvenue, {profile?.display_name}</h1><p className="mt-5 text-slate-400">Aucun tournoi actif pour le moment.</p></main>;
  const [{ data: members }, { data: announcements }, { data: ownMembership }] = await Promise.all([
    supabase.from("tournament_members").select("profile_id,status,competition_status,profiles(display_name,efootball_username)").eq("tournament_id", tournament.id).eq("status", "CONFIRMED"),
    supabase.from("announcements").select("id,body,created_at").eq("tournament_id", tournament.id).order("created_at", { ascending: false }),
    supabase.from("tournament_members").select("status,competition_status").eq("tournament_id", tournament.id).eq("profile_id", user.id).maybeSingle(),
  ]);
  const started = ["IN_PROGRESS","PAUSED","COMPLETED"].includes(tournament.status);
  let group: { id: string; label: string } | null = null;
  let standings: Array<Record<string, unknown>> = [];
  if (started && ownMembership) {
    const { data: membership } = await supabase.from("group_members").select("groups!inner(id,label,tournament_id)").eq("profile_id", user.id).eq("groups.tournament_id", tournament.id).maybeSingle();
    group = membership?.groups as unknown as { id: string; label: string } | null;
    if (group) standings = (await supabase.from("group_standings").select("profile_id,display_name,mp,w,d,l,gf,ga,gd,points,position").eq("group_id", group.id).order("position")).data ?? [];
  }
  const { data: matches } = started ? await supabase.from("matches").select("id,round,status,home_score,away_score,home_profile:profiles!matches_home_profile_id_fkey(display_name),away_profile:profiles!matches_away_profile_id_fkey(display_name)").eq("tournament_id", tournament.id).order("round") : { data: [] };
  const podium = members?.filter((m) => ["CHAMPION","RUNNER_UP","THIRD"].includes((m as unknown as { competition_status?: string }).competition_status ?? ""));
  return <main className="mx-auto max-w-6xl p-8">
    <p className="auth-kicker">Player dashboard</p><div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-4xl font-black">{tournament.name}</h1><p className="mt-2 text-slate-400">{members?.length ?? 0} inscrits · minimum {tournament.min_participants}</p></div>{ownMembership && <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-300">{ownMembership.competition_status}</span>}</div>
    {!ownMembership && tournament.status === "REGISTRATION_OPEN" && <div className="mt-7"><ActionButton label="Rejoindre le tournoi" action={joinTournament.bind(null, tournament.id)}/></div>}
    {ownMembership && !started && <p className="mt-7 rounded-xl border border-green-400/20 bg-green-400/10 p-4 font-semibold text-green-300">You&apos;re registered! Waiting for the organizer to start the tournament.</p>}
    {!ownMembership && tournament.status !== "REGISTRATION_OPEN" && <p className="mt-7 rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-yellow-200">Les inscriptions sont fermées.</p>}
    {started && group && <section className="mt-9"><h2 className="text-2xl font-black">Groupe {group.label}</h2><div className="mt-4 overflow-x-auto rounded-2xl border border-white/10"><table className="w-full min-w-[620px] text-sm"><thead className="bg-white/5 text-left text-slate-400"><tr>{["#","Joueur","MJ","G","N","P","BP","BC","DB","Pts"].map(h=><th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{standings.map(row=><tr key={String(row.profile_id)} className="border-t border-white/10"><td className="p-3 font-bold text-cyan-300">{String(row.position)}</td><td className="p-3 font-bold">{String(row.display_name)}</td>{["mp","w","d","l","gf","ga","gd","points"].map(k=><td key={k} className="p-3">{String(row[k])}</td>)}</tr>)}</tbody></table></div></section>}
    {started && <section className="mt-9"><h2 className="text-2xl font-black">Matchs et résultats</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{matches?.map(m=>{const home=m.home_profile as unknown as Named|null,away=m.away_profile as unknown as Named|null;return <article key={m.id} className="rounded-2xl border p-4"><p className="text-xs font-bold tracking-wider text-cyan-300">{m.round.replaceAll("_"," ")}</p><div className="mt-3 flex items-center justify-between gap-3"><span>{home?.display_name ?? "À déterminer"}</span><b className="text-lg">{m.status==="COMPLETED"?`${m.home_score} — ${m.away_score}`:"VS"}</b><span className="text-right">{away?.display_name ?? "À déterminer"}</span></div></article>})}</div></section>}
    {tournament.status === "COMPLETED" && <section className="mt-9 rounded-2xl border border-yellow-300/20 bg-yellow-300/5 p-6"><p className="auth-kicker">Final podium</p><h2 className="mt-2 text-2xl font-black text-yellow-300">🏆 Tournoi terminé</h2>{podium?.map(m=><p key={m.profile_id} className="mt-3">{(m as unknown as {competition_status:string}).competition_status} · {(m.profiles as unknown as Named).display_name}</p>)}</section>}
    <section className="mt-9 grid gap-6 md:grid-cols-2"><div><h2 className="text-xl font-bold">Annonces</h2>{announcements?.length?announcements.map(a=><p key={a.id} className="mt-3 rounded-xl border p-4">{a.body}</p>):<p className="mt-3 text-slate-400">Aucune annonce.</p>}</div><div><h2 className="text-xl font-bold">Contact</h2><form action={saveWhatsApp} className="mt-3 flex flex-col gap-2 sm:flex-row"><input name="whatsapp" defaultValue={contact?.whatsapp_phone ?? ""} placeholder="WhatsApp +212…" className="min-h-11 flex-1 rounded-lg border p-2"/><button className="rounded-lg bg-cyan-400 px-4 font-bold text-slate-950">Enregistrer</button></form></div></section>
  </main>;
}
