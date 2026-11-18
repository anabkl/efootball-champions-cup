import { createClient } from "@supabase/supabase-js";
import { loadEnvFile } from "node:process";
try { loadEnvFile(".env.local"); } catch {}

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
const username=(process.env.ADMIN_USERNAME??"anas").trim().toLowerCase();
const password=process.env.ADMIN_PASSWORD;
const internalDomain=(process.env.AUTH_INTERNAL_EMAIL_DOMAIN??"users.efootball-champions-cup.example.com").trim().toLowerCase();
if(!url||!serviceKey||!password)throw new Error("Configuration manquante : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY et ADMIN_PASSWORD sont requis.");
if(!/^[a-z0-9_]{3,24}$/.test(username))throw new Error("ADMIN_USERNAME doit contenir 3 à 24 lettres minuscules, chiffres ou underscores.");
const host=new URL(url).hostname;
const local=["localhost","127.0.0.1"].includes(host);
const strong=password.length>=12&&/[a-z]/.test(password)&&/[A-Z]/.test(password)&&/\d/.test(password)&&/[^A-Za-z0-9]/.test(password);
if(!strong&&!(local&&process.env.ALLOW_INSECURE_LOCAL_ADMIN_PASSWORD==="1"))throw new Error("Mot de passe admin refusé : utilisez au moins 12 caractères avec minuscule, majuscule, chiffre et symbole. Le mot de passe faible n’est autorisé que sur Supabase local avec ALLOW_INSECURE_LOCAL_ADMIN_PASSWORD=1.");

const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const email=`${username}@${internalDomain}`;
const {error:schemaError}=await admin.from("profiles").select("id,username,role,is_super_admin",{head:true}).limit(1);
if(schemaError)throw new Error("Provisionnement annulé avant toute écriture : la table profiles est absente ou incompatible. Appliquez d’abord toutes les migrations.");
const {data:list,error:listError}=await admin.auth.admin.listUsers({page:1,perPage:1000});
if(listError)throw new Error(`Lecture Supabase Auth impossible : ${listError.message}`);
let user=list.users.find(candidate=>candidate.user_metadata?.username?.toLowerCase()===username||candidate.email===email);
if(!user){const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:"Anas",username,efootball_username:username}});if(error||!data.user)throw new Error(`Création admin impossible : ${error?.message??"réponse vide"}`);user=data.user;}
const {data:updated,error:updateAuthError}=await admin.auth.admin.updateUserById(user.id,{email,password,email_confirm:true,user_metadata:{...user.user_metadata,display_name:user.user_metadata?.display_name??"Anas",username,efootball_username:user.user_metadata?.efootball_username??username}});
if(updateAuthError||!updated.user)throw new Error(`Mise à jour Supabase Auth impossible : ${updateAuthError?.message??"réponse vide"}`);
const {error:profileError}=await admin.from("profiles").upsert({id:user.id,display_name:updated.user.user_metadata.display_name,username,efootball_username:updated.user.user_metadata.efootball_username,role:"ADMIN",is_super_admin:true},{onConflict:"id"});
if(profileError)throw new Error(`Profil ADMIN impossible : ${profileError.message}. Vérifiez que les migrations sont appliquées.`);
const {data:profile,error:verifyError}=await admin.from("profiles").select("username,role,is_super_admin").eq("id",user.id).single();
if(verifyError||profile?.role!=="ADMIN"||profile?.is_super_admin!==true)throw new Error(`Vérification ADMIN échouée : ${verifyError?.message??"rôle incorrect"}`);
console.log(`Succès : le compte ${username} existe dans Supabase Auth et son profil possède le rôle ADMIN.`);
