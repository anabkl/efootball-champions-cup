-- Private contact data is deliberately separated from public profiles.
create table if not exists public.player_contacts (profile_id uuid primary key references public.profiles(id) on delete cascade, whatsapp_phone text check (whatsapp_phone ~ '^\+?[1-9][0-9]{7,14}$'), updated_at timestamptz not null default now());
alter table public.player_contacts enable row level security;
create policy "own contact" on public.player_contacts for all using (profile_id=auth.uid()) with check (profile_id=auth.uid());
create policy "admins read contacts" on public.player_contacts for select using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='ADMIN'));
alter table public.announcements enable row level security;
create policy "public announcements" on public.announcements for select using(true);
create policy "admin announcements" on public.announcements for all using (public.is_tournament_admin(tournament_id)) with check (public.is_tournament_admin(tournament_id));

-- Preview uses the same balancing rules as generation; group assignment is never published to players before IN_PROGRESS.
create or replace function public.admin_generate_draw(tid uuid, group_count int) returns void language plpgsql security definer set search_path=public as $$
declare n int; i int:=0; gid uuid; member_id uuid;
begin
 if not is_tournament_admin(tid) then raise exception 'Administrator only'; end if;
 if not exists(select 1 from tournaments where id=tid and status in ('REGISTRATION_CLOSED','DRAW_READY')) then raise exception 'Close registration before generating the draw'; end if;
 if group_count < 2 then raise exception 'At least two groups required'; end if;
 select count(*) into n from tournament_members where tournament_id=tid and status='CONFIRMED';
 if n < (select min_participants from tournaments where id=tid) then raise exception 'Not enough confirmed participants'; end if;
 if n < group_count*3 then raise exception 'Each group needs at least three players'; end if;
 if ceil(n::numeric/group_count)>5 then raise exception 'Groups may contain at most five players'; end if;
 delete from matches where tournament_id=tid and group_id is not null;
 delete from groups where tournament_id=tid;
 for i in 1..group_count loop insert into groups(tournament_id,label) values(tid,chr(64+i)) returning id into gid; end loop;
 i:=0;
 for member_id in select profile_id from tournament_members where tournament_id=tid and status='CONFIRMED' order by random() loop
   select id into gid from groups where tournament_id=tid order by label offset (i % group_count) limit 1;
   insert into group_members(group_id,profile_id) values(gid,member_id); i:=i+1;
 end loop;
 -- One round-robin fixture per unordered pair in each group.
 insert into matches(tournament_id,group_id,round,home_profile_id,away_profile_id,status)
 select tid, gm1.group_id, 'GROUP', gm1.profile_id, gm2.profile_id, 'SCHEDULED'
 from group_members gm1 join group_members gm2 on gm1.group_id=gm2.group_id and gm1.profile_id::text < gm2.profile_id::text
 where gm1.group_id in (select id from groups where tournament_id=tid);
 update tournaments set status='DRAW_READY' where id=tid;
 insert into audit_logs(tournament_id,actor_id,action,metadata) values(tid,auth.uid(),'GENERATE_DRAW',jsonb_build_object('groups',group_count));
end; $$;
create or replace function public.admin_confirm_draw(tid uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if not is_tournament_admin(tid) then raise exception 'Administrator only'; end if;
 if not exists(select 1 from matches where tournament_id=tid and group_id is not null) then raise exception 'Generate fixtures first'; end if;
 update tournaments set status='DRAW_COMPLETED' where id=tid and status='DRAW_READY';
 if not found then raise exception 'Draw is not ready'; end if;
 insert into audit_logs(tournament_id,actor_id,action) values(tid,auth.uid(),'CONFIRM_DRAW');
end; $$;
create or replace function public.admin_record_result(mid uuid, home_goals int, away_goals int, penalties_h int default null, penalties_a int default null) returns void language plpgsql security definer set search_path=public as $$
declare tid uuid; knockout boolean;
begin
 select tournament_id, group_id is null into tid, knockout from matches where id=mid for update;
 if tid is null or not is_tournament_admin(tid) then raise exception 'Administrator only'; end if;
 if home_goals < 0 or away_goals < 0 then raise exception 'Invalid score'; end if;
 if knockout and home_goals=away_goals and coalesce(penalties_h,0)=coalesce(penalties_a,0) then raise exception 'Knockout matches need a winner'; end if;
 update matches set home_score=home_goals,away_score=away_goals,penalties_home=penalties_h,penalties_away=penalties_a,status='COMPLETED',completed_at=now(),winner_profile_id=case when home_goals>away_goals or (home_goals=away_goals and coalesce(penalties_h,0)>coalesce(penalties_a,0)) then home_profile_id when home_goals<away_goals or (home_goals=away_goals and coalesce(penalties_a,0)>coalesce(penalties_h,0)) then away_profile_id else null end where id=mid;
 insert into audit_logs(tournament_id,actor_id,action,metadata) values(tid,auth.uid(),'RECORD_RESULT',jsonb_build_object('match_id',mid,'home',home_goals,'away',away_goals));
end; $$;
revoke all on function public.admin_generate_draw(uuid,int),public.admin_confirm_draw(uuid),public.admin_record_result(uuid,int,int,int,int) from public,anon;
grant execute on function public.admin_generate_draw(uuid,int),public.admin_confirm_draw(uuid),public.admin_record_result(uuid,int,int,int,int) to authenticated;
