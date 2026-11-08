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
