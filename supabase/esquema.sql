-- =============================================================================
-- Cuadre: base de datos en Supabase
--
-- Cómo usarlo: en Supabase abre "SQL Editor", pega todo este archivo y dale "Run".
--
-- Tablas: negocios, miembros (quién entra a cada negocio y con qué rol),
--         productos, ventas, venta_items, gastos.
-- Roles:  'dueno'  -> ve y edita todo, invita al equipo.
--         'cajero' -> vende, ve productos y registra gastos; no borra ni ve reportes.
-- Seguridad: cada usuario solo ve los datos de los negocios donde es miembro (RLS).
-- =============================================================================

create type public.rol_miembro as enum ('dueno', 'cajero');

create table public.negocios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null default 'general',
  nit text not null default '',
  direccion text not null default '',
  telefono text not null default '',
  creado_en timestamptz not null default now()
);

create table public.miembros (
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  rol public.rol_miembro not null default 'cajero',
  nombre text not null default '',
  primary key (negocio_id, usuario_id)
);

create table public.productos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  nombre text not null,
  categoria text not null default 'General',
  precio numeric(14, 2) not null default 0 check (precio >= 0),
  costo numeric(14, 2) not null default 0 check (costo >= 0),
  stock numeric(14, 2) not null default 0,
  minimo numeric(14, 2) not null default 0,
  imagen text,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table public.ventas (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  numero integer not null,
  fecha timestamptz not null default now(),
  total numeric(14, 2) not null,
  costo numeric(14, 2) not null,
  metodo text not null,
  cliente text not null default '',
  cliente_doc text not null default '',
  nota text not null default '',
  anulada boolean not null default false,
  vendedor_id uuid default auth.uid() references auth.users (id),
  unique (negocio_id, numero)
);

create table public.venta_items (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references public.ventas (id) on delete cascade,
  producto_id uuid references public.productos (id) on delete set null,
  nombre text not null,
  precio numeric(14, 2) not null,
  costo numeric(14, 2) not null,
  cantidad numeric(14, 2) not null check (cantidad > 0)
);

create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  fecha timestamptz not null default now(),
  concepto text not null,
  categoria text not null,
  monto numeric(14, 2) not null check (monto > 0),
  metodo text not null,
  registrado_por uuid default auth.uid() references auth.users (id)
);

create index on public.productos (negocio_id);
create index on public.ventas (negocio_id, fecha desc);
create index on public.venta_items (venta_id);
create index on public.gastos (negocio_id, fecha desc);

-- ---------------------------------------------------------------------------
-- Funciones de permisos
-- ---------------------------------------------------------------------------
create or replace function public.es_miembro(n uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.miembros where negocio_id = n and usuario_id = auth.uid());
$$;

create or replace function public.es_dueno(n uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.miembros where negocio_id = n and usuario_id = auth.uid() and rol = 'dueno');
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.negocios enable row level security;
alter table public.miembros enable row level security;
alter table public.productos enable row level security;
alter table public.ventas enable row level security;
alter table public.venta_items enable row level security;
alter table public.gastos enable row level security;

create policy "ver negocios propios" on public.negocios for select using (public.es_miembro(id));
create policy "dueno edita negocio" on public.negocios for update using (public.es_dueno(id));

create policy "ver equipo" on public.miembros for select using (public.es_miembro(negocio_id));
create policy "dueno gestiona equipo" on public.miembros for all
  using (public.es_dueno(negocio_id)) with check (public.es_dueno(negocio_id));

create policy "ver productos" on public.productos for select using (public.es_miembro(negocio_id));
create policy "dueno gestiona productos" on public.productos for all
  using (public.es_dueno(negocio_id)) with check (public.es_dueno(negocio_id));

create policy "ver ventas" on public.ventas for select using (public.es_miembro(negocio_id));
create policy "ver items" on public.venta_items for select
  using (exists (select 1 from public.ventas v where v.id = venta_id and public.es_miembro(v.negocio_id)));

create policy "ver gastos" on public.gastos for select using (public.es_miembro(negocio_id));
create policy "miembro registra gasto" on public.gastos for insert with check (public.es_miembro(negocio_id));
create policy "dueno borra gasto" on public.gastos for delete using (public.es_dueno(negocio_id));

-- ---------------------------------------------------------------------------
-- Operaciones que deben hacerse completas o no hacerse
-- ---------------------------------------------------------------------------

-- Crea un negocio y deja a quien lo crea como dueño.
create or replace function public.crear_negocio(p_nombre text, p_tipo text default 'general')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  insert into public.negocios (nombre, tipo) values (p_nombre, p_tipo) returning id into v_id;
  insert into public.miembros (negocio_id, usuario_id, rol, nombre)
  values (v_id, auth.uid(), 'dueno', coalesce((select email from auth.users where id = auth.uid()), ''));
  return v_id;
end;
$$;

