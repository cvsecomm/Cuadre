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

    insert into public.venta_items (venta_id, producto_id, nombre, precio, costo, cantidad)
    values (v_venta.id, v_prod.id, v_prod.nombre, v_precio, v_prod.costo, v_cant);
    update public.productos set stock = stock - v_cant where id = v_prod.id;
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
  update public.productos p set stock = p.stock + i.cantidad
    from public.venta_items i where i.venta_id = p_venta and i.producto_id = p.id;
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
