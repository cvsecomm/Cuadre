-- 004: cierre de caja diario.
-- Copia todo esto en Supabase > SQL Editor y dale Run.

create table if not exists public.cierres (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  fecha timestamptz not null default now(),
  desde timestamptz not null,
  base numeric(14, 2) not null default 0,
  ventas numeric(14, 2) not null default 0,
  gastos numeric(14, 2) not null default 0,
  esperado numeric(14, 2) not null default 0, -- efectivo que debería haber en la caja
  contado numeric(14, 2) not null default 0,  -- efectivo que se contó
  por_metodo jsonb not null default '{}',     -- { "Efectivo": 120000, "Nequi / Daviplata": 50000 }
  num_ventas integer not null default 0,
  nota text not null default '',
  cerrado_por uuid default auth.uid() references auth.users (id)
);
create index if not exists cierres_negocio on public.cierres (negocio_id, fecha desc);

alter table public.cierres enable row level security;
drop policy if exists "ver cierres" on public.cierres;
drop policy if exists "equipo cierra caja" on public.cierres;
drop policy if exists "dueno borra cierre" on public.cierres;
create policy "ver cierres" on public.cierres for select using (public.es_miembro(negocio_id));
create policy "equipo cierra caja" on public.cierres for insert with check (public.es_miembro(negocio_id));
create policy "dueno borra cierre" on public.cierres for delete using (public.es_dueno(negocio_id));
grant select, insert, delete on public.cierres to authenticated;
