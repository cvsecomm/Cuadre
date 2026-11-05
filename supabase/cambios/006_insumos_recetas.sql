-- 006: insumos y recetas. Al vender un producto con receta se descuentan sus insumos.
-- Copia todo esto en Supabase > SQL Editor y dale Run.

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
