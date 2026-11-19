-- Username/password authentication owned by the application server.
-- This migration is additive: existing profiles and auth.users rows are preserved.

alter table public.profiles drop constraint if exists profiles_id_fkey;
drop trigger if exists on_auth_user_created on auth.users;

create table if not exists public.app_credentials (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  password_hash text not null check (password_hash ~ '^\$argon2id\$'),
  password_changed_at timestamptz not null default now(),
  disabled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.app_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists app_sessions_profile_idx on public.app_sessions(profile_id);
create index if not exists app_sessions_expiry_idx on public.app_sessions(expires_at);

create table if not exists public.app_login_attempts (
  rate_key text primary key check (rate_key ~ '^[0-9a-f]{64}$'),
  failure_count integer not null default 0 check (failure_count >= 0),
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_credentials enable row level security;
alter table public.app_sessions enable row level security;
alter table public.app_login_attempts enable row level security;

revoke all on table public.app_credentials, public.app_sessions, public.app_login_attempts from public, anon, authenticated;
grant select, insert, update, delete on table public.app_credentials, public.app_sessions, public.app_login_attempts to service_role;

create or replace function public.app_create_player_account(
  display_name_input text,
  username_input text,
  efootball_username_input text,
  selected_team_input text,
  password_hash_input text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_id_result uuid := gen_random_uuid();
  normalized_username text := lower(trim(username_input));
begin
  if trim(display_name_input) !~ '^.{2,60}$' then raise exception 'Invalid display name' using errcode='22023'; end if;
  if normalized_username !~ '^[a-z0-9_]{3,24}$' then raise exception 'Invalid username' using errcode='22023'; end if;
  if trim(efootball_username_input) !~ '^.{2,60}$' then raise exception 'Invalid eFootball username' using errcode='22023'; end if;
  if selected_team_input is not null and length(trim(selected_team_input)) > 60 then raise exception 'Invalid team' using errcode='22023'; end if;
  if password_hash_input !~ '^\$argon2id\$' then raise exception 'Invalid password hash' using errcode='22023'; end if;

  insert into public.profiles(id, display_name, username, efootball_username, selected_team, role, is_super_admin)
  values (
    profile_id_result,
    trim(display_name_input),
    normalized_username,
    trim(efootball_username_input),
    nullif(trim(selected_team_input), ''),
    'PLAYER',
    false
  );
  insert into public.app_credentials(profile_id, password_hash) values(profile_id_result, password_hash_input);
  return profile_id_result;
end;
$$;

create or replace function public.app_provision_admin_account(
  display_name_input text,
  username_input text,
  efootball_username_input text,
  password_hash_input text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_id_result uuid;
  normalized_username text := lower(trim(username_input));
begin
  if normalized_username !~ '^[a-z0-9_]{3,24}$' then raise exception 'Invalid username' using errcode='22023'; end if;
  if password_hash_input !~ '^\$argon2id\$' then raise exception 'Invalid password hash' using errcode='22023'; end if;

  select id into profile_id_result from public.profiles where lower(username)=normalized_username for update;
  if profile_id_result is null then
    profile_id_result := gen_random_uuid();
    insert into public.profiles(id, display_name, username, efootball_username, role, is_super_admin)
    values(profile_id_result, trim(display_name_input), normalized_username, trim(efootball_username_input), 'ADMIN', true);
  else
    update public.profiles
      set display_name=trim(display_name_input), username=normalized_username,
          efootball_username=trim(efootball_username_input), role='ADMIN', is_super_admin=true
      where id=profile_id_result;
  end if;

  insert into public.app_credentials(profile_id, password_hash, password_changed_at, disabled_at)
  values(profile_id_result, password_hash_input, now(), null)
  on conflict(profile_id) do update
    set password_hash=excluded.password_hash, password_changed_at=now(), disabled_at=null;
  delete from public.app_sessions where profile_id=profile_id_result;
  return profile_id_result;
end;
$$;

create or replace function public.app_auth_is_rate_limited(rate_keys text[]) returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(array_length(rate_keys, 1), 0) not between 1 and 4 then raise exception 'Invalid rate keys'; end if;
  return exists(
    select 1 from public.app_login_attempts
    where rate_key=any(rate_keys) and blocked_until > now()
  );
end;
$$;

create or replace function public.app_auth_record_failure(rate_keys text[]) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_key text;
  attempt public.app_login_attempts%rowtype;
begin
  if coalesce(array_length(rate_keys, 1), 0) not between 1 and 4 then raise exception 'Invalid rate keys'; end if;
  foreach current_key in array rate_keys loop
    if current_key !~ '^[0-9a-f]{64}$' then raise exception 'Invalid rate key'; end if;
    insert into public.app_login_attempts(rate_key, failure_count)
      values(current_key, 0) on conflict(rate_key) do nothing;
    select * into attempt from public.app_login_attempts where rate_key=current_key for update;
    if attempt.window_started_at < now() - interval '15 minutes' then
      update public.app_login_attempts
        set failure_count=1, window_started_at=now(), blocked_until=null, updated_at=now()
        where rate_key=current_key;
    elsif attempt.failure_count + 1 >= 5 then
      update public.app_login_attempts
        set failure_count=failure_count+1, blocked_until=now()+interval '15 minutes', updated_at=now()
        where rate_key=current_key;
    else
      update public.app_login_attempts
        set failure_count=failure_count+1, updated_at=now()
        where rate_key=current_key;
    end if;
  end loop;
end;
$$;

create or replace function public.app_auth_clear_failures(rate_keys text[]) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(array_length(rate_keys, 1), 0) not between 1 and 4 then raise exception 'Invalid rate keys'; end if;
  delete from public.app_login_attempts where rate_key=any(rate_keys);
end;
$$;

-- The application session is validated by Next.js. These wrappers explicitly set the
-- actor for the duration of one database transaction so legacy tournament functions
-- using auth.uid() keep working. Only service_role may execute the wrappers.
create or replace function public.app_set_actor(actor_id uuid) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists(
    select 1 from public.profiles p join public.app_credentials c on c.profile_id=p.id
    where p.id=actor_id and c.disabled_at is null
  ) then raise exception 'Authentication required'; end if;
  perform set_config('request.jwt.claim.sub', actor_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',actor_id,'role','authenticated')::text, true);
end;
$$;

create or replace function public.app_join_tournament(actor_id uuid, tid uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin perform public.app_set_actor(actor_id); perform public.join_tournament(tid); end; $$;

create or replace function public.app_admin_set_registration(actor_id uuid, tid uuid, open boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin perform public.app_set_actor(actor_id); perform public.admin_set_registration(tid,open); end; $$;

create or replace function public.app_admin_confirm_member(actor_id uuid, tid uuid, pid uuid, approved boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin perform public.app_set_actor(actor_id); perform public.admin_confirm_member(tid,pid,approved); end; $$;

create or replace function public.app_admin_start_tournament(actor_id uuid, tid uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin perform public.app_set_actor(actor_id); perform public.admin_start_tournament(tid); end; $$;

create or replace function public.app_admin_generate_draw(actor_id uuid, tid uuid, group_count integer) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin perform public.app_set_actor(actor_id); perform public.admin_generate_draw(tid,group_count); end; $$;

create or replace function public.app_admin_confirm_draw(actor_id uuid, tid uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin perform public.app_set_actor(actor_id); perform public.admin_confirm_draw(tid); end; $$;

create or replace function public.app_admin_record_result(
  actor_id uuid, mid uuid, home_goals integer, away_goals integer,
  penalties_h integer default null, penalties_a integer default null
) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.app_set_actor(actor_id);
  perform public.admin_record_result(mid,home_goals,away_goals,penalties_h,penalties_a);
end;
$$;

-- Supabase Auth identities can no longer mutate tournament data after this migration.
revoke insert, update, delete, truncate, references, trigger
  on table public.profiles, public.tournaments, public.tournament_members, public.groups,
  public.group_members, public.matches, public.result_submissions, public.announcements,
  public.audit_logs, public.player_contacts
  from anon, authenticated;

revoke execute on function public.join_tournament(uuid),
  public.admin_set_registration(uuid,boolean),
  public.admin_confirm_member(uuid,uuid,boolean),
  public.admin_start_tournament(uuid),
  public.admin_generate_draw(uuid,integer),
  public.admin_confirm_draw(uuid),
  public.admin_record_result(uuid,integer,integer,integer,integer)
  from public, anon, authenticated;

revoke all on function public.app_create_player_account(text,text,text,text,text),
  public.app_provision_admin_account(text,text,text,text),
  public.app_auth_is_rate_limited(text[]),
  public.app_auth_record_failure(text[]),
  public.app_auth_clear_failures(text[]),
  public.app_set_actor(uuid),
  public.app_join_tournament(uuid,uuid),
  public.app_admin_set_registration(uuid,uuid,boolean),
  public.app_admin_confirm_member(uuid,uuid,uuid,boolean),
  public.app_admin_start_tournament(uuid,uuid),
  public.app_admin_generate_draw(uuid,uuid,integer),
  public.app_admin_confirm_draw(uuid,uuid),
  public.app_admin_record_result(uuid,uuid,integer,integer,integer,integer)
  from public, anon, authenticated;

grant execute on function public.app_create_player_account(text,text,text,text,text),
  public.app_provision_admin_account(text,text,text,text),
  public.app_auth_is_rate_limited(text[]),
  public.app_auth_record_failure(text[]),
  public.app_auth_clear_failures(text[]),
  public.app_join_tournament(uuid,uuid),
  public.app_admin_set_registration(uuid,uuid,boolean),
  public.app_admin_confirm_member(uuid,uuid,uuid,boolean),
  public.app_admin_start_tournament(uuid,uuid),
  public.app_admin_generate_draw(uuid,uuid,integer),
  public.app_admin_confirm_draw(uuid,uuid),
  public.app_admin_record_result(uuid,uuid,integer,integer,integer,integer)
  to service_role;