-- Registra una venta y descuenta el stock. p_items: [{producto_id, cantidad}]
-- Precio y costo se toman de la base de datos, no de lo que envía el navegador.
create or replace function public.registrar_venta(
  p_negocio uuid, p_items jsonb, p_metodo text, p_cliente text default '', p_nota text default '',
  p_cliente_doc text default ''
) returns public.ventas language plpgsql security definer set search_path = '' as $$
declare
  v_venta public.ventas;
  v_item jsonb;
  v_prod public.productos;
  v_cant numeric;
  v_precio numeric;
  v_costo numeric;
  v_numero integer;
begin
  if not public.es_miembro(p_negocio) then raise exception 'No tienes acceso a este negocio'; end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'La venta no tiene productos'; end if;

  perform pg_advisory_xact_lock(hashtext(p_negocio::text));
  select coalesce(max(numero), 0) + 1 into v_numero from public.ventas where negocio_id = p_negocio;

  insert into public.ventas (negocio_id, numero, total, costo, metodo, cliente, cliente_doc, nota)
  values (p_negocio, v_numero, 0, 0, p_metodo, coalesce(p_cliente, ''), coalesce(p_cliente_doc, ''), coalesce(p_nota, ''))
  returning * into v_venta;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cant := (v_item ->> 'cantidad')::numeric;
    select * into v_prod from public.productos
      where id = (v_item ->> 'producto_id')::uuid and negocio_id = p_negocio for update;
    if not found then raise exception 'Producto no encontrado'; end if;
    if v_cant <= 0 then raise exception 'Cantidad inválida'; end if;
    -- El precio puede venir en la venta (ej. Mercado Libre: lo que llegó); si no, el del producto.
    v_precio := coalesce((v_item ->> 'precio')::numeric, v_prod.precio);
    if v_precio < 0 then raise exception 'Precio inválido'; end if;

    -- Si el producto tiene receta, se descuentan sus insumos y el costo sale de la receta.
    if exists (select 1 from public.recetas r where r.producto_id = v_prod.id) then
      select coalesce(sum(i.costo * r.cantidad), 0) into v_costo
        from public.recetas r join public.productos i on i.id = r.insumo_id where r.producto_id = v_prod.id;
      update public.productos i set stock = i.stock - v_cant * r.cantidad
        from public.recetas r where r.producto_id = v_prod.id and i.id = r.insumo_id;
    else
      v_costo := v_prod.costo;
      update public.productos set stock = stock - v_cant where id = v_prod.id;
    end if;

    insert into public.venta_items (venta_id, producto_id, nombre, precio, costo, cantidad)
    values (v_venta.id, v_prod.id, v_prod.nombre, v_precio, v_costo, v_cant);
  end loop;

  update public.ventas set
    total = (select sum(precio * cantidad) from public.venta_items where venta_id = v_venta.id),
    costo = (select sum(costo * cantidad) from public.venta_items where venta_id = v_venta.id)
  where id = v_venta.id returning * into v_venta;
  return v_venta;
end;
$$;

