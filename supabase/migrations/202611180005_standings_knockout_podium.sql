alter table public.tournament_members add column if not exists competition_status text not null default 'ACTIVE' check (competition_status in ('ACTIVE','QUALIFIED','ELIMINATED','CHAMPION','RUNNER_UP','THIRD'));
alter table public.matches add column if not exists next_match_id uuid references public.matches(id) on delete set null;
alter table public.matches add column if not exists next_slot text check (next_slot in ('HOME','AWAY'));
alter table public.matches add column if not exists loser_next_match_id uuid references public.matches(id) on delete set null;
alter table public.matches add column if not exists loser_next_slot text check (loser_next_slot in ('HOME','AWAY'));

drop policy if exists "public groups" on public.groups;
drop policy if exists "public group members" on public.group_members;
drop policy if exists "public match reads" on public.matches;
create policy "groups visible after start" on public.groups for select using (exists(select 1 from tournaments t where t.id=tournament_id and t.status in ('IN_PROGRESS','PAUSED','COMPLETED')) or is_tournament_admin(tournament_id));
create policy "group members visible after start" on public.group_members for select using (exists(select 1 from groups g join tournaments t on t.id=g.tournament_id where g.id=group_id and (t.status in ('IN_PROGRESS','PAUSED','COMPLETED') or is_tournament_admin(t.id))));
create policy "matches visible after start" on public.matches for select using (exists(select 1 from tournaments t where t.id=tournament_id and t.status in ('IN_PROGRESS','PAUSED','COMPLETED')) or is_tournament_admin(tournament_id));
create policy "members visible to authenticated players" on public.tournament_members for select to authenticated using (profile_id=auth.uid() or is_tournament_admin(tournament_id) or exists(select 1 from tournaments t where t.id=tournament_id and t.status<>'DRAFT'));

create or replace view public.group_standings with (security_invoker=true) as
with players as (
  select g.tournament_id,g.id group_id,g.label,gm.profile_id,p.display_name,p.efootball_username
  from groups g join group_members gm on gm.group_id=g.id join profiles p on p.id=gm.profile_id
), played as (
  select m.group_id,m.home_profile_id profile_id,1 mp,(m.home_score>m.away_score)::int w,(m.home_score=m.away_score)::int d,(m.home_score<m.away_score)::int l,m.home_score gf,m.away_score ga
  from matches m where m.group_id is not null and m.status='COMPLETED'
  union all
  select m.group_id,m.away_profile_id,1,(m.away_score>m.home_score)::int,(m.away_score=m.home_score)::int,(m.away_score<m.home_score)::int,m.away_score,m.home_score
  from matches m where m.group_id is not null and m.status='COMPLETED'
), totals as (
  select p.*,coalesce(sum(x.mp),0)::int mp,coalesce(sum(x.w),0)::int w,coalesce(sum(x.d),0)::int d,coalesce(sum(x.l),0)::int l,coalesce(sum(x.gf),0)::int gf,coalesce(sum(x.ga),0)::int ga
  from players p left join played x on x.group_id=p.group_id and x.profile_id=p.profile_id group by p.tournament_id,p.group_id,p.label,p.profile_id,p.display_name,p.efootball_username
)
select *,gf-ga gd,w*3+d points,row_number() over(partition by group_id order by w*3+d desc,gf-ga desc,gf desc,display_name)::int position from totals;
grant select on public.group_standings to anon,authenticated;

