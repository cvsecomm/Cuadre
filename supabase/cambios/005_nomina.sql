-- 005: nómina (empleados y horas trabajadas). Solo el dueño la ve y la maneja.
-- Copia todo esto en Supabase > SQL Editor y dale Run.

create table if not exists public.empleados (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  nombre text not null,
  cargo text not null default '',
  valor_hora numeric(14, 2) not null default 0 check (valor_hora >= 0),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table if not exists public.turnos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  empleado_id uuid not null references public.empleados (id) on delete cascade,
  fecha date not null default current_date,
  entrada time,
  salida time,
  horas numeric(6, 2) not null check (horas > 0 and horas <= 24),
  valor_hora numeric(14, 2) not null default 0, -- se guarda el valor del momento por si después cambia
  nota text not null default '',
  pago_id uuid references public.gastos (id) on delete set null, -- gasto con el que se pagó
  creado_en timestamptz not null default now()
);
create index if not exists empleados_negocio on public.empleados (negocio_id);
create index if not exists turnos_negocio on public.turnos (negocio_id, fecha desc);

alter table public.empleados enable row level security;
alter table public.turnos enable row level security;
drop policy if exists "dueno maneja empleados" on public.empleados;
drop policy if exists "dueno maneja turnos" on public.turnos;
create policy "dueno maneja empleados" on public.empleados for all
  using (public.es_dueno(negocio_id)) with check (public.es_dueno(negocio_id));
create policy "dueno maneja turnos" on public.turnos for all
  using (public.es_dueno(negocio_id)) with check (public.es_dueno(negocio_id));
grant select, insert, update, delete on public.empleados, public.turnos to authenticated;

-- Paga las horas pendientes de un empleado: crea un gasto "Nómina" y marca esos turnos como pagados.
create or replace function public.pagar_nomina(p_empleado uuid, p_turnos uuid[], p_metodo text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_emp public.empleados;
  v_total numeric;
  v_gasto uuid;
begin
  select * into v_emp from public.empleados where id = p_empleado;
  if not found or not public.es_dueno(v_emp.negocio_id) then raise exception 'Solo el dueño puede pagar nómina'; end if;

  select sum(horas * valor_hora) into v_total from public.turnos
    where id = any(p_turnos) and empleado_id = p_empleado and pago_id is null;
  if coalesce(v_total, 0) <= 0 then raise exception 'No hay horas pendientes por pagar'; end if;

  insert into public.gastos (negocio_id, concepto, categoria, monto, metodo)
  values (v_emp.negocio_id, 'Nómina ' || v_emp.nombre, 'Nómina', v_total, p_metodo)
  returning id into v_gasto;

  update public.turnos set pago_id = v_gasto
    where id = any(p_turnos) and empleado_id = p_empleado and pago_id is null;
  return v_gasto;
end;
$$;
revoke execute on function public.pagar_nomina from public, anon;
grant execute on function public.pagar_nomina to authenticated;