-- Anula una venta (solo el dueño) y devuelve el stock. La venta queda en el historial.
create or replace function public.anular_venta(p_venta uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_venta public.ventas;
begin
  select * into v_venta from public.ventas where id = p_venta for update;
  if not found or not public.es_dueno(v_venta.negocio_id) then raise exception 'Solo el dueño puede anular ventas'; end if;
  if v_venta.anulada then return; end if;
  -- Productos sin receta: vuelve su propio stock.
  update public.productos p set stock = p.stock + x.cant
    from (select producto_id, sum(cantidad) as cant from public.venta_items where venta_id = p_venta group by producto_id) x
    where p.id = x.producto_id and not exists (select 1 from public.recetas r where r.producto_id = p.id);
  -- Productos con receta: vuelven sus insumos.
  update public.productos p set stock = p.stock + x.cant
    from (select r.insumo_id, sum(i.cantidad * r.cantidad) as cant
          from public.venta_items i join public.recetas r on r.producto_id = i.producto_id
          where i.venta_id = p_venta group by r.insumo_id) x
    where p.id = x.insumo_id;
  update public.ventas set anulada = true where id = p_venta;
end;
$$;

-- Ajuste manual de stock (entrada de mercancía o salida por daño). Solo el dueño.
create or replace function public.ajustar_stock(p_producto uuid, p_cantidad numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare v_negocio uuid;
begin
  select negocio_id into v_negocio from public.productos where id = p_producto;
  if v_negocio is null or not public.es_dueno(v_negocio) then raise exception 'Solo el dueño puede ajustar el stock'; end if;
  update public.productos set stock = stock + p_cantidad where id = p_producto;
end;
$$;

revoke execute on function public.crear_negocio, public.registrar_venta, public.anular_venta, public.ajustar_stock from public, anon;
grant execute on function public.crear_negocio, public.registrar_venta, public.anular_venta, public.ajustar_stock to authenticated;

-- ---------- Pedidos abiertos (cambio 003) ----------
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

-- ---------- Cierres de caja (cambio 004) ----------
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

-- ---------- Nómina (cambio 005) ----------
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

-- ---------- Insumos y recetas (cambio 006) ----------
alter table public.productos
  add column if not exists es_insumo boolean not null default false, -- insumo: no se vende, se gasta en recetas
  add column if not exists unidad text not null default 'und';

-- Receta: cuánto de cada insumo gasta un producto al venderse (ej. Hamburguesa = 1 pan + 1 carne).
create table if not exists public.recetas (
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  producto_id uuid not null references public.productos (id) on delete cascade,
  insumo_id uuid not null references public.productos (id) on delete cascade,
  cantidad numeric(12, 3) not null check (cantidad > 0),
  primary key (producto_id, insumo_id)
);
create index if not exists recetas_negocio on public.recetas (negocio_id);
alter table public.recetas enable row level security;
drop policy if exists "ver recetas" on public.recetas;
drop policy if exists "dueno maneja recetas" on public.recetas;
create policy "ver recetas" on public.recetas for select using (public.es_miembro(negocio_id));
create policy "dueno maneja recetas" on public.recetas for all
  using (public.es_dueno(negocio_id)) with check (public.es_dueno(negocio_id));
grant select, insert, update, delete on public.recetas to authenticated;

-- 007: pago dividido (ej. $15.000 por Nequi + $35.000 en efectivo).
-- La venta queda con metodo 'Mixto' y el detalle en la columna pagos: [{"metodo": "...", "monto": n}, ...]

alter table public.ventas add column if not exists pagos jsonb;

drop function if exists public.registrar_venta(uuid, jsonb, text, text, text, text);

create or replace function public.registrar_venta(
  p_negocio uuid, p_items jsonb, p_metodo text, p_cliente text default '', p_nota text default '',
  p_cliente_doc text default '', p_pagos jsonb default null
) returns public.ventas language plpgsql security definer set search_path = '' as $$
declare
  v_venta public.ventas;
  v_item jsonb;
  v_prod public.productos;
  v_cant numeric;
  v_precio numeric;
  v_costo numeric;
  v_numero integer;
begin
  if not public.es_miembro(p_negocio) then raise exception 'No tienes acceso a este negocio'; end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'La venta no tiene productos'; end if;

  perform pg_advisory_xact_lock(hashtext(p_negocio::text));
  select coalesce(max(numero), 0) + 1 into v_numero from public.ventas where negocio_id = p_negocio;

  insert into public.ventas (negocio_id, numero, total, costo, metodo, cliente, cliente_doc, nota, pagos)
  values (p_negocio, v_numero, 0, 0, p_metodo, coalesce(p_cliente, ''), coalesce(p_cliente_doc, ''), coalesce(p_nota, ''), p_pagos)
  returning * into v_venta;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cant := (v_item ->> 'cantidad')::numeric;
    select * into v_prod from public.productos
      where id = (v_item ->> 'producto_id')::uuid and negocio_id = p_negocio for update;
    if not found then raise exception 'Producto no encontrado'; end if;
    if v_cant <= 0 then raise exception 'Cantidad inválida'; end if;
    -- El precio puede venir en la venta (ej. Mercado Libre: lo que llegó); si no, el del producto.
    v_precio := coalesce((v_item ->> 'precio')::numeric, v_prod.precio);
    if v_precio < 0 then raise exception 'Precio inválido'; end if;

    -- Si el producto tiene receta, se descuentan sus insumos y el costo sale de la receta.
    if exists (select 1 from public.recetas r where r.producto_id = v_prod.id) then
      select coalesce(sum(i.costo * r.cantidad), 0) into v_costo
        from public.recetas r join public.productos i on i.id = r.insumo_id where r.producto_id = v_prod.id;
      update public.productos i set stock = i.stock - v_cant * r.cantidad
        from public.recetas r where r.producto_id = v_prod.id and i.id = r.insumo_id;
    else
      v_costo := v_prod.costo;
      update public.productos set stock = stock - v_cant where id = v_prod.id;
    end if;

    insert into public.venta_items (venta_id, producto_id, nombre, precio, costo, cantidad)
    values (v_venta.id, v_prod.id, v_prod.nombre, v_precio, v_costo, v_cant);
  end loop;

  update public.ventas set
    total = (select sum(precio * cantidad) from public.venta_items where venta_id = v_venta.id),
    costo = (select sum(costo * cantidad) from public.venta_items where venta_id = v_venta.id)
  where id = v_venta.id returning * into v_venta;

  -- Pago dividido: la suma de los pagos debe dar el total de la venta.
  if p_pagos is not null then
    if jsonb_typeof(p_pagos) <> 'array' or jsonb_array_length(p_pagos) = 0 then raise exception 'Pagos inválidos'; end if;
    if exists (select 1 from jsonb_array_elements(p_pagos) x where (x ->> 'monto')::numeric <= 0 or coalesce(x ->> 'metodo', '') = '') then
      raise exception 'Cada pago necesita método y monto';
    end if;
    if (select sum((x ->> 'monto')::numeric) from jsonb_array_elements(p_pagos) x) <> v_venta.total then
      raise exception 'Los pagos no suman el total de la venta';
    end if;
  end if;
  return v_venta;
end;
$$;

revoke execute on function public.registrar_venta from public, anon;
grant execute on function public.registrar_venta to authenticated;
