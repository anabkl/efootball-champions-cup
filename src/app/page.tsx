import Link from "next/link";

const features = [
  ["01", "Inscriptions flexibles", "Invitez vos amis, gardez les inscriptions ouvertes et démarrez quand vous êtes prêt."],
  ["02", "Tirage équilibré", "Des groupes adaptés au nombre réel de participants, sans faux joueurs."],
  ["03", "Compétition en direct", "Matchs, scores, classements et phases finales accessibles depuis tous les écrans."],
];

export default function Home() {
  return <main className="min-h-screen bg-transparent text-white">
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 md:grid-cols-[1.15fr_.85fr] md:py-24">
      <div>
        <p className="mb-5 text-xs font-extrabold tracking-[.28em] text-cyan-300">PRIVATE EFOOTBALL COMPETITION</p>
        <h1 className="text-5xl font-black leading-[.94] md:text-7xl">THE ROAD<br/>TO <span className="text-yellow-400">GLORY</span></h1>
        <p className="mt-7 max-w-xl text-base leading-7 text-slate-300 md:text-lg">Une coupe. Un champion. La plateforme simple pour organiser votre tournoi, du premier inscrit jusqu&apos;au podium.</p>
        <div className="mt-9 flex flex-wrap gap-3"><Link className="rounded-xl bg-cyan-400 px-5 py-3 font-extrabold text-slate-950 shadow-[0_0_30px_rgba(55,216,255,.18)] hover:bg-cyan-300" href="/register">Rejoindre le tournoi</Link><Link className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-bold hover:bg-white/10" href="/tournaments">Voir la compétition</Link></div>
      </div>
      <div className="relative overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-gradient-to-br from-cyan-300/10 via-slate-900/90 to-yellow-400/10 p-8 shadow-2xl md:p-10">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-cyan-400/10 blur-2xl"/>
        <p className="text-7xl md:text-8xl">🏆</p><p className="mt-8 text-xs font-bold tracking-[.2em] text-cyan-300">TOURNAMENT CONTROL</p><h2 className="mt-3 text-3xl font-black">Votre coupe.<br/>Vos règles.</h2><p className="mt-4 leading-7 text-slate-300">L&apos;organisateur garde le contrôle : inscriptions, tirage, calendrier et lancement manuel.</p>
      </div>
    </section>
    <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-20 md:grid-cols-3">{features.map(([number,title,body])=><article key={number} className="rounded-2xl border border-white/10 bg-white/[.035] p-6"><span className="text-sm font-black text-cyan-300">{number}</span><h2 className="mt-5 text-lg font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{body}</p></article>)}</section>
  </main>;
}
