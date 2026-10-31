-- 002: permite guardar el precio de cada venta (para ventas de Mercado Libre).
-- Copia todo esto en Supabase > SQL Editor y dale Run.

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
