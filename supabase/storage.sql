insert into storage.buckets (id, name, public)
values ('licencas-pdf', 'licencas-pdf', true)
on conflict (id) do nothing;

drop policy if exists "storage_read_authenticated" on storage.objects;
create policy "storage_read_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'licencas-pdf');

drop policy if exists "storage_insert_authenticated" on storage.objects;
create policy "storage_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'licencas-pdf');

drop policy if exists "storage_update_authenticated" on storage.objects;
create policy "storage_update_authenticated"
on storage.objects
for update
to authenticated
using (bucket_id = 'licencas-pdf')
with check (bucket_id = 'licencas-pdf');

drop policy if exists "storage_delete_authenticated" on storage.objects;
create policy "storage_delete_authenticated"
on storage.objects
for delete
to authenticated
using (bucket_id = 'licencas-pdf');
