import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig, SupabaseConfigurationError } from "./config";

export async function refreshSupabaseSession(request:NextRequest){
  let config:ReturnType<typeof getSupabasePublicConfig>;
  try{config=getSupabasePublicConfig();}catch(error){if(error instanceof SupabaseConfigurationError)return NextResponse.next({request});throw error;}
  let response=NextResponse.next({request});
  const supabase=createServerClient(config.url,config.anonKey,{cookies:{getAll:()=>request.cookies.getAll(),setAll(items){items.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});items.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
  await supabase.auth.getUser();
  return response;
}
