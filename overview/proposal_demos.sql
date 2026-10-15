-- supabase/proposal_demos.sql
-- Stores generated single-file HTML demo sites + screenshots, linked to a lead.

create table if not exists public.proposal_demos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  html text not null,
  proposal_md text,
  screenshot_desktop_url text,
  screenshot_mobile_url text,
  created_at timestamptz not null default now()
);

create index if not exists proposal_demos_business_idx on public.proposal_demos (business_id);
create index if not exists proposal_demos_user_idx on public.proposal_demos (user_id);

alter table public.proposal_demos enable row level security;

-- API routes use the service-role key and bypass RLS. These policies cover
-- direct client-side reads/writes, matching the rest of your tables.
create policy "own demos - select" on public.proposal_demos
  for select using (auth.uid() = user_id);

create policy "own demos - insert" on public.proposal_demos
  for insert with check (auth.uid() = user_id);

create policy "own demos - delete" on public.proposal_demos
  for delete using (auth.uid() = user_id);

-- Storage bucket for screenshots (run once):
insert into storage.buckets (id, name, public)
values ('proposal-demos', 'proposal-demos', true)
on conflict (id) do nothing;
