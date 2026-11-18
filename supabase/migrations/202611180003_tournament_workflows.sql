-- Server-enforced participant and administrator workflows.
create or replace function public.current_tournament() returns uuid language sql stable security definer set search_path=public as $$
  select id from public.tournaments where status in ('REGISTRATION_OPEN','REGISTRATION_CLOSED','DRAW_READY','DRAW_COMPLETED','IN_PROGRESS','PAUSED') order by created_at desc limit 1;
$$;
create or replace function public.join_tournament(tid uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from tournaments where id=tid and status='REGISTRATION_OPEN') then raise exception 'Registration is closed'; end if;
  insert into tournament_members(tournament_id,profile_id,status) values(tid,auth.uid(),'CONFIRMED') on conflict(tournament_id,profile_id) do nothing;
end; $$;
create or replace function public.admin_set_registration(tid uuid, open boolean) returns void language plpgsql security definer set search_path=public as $$
begin
  if not is_tournament_admin(tid) then raise exception 'Administrator only'; end if;
  update tournaments set status = case when open then 'REGISTRATION_OPEN'::tournament_status else 'REGISTRATION_CLOSED'::tournament_status end where id=tid and status in ('DRAFT','REGISTRATION_OPEN','REGISTRATION_CLOSED','DRAW_READY','DRAW_COMPLETED');
  if not found then raise exception 'Invalid tournament state'; end if;
  insert into audit_logs(tournament_id,actor_id,action) values(tid,auth.uid(),case when open then 'OPEN_REGISTRATION' else 'CLOSE_REGISTRATION' end);
end; $$;
create or replace function public.admin_confirm_member(tid uuid, pid uuid, approved boolean) returns void language plpgsql security definer set search_path=public as $$
begin
  if not is_tournament_admin(tid) then raise exception 'Administrator only'; end if;
  update tournament_members set status=case when approved then 'CONFIRMED'::member_status else 'REJECTED'::member_status end, approved_at=case when approved then now() else null end where tournament_id=tid and profile_id=pid;
end; $$;
create or replace function public.admin_start_tournament(tid uuid) returns void language plpgsql security definer set search_path=public as $$
declare min_count int; member_count int; fixture_count int;
begin
  if not is_tournament_admin(tid) then raise exception 'Administrator only'; end if;
  select min_participants into min_count from tournaments where id=tid and status='DRAW_COMPLETED' for update;
  if min_count is null then raise exception 'The group draw must be confirmed first'; end if;
  select count(*) into member_count from tournament_members where tournament_id=tid and status='CONFIRMED';
  select count(*) into fixture_count from matches where tournament_id=tid;
  if member_count < min_count then raise exception 'Minimum participant count has not been met'; end if;
  if fixture_count=0 then raise exception 'Fixtures must be generated first'; end if;
  update tournaments set status='IN_PROGRESS' where id=tid;
  insert into audit_logs(tournament_id,actor_id,action) values(tid,auth.uid(),'START_TOURNAMENT');
end; $$;
revoke all on function public.current_tournament() from public;
revoke all on function public.join_tournament(uuid),public.admin_set_registration(uuid,boolean),public.admin_confirm_member(uuid,uuid,boolean),public.admin_start_tournament(uuid) from public,anon;
grant execute on function public.current_tournament() to anon, authenticated;
grant execute on function public.join_tournament(uuid) to authenticated;
grant execute on function public.admin_set_registration(uuid,boolean) to authenticated;
grant execute on function public.admin_confirm_member(uuid,uuid,boolean) to authenticated;
grant execute on function public.admin_start_tournament(uuid) to authenticated;
