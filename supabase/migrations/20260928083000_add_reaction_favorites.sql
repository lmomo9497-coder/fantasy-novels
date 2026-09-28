create table if not exists public.reaction_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction_type_id uuid not null references public.reaction_types(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, reaction_type_id)
);

alter table public.reaction_favorites enable row level security;

drop policy if exists "reaction favorites own select" on public.reaction_favorites;
create policy "reaction favorites own select"
  on public.reaction_favorites
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "reaction favorites own insert" on public.reaction_favorites;
create policy "reaction favorites own insert"
  on public.reaction_favorites
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "reaction favorites own delete" on public.reaction_favorites;
create policy "reaction favorites own delete"
  on public.reaction_favorites
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on public.reaction_favorites to authenticated;
