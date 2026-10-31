-- 003: pedidos abiertos (mesas o cuentas que se cobran después).
-- Copia todo esto en Supabase > SQL Editor y dale Run.

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  nombre text not null default '',
  items jsonb not null default '[]', -- [{ "productoId": "...", "cantidad": 2 }]
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists pedidos_negocio on public.pedidos (negocio_id);

alter table public.pedidos enable row level security;
drop policy if exists "equipo maneja pedidos" on public.pedidos;
create policy "equipo maneja pedidos" on public.pedidos for all
  using (public.es_miembro(negocio_id)) with check (public.es_miembro(negocio_id));
grant select, insert, update, delete on public.pedidos to authenticated;
