-- Keep novel copyright tied to the immutable original account name, not display_name/username.
alter table public.profiles
  add column if not exists original_account_name text;

update public.profiles p
set original_account_name = coalesce(
  nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
  nullif(btrim(u.raw_user_meta_data->>'name'), ''),
  nullif(btrim(u.email), '')
)
from auth.users u
where u.id = p.id
  and (p.original_account_name is null or btrim(p.original_account_name) = '');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.profiles (id, display_name, username, original_account_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    nullif(btrim(new.raw_user_meta_data->>'username'), ''),
    coalesce(
      nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data->>'name'), ''),
      nullif(btrim(new.email), '')
    )
  );
  return new;
end;
$function$;

create or replace function private.enforce_novel_rights_owner()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  caller_id uuid := auth.uid();
  caller_role text;
  target_owner uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select p.role into caller_role from public.profiles p where p.id = caller_id;

  if caller_role not in ('owner', 'staff') then
    raise exception 'Only owner or staff can manage novels';
  end if;

  if tg_op = 'INSERT' then
    target_owner := coalesce(new.created_by, caller_id);

    if not private.has_recent_novel_rights_verification(caller_id, target_owner) then
      raise exception 'Rights verification is required before adding a novel';
    end if;

    new.created_by := target_owner;

    select p.original_account_name into new.rights_name
    from public.profiles p
    where p.id = target_owner;

    if new.published and not private.has_recent_novel_rights_verification(caller_id, target_owner) then
      raise exception 'Rights verification is required before publishing';
    end if;

    return new;
  end if;

  new.created_by := old.created_by;
  new.rights_name := old.rights_name;

  if new.published and not old.published
     and not private.has_recent_novel_rights_verification(caller_id, old.created_by) then
    raise exception 'Rights verification is required before publishing';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_sync_novel_rights_name on public.profiles;
drop function if exists private.sync_novel_rights_name();

update public.novels n
set rights_name = p.original_account_name
from public.profiles p
where p.id = n.created_by
  and p.original_account_name is not null;
