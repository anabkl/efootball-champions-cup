import { createClient } from "@supabase/supabase-js";
import { loadEnvFile } from "node:process";
try { loadEnvFile(".env.local"); } catch {}
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY,username=(process.env.ADMIN_USERNAME??"anas").trim().toLowerCase(),domain=(process.env.AUTH_INTERNAL_EMAIL_DOMAIN??"users.efootball-champions-cup.example.com").trim().toLowerCase();
if(!url||!serviceKey)throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");
const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:list,error:listError}=await admin.auth.admin.listUsers({page:1,perPage:1000});if(listError)throw new Error(`Audit Auth impossible : ${listError.message}`);
const user=list.users.find(candidate=>candidate.user_metadata?.username?.toLowerCase()===username||candidate.email===`${username}@${domain}`);
if(!user){console.error(`ÉCHEC : aucun compte Auth avec le username ${username}.`);process.exitCode=1;}else{const {data:profile,error}=await admin.from("profiles").select("username,role,is_super_admin").eq("id",user.id).maybeSingle();if(error){console.error(`ÉCHEC : compte Auth trouvé, mais profil illisible (${error.message}).`);process.exitCode=1;}else if(!profile){console.error("ÉCHEC : compte Auth trouvé, mais profil absent.");process.exitCode=1;}else if(profile.role!=="ADMIN"||profile.is_super_admin!==true){console.error(`ÉCHEC : profil trouvé avec rôle ${profile.role}, privilège admin incorrect.`);process.exitCode=1;}else console.log(`OK : ${username} existe dans Auth et possède un profil ADMIN valide.`);}
