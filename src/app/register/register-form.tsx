"use client";
import { useActionState, useState } from "react";
import { signUp } from "@/app/actions/auth";

const inputClass="mt-2 min-h-12 w-full rounded-xl border p-3";
export function RegisterForm(){
  const [state,action,pending]=useActionState(signUp,{});
  const [showPassword,setShowPassword]=useState(false);
  return <form action={action} className="mt-7 grid gap-5">
    <label className="text-sm font-semibold text-slate-300">Nom<input name="displayName" required minLength={2} maxLength={60} autoComplete="name" className={inputClass}/></label>
    <label className="text-sm font-semibold text-slate-300">Username<input name="username" required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]+" autoComplete="username" aria-describedby="username-rules" className={inputClass}/><span id="username-rules" className="mt-2 block text-xs font-normal text-slate-400">3 à 24 caractères : lettres, chiffres et underscore.</span></label>
    <label className="text-sm font-semibold text-slate-300">Username eFootball<input name="efootballUsername" required minLength={2} maxLength={60} className={inputClass}/></label>
    <label className="text-sm font-semibold text-slate-300">Équipe <span className="font-normal text-slate-500">(facultatif)</span><input name="selectedTeam" maxLength={60} className={inputClass}/></label>
    <fieldset className="grid gap-4 rounded-xl border border-white/10 p-4"><legend className="px-2 text-sm font-bold text-slate-300">Mot de passe</legend><p id="password-rules" className="text-xs font-normal leading-5 text-slate-400">Au moins 8 caractères. Utilisez une phrase difficile à deviner et différente de vos autres mots de passe.</p><label className="text-sm font-semibold text-slate-300">Mot de passe<input name="password" type={showPassword?"text":"password"} required minLength={8} maxLength={128} autoComplete="new-password" aria-describedby="password-rules" className={inputClass}/></label><label className="text-sm font-semibold text-slate-300">Confirmation<input name="passwordConfirm" type={showPassword?"text":"password"} required minLength={8} maxLength={128} autoComplete="new-password" className={inputClass}/></label><button type="button" aria-pressed={showPassword} onClick={()=>setShowPassword(value=>!value)} className="justify-self-start rounded-lg border border-white/15 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/5">{showPassword?"Masquer le mot de passe":"Afficher le mot de passe"}</button></fieldset>
    {state.error&&<p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{state.error}</p>}
    <button disabled={pending} className="min-h-12 rounded-xl bg-cyan-400 px-4 py-3 font-extrabold text-slate-950 hover:bg-cyan-300 disabled:opacity-50">{pending?"Création…":"Créer mon compte"}</button>
  </form>;
}
