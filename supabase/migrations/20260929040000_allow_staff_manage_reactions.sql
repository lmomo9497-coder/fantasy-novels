drop policy if exists "reactions owner insert" on public.reaction_types;
drop policy if exists "reactions owner update" on public.reaction_types;
drop policy if exists "reactions owner delete" on public.reaction_types;
drop policy if exists "reactions public read" on public.reaction_types;

create policy "reactions staff insert"
  on public.reaction_types
  for insert
  to authenticated
  with check (is_staff_or_owner());

create policy "reactions staff update"
  on public.reaction_types
  for update
  to authenticated
  using (is_staff_or_owner())
  with check (is_staff_or_owner());

create policy "reactions staff delete"
  on public.reaction_types
  for delete
  to authenticated
  using (is_staff_or_owner());

create policy "reactions public read"
  on public.reaction_types
  for select
  to public
  using (enabled = true or is_staff_or_owner());
