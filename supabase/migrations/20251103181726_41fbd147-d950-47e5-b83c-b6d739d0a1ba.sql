-- Create inspection_rooms table to preserve room instances and order per inspection
create table if not exists public.inspection_rooms (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  name text not null,
  order_index integer not null default 0,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

-- Enable RLS and add policies (aligning with existing pattern)
alter table public.inspection_rooms enable row level security;

create policy "Users can create inspection rooms"
  on public.inspection_rooms
  for insert
  with check (auth.uid() = created_by);

create policy "Users can view inspection rooms"
  on public.inspection_rooms
  for select
  using (true);

create policy "Users can update inspection rooms"
  on public.inspection_rooms
  for update
  using (true);

create policy "Users can delete inspection rooms"
  on public.inspection_rooms
  for delete
  using (true);

-- Add ordering to subtasks within a room and link to inspection_rooms
alter table public.subtasks
  add column if not exists inspection_room_id uuid references public.inspection_rooms(id) on delete set null,
  add column if not exists order_index integer not null default 0;

-- Helpful index for lookups
create index if not exists idx_inspection_rooms_inspection on public.inspection_rooms(inspection_id, order_index);
create index if not exists idx_subtasks_inspection_room on public.subtasks(inspection_id, inspection_room_id, order_index);
