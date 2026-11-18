-- Auth uses Supabase password hashing/session handling. Usernames are mapped server-side
-- to an identifier under the IANA-reserved example.com domain. Players never supply an email,
-- and email confirmation/recovery must remain disabled for this private username-only app.
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists role text not null default 'PLAYER' check (role in ('ADMIN','PLAYER'));
create unique index if not exists profiles_username_lower_unique on public.profiles (lower(username));

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles (id, display_name, username, efootball_username, selected_team, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username'), lower(new.raw_user_meta_data->>'username'), new.raw_user_meta_data->>'efootball_username', new.raw_user_meta_data->>'selected_team', 'PLAYER');
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.protect_profile_security_fields() returns trigger language plpgsql set search_path=public as $$
begin
  if current_user not in ('postgres','service_role') and (new.id<>old.id or new.username is distinct from old.username or new.role is distinct from old.role or new.is_super_admin is distinct from old.is_super_admin) then
    raise exception 'Identity and role fields are server-managed';
  end if;
  return new;
end; $$;
drop trigger if exists protect_profile_security_fields on public.profiles;
create trigger protect_profile_security_fields before update on public.profiles for each row execute procedure public.protect_profile_security_fields();

-- Replace insecure policy that permitted updating is_super_admin/role through a profile update.
drop policy if exists "own profile update" on public.profiles;
create policy "own safe profile update" on public.profiles for update using (auth.uid()=id) with check (auth.uid()=id and role='PLAYER' and is_super_admin=false);
-- Do not grant direct writes to role fields. Provision the only admin with the server-only script.
revoke all on function public.is_tournament_admin(uuid) from public;
grant execute on function public.is_tournament_admin(uuid) to authenticated;
