create extension if not exists pgcrypto;

create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  company_cnpj text,
  company_contact text,
  license_type text not null,
  due_date date,
  status text not null default 'Ativa' check (status in ('Ativa','Em processo de renovação','Inativa')),
  observations text,
  requested_by text,
  request_date date,
  protocol_date date,
  completion_date date,
  attachment_name text,
  attachment_path text,
  attachment_url text,
  is_inactive boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_licenses_updated_at on public.licenses;
create trigger trg_licenses_updated_at
before update on public.licenses
for each row
execute function public.set_updated_at();

alter table public.licenses enable row level security;

drop policy if exists "licenses_select_authenticated" on public.licenses;
create policy "licenses_select_authenticated"
on public.licenses
for select
to authenticated
using (true);

drop policy if exists "licenses_insert_authenticated" on public.licenses;
create policy "licenses_insert_authenticated"
on public.licenses
for insert
to authenticated
with check (true);

drop policy if exists "licenses_update_authenticated" on public.licenses;
create policy "licenses_update_authenticated"
on public.licenses
for update
to authenticated
using (true)
with check (true);

drop policy if exists "licenses_delete_authenticated" on public.licenses;
create policy "licenses_delete_authenticated"
on public.licenses
for delete
to authenticated
using (true);
