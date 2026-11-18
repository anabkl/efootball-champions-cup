import { createClient } from "@supabase/supabase-js";
import { loadEnvFile } from "node:process";
try { loadEnvFile(".env.local"); } catch {}
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!serviceKey)throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");
const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const relations={profiles:"id,username,role,is_super_admin",tournaments:"id,status,min_participants",tournament_members:"tournament_id,profile_id,status,competition_status",groups:"id,tournament_id,label",group_members:"group_id,profile_id",matches:"id,status,next_match_id,loser_next_match_id",announcements:"id,tournament_id",audit_logs:"id,action",player_contacts:"profile_id,whatsapp_phone",group_standings:"tournament_id,group_id,profile_id,position,points"};
let failed=false;
for(const [relation,columns] of Object.entries(relations)){const {error}=await admin.from(relation).select(columns,{head:true,count:"exact"});if(error){failed=true;const reason=[error.code,error.message,error.details,error.hint].filter(Boolean).join(" · ")||"erreur PostgREST sans détail";console.error(`MANQUANT/INCOMPATIBLE : ${relation} (${reason})`);}else console.log(`OK : ${relation}`);}
if(failed)process.exitCode=1;
