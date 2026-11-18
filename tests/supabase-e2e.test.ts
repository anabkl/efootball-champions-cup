import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const run=process.env.RUN_SUPABASE_INTEGRATION==="1";
const url=process.env.SUPABASE_TEST_URL,anon=process.env.SUPABASE_TEST_ANON_KEY,serviceKey=process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const domain=process.env.AUTH_INTERNAL_EMAIL_DOMAIN??"users.efootball-champions-cup.example.com";
const suite=run?describe:describe.skip;
const internalEmail=(username:string)=>`${username}@${domain}`;

suite("real Supabase authentication and tournament access",()=>{
  it("creates amin, persists a session, enforces admin access and joins a tournament",async()=>{
    if(!url||!anon||!serviceKey)throw new Error("Set all SUPABASE_TEST_* variables on a disposable project.");
    const service=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const password=`Test-${Date.now()}-Strong!`,createdUsers:string[]=[];
    let tournamentId:string|undefined;
    const authenticatedClient=async(username:string)=>{const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await client.auth.signInWithPassword({email:internalEmail(username),password});if(error||!data.session)throw error??new Error("No session");return {client,session:data.session};};
    try{
      const adminCreate=await service.auth.admin.createUser({email:internalEmail("anas"),password,email_confirm:true,user_metadata:{display_name:"Anas",username:"anas",efootball_username:"anas"}});if(adminCreate.error||!adminCreate.data.user)throw adminCreate.error??new Error("Admin creation failed");createdUsers.push(adminCreate.data.user.id);
      const adminProfile=await service.from("profiles").update({role:"ADMIN",is_super_admin:true}).eq("id",adminCreate.data.user.id);expect(adminProfile.error).toBeNull();

      const usernames=["amin","player_2","player_3","player_4","player_5","player_6"];
      for(const username of usernames){const signup=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await signup.auth.signUp({email:internalEmail(username),password,options:{data:{display_name:username==="amin"?"Amin":username,username,efootball_username:username}}});if(error||!data.user||!data.session)throw error??new Error(`Signup/session failed for ${username}; disable email confirmation in the test project.`);createdUsers.push(data.user.id);}

      const aminAuth=await authenticatedClient("amin");
      const refreshed=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});const restored=await refreshed.auth.setSession({access_token:aminAuth.session.access_token,refresh_token:aminAuth.session.refresh_token});expect(restored.error).toBeNull();expect((await refreshed.auth.getUser()).data.user?.user_metadata.username).toBe("amin");
      const adminAuth=await authenticatedClient("anas");
      const {data:tournament,error:createError}=await adminAuth.client.from("tournaments").insert({name:"E2E Champions Cup",slug:`e2e-${Date.now()}`,invitation_code:`E2E-${Date.now()}`,created_by:adminCreate.data.user.id,min_participants:6}).select("id").single();if(createError)throw createError;tournamentId=tournament.id;
      expect((await adminAuth.client.rpc("admin_set_registration",{tid:tournamentId,open:true})).error).toBeNull();
      expect((await aminAuth.client.rpc("admin_set_registration",{tid:tournamentId,open:false})).error).not.toBeNull();
      expect((await aminAuth.client.rpc("join_tournament",{tid:tournamentId})).error).toBeNull();
      for(const username of usernames.slice(1)){const player=await authenticatedClient(username);expect((await player.client.rpc("join_tournament",{tid:tournamentId})).error).toBeNull();}
      const membership=await service.from("tournament_members").select("status").eq("tournament_id",tournamentId).eq("profile_id",createdUsers[1]).single();expect(membership.data?.status).toBe("CONFIRMED");
    }finally{
      if(tournamentId)await service.from("tournaments").delete().eq("id",tournamentId);
      for(const id of createdUsers.reverse())await service.auth.admin.deleteUser(id);
    }
  },120_000);
});