create or replace function public.generate_knockout_if_ready(tid uuid) returns void language plpgsql security definer set search_path=public as $$
declare remaining int; qualifier_count int; final_id uuid; third_id uuid; semi1 uuid; semi2 uuid; q1 uuid; q2 uuid; q3 uuid; q4 uuid; seeds uuid[];
begin
  select count(*) into remaining from matches where tournament_id=tid and group_id is not null and status<>'COMPLETED';
  if remaining>0 then return; end if;
  if exists(select 1 from matches where tournament_id=tid and group_id is null and status='COMPLETED') then raise exception 'Group results cannot change after knockout play has started'; end if;
  delete from matches where tournament_id=tid and group_id is null;
  select array_agg(profile_id order by position,points desc,gd desc,gf desc,label) into seeds from group_standings where tournament_id=tid and position<=2;
  qualifier_count:=coalesce(array_length(seeds,1),0);
  if qualifier_count not in (4,6,8) then raise exception 'The format must qualify 4, 6 or 8 players'; end if;
  update tournament_members tm set competition_status=case when tm.profile_id=any(seeds) then 'QUALIFIED' else 'ELIMINATED' end where tm.tournament_id=tid;
  insert into matches(tournament_id,round,status) values(tid,'FINAL','SCHEDULED') returning id into final_id;
  insert into matches(tournament_id,round,status) values(tid,'THIRD_PLACE','SCHEDULED') returning id into third_id;
  insert into matches(tournament_id,round,status,next_match_id,next_slot,loser_next_match_id,loser_next_slot) values(tid,'SEMI_FINAL','SCHEDULED',final_id,'HOME',third_id,'HOME') returning id into semi1;
  insert into matches(tournament_id,round,status,next_match_id,next_slot,loser_next_match_id,loser_next_slot) values(tid,'SEMI_FINAL','SCHEDULED',final_id,'AWAY',third_id,'AWAY') returning id into semi2;
  if qualifier_count=4 then
    update matches set home_profile_id=seeds[1],away_profile_id=seeds[4] where id=semi1;
    update matches set home_profile_id=seeds[2],away_profile_id=seeds[3] where id=semi2;
  elsif qualifier_count=6 then
    update matches set home_profile_id=seeds[1] where id=semi1; update matches set home_profile_id=seeds[2] where id=semi2;
    insert into matches(tournament_id,round,home_profile_id,away_profile_id,status,next_match_id,next_slot) values(tid,'QUARTER_FINAL',seeds[3],seeds[6],'SCHEDULED',semi2,'AWAY') returning id into q1;
    insert into matches(tournament_id,round,home_profile_id,away_profile_id,status,next_match_id,next_slot) values(tid,'QUARTER_FINAL',seeds[4],seeds[5],'SCHEDULED',semi1,'AWAY') returning id into q2;
  else
    insert into matches(tournament_id,round,home_profile_id,away_profile_id,status,next_match_id,next_slot) values(tid,'QUARTER_FINAL',seeds[1],seeds[8],'SCHEDULED',semi1,'HOME') returning id into q1;
    insert into matches(tournament_id,round,home_profile_id,away_profile_id,status,next_match_id,next_slot) values(tid,'QUARTER_FINAL',seeds[4],seeds[5],'SCHEDULED',semi1,'AWAY') returning id into q2;
    insert into matches(tournament_id,round,home_profile_id,away_profile_id,status,next_match_id,next_slot) values(tid,'QUARTER_FINAL',seeds[2],seeds[7],'SCHEDULED',semi2,'HOME') returning id into q3;
    insert into matches(tournament_id,round,home_profile_id,away_profile_id,status,next_match_id,next_slot) values(tid,'QUARTER_FINAL',seeds[3],seeds[6],'SCHEDULED',semi2,'AWAY') returning id into q4;
  end if;
end; $$;

create or replace function public.progress_knockout(mid uuid) returns void language plpgsql security definer set search_path=public as $$
declare m matches%rowtype; loser uuid;
begin
 select * into m from matches where id=mid;
 if m.group_id is not null then perform generate_knockout_if_ready(m.tournament_id); return; end if;
 loser:=case when m.winner_profile_id=m.home_profile_id then m.away_profile_id else m.home_profile_id end;
 if m.next_match_id is not null then update matches set home_profile_id=case when m.next_slot='HOME' then m.winner_profile_id else home_profile_id end,away_profile_id=case when m.next_slot='AWAY' then m.winner_profile_id else away_profile_id end where id=m.next_match_id; end if;
 if m.loser_next_match_id is not null then update matches set home_profile_id=case when m.loser_next_slot='HOME' then loser else home_profile_id end,away_profile_id=case when m.loser_next_slot='AWAY' then loser else away_profile_id end where id=m.loser_next_match_id; end if;
 if loser is not null then update tournament_members set competition_status='ELIMINATED' where tournament_id=m.tournament_id and profile_id=loser; end if;
 if m.round='FINAL' then update tournament_members set competition_status='CHAMPION' where tournament_id=m.tournament_id and profile_id=m.winner_profile_id; update tournament_members set competition_status='RUNNER_UP' where tournament_id=m.tournament_id and profile_id=loser; update tournaments set status='COMPLETED' where id=m.tournament_id; end if;
 if m.round='THIRD_PLACE' then update tournament_members set competition_status='THIRD' where tournament_id=m.tournament_id and profile_id=m.winner_profile_id; end if;
end; $$;

-- Replace score mutation so edits are idempotent and progression runs from the stored match once.
create or replace function public.admin_record_result(mid uuid,home_goals int,away_goals int,penalties_h int default null,penalties_a int default null) returns void language plpgsql security definer set search_path=public as $$
declare tid uuid; knockout boolean;
begin
 select tournament_id,group_id is null into tid,knockout from matches where id=mid for update;
 if tid is null or not is_tournament_admin(tid) then raise exception 'Administrator only'; end if;
 if home_goals<0 or away_goals<0 then raise exception 'Invalid score'; end if;
 if knockout and home_goals=away_goals and coalesce(penalties_h,0)=coalesce(penalties_a,0) then raise exception 'Knockout matches need a winner'; end if;
 update matches set home_score=home_goals,away_score=away_goals,penalties_home=penalties_h,penalties_away=penalties_a,status='COMPLETED',completed_at=now(),winner_profile_id=case when home_goals>away_goals or(home_goals=away_goals and coalesce(penalties_h,0)>coalesce(penalties_a,0)) then home_profile_id when home_goals<away_goals or(home_goals=away_goals and coalesce(penalties_a,0)>coalesce(penalties_h,0)) then away_profile_id end where id=mid;
 perform progress_knockout(mid);
 insert into audit_logs(tournament_id,actor_id,action,metadata) values(tid,auth.uid(),'RECORD_RESULT',jsonb_build_object('match_id',mid,'home',home_goals,'away',away_goals));
end; $$;
