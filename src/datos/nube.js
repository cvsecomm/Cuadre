// Modo nube: los datos viven en Supabase y cada persona entra con su usuario.
// Los permisos (dueño / cajero) los hace cumplir la base de datos (ver supabase/esquema.sql).
import { useSyncExternalStore } from 'react'
import { createClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL
const CLAVE = import.meta.env.VITE_SUPABASE_ANON_KEY
export const configurado = Boolean(URL && CLAVE)
const supabase = configurado ? createClient(URL, CLAVE) : null

const NEGOCIO_KEY = 'cuadre-negocio-activo'

let estado = {
  modo: 'nube', listo: false, usuario: null, rol: null, error: '',
  negocioActivo: null, negocios: [], productos: [], ventas: [], gastos: [],
}
const oyentes = new Set()
function fijar(cambios) {
  estado = { ...estado, ...cambios }
  oyentes.forEach((fn) => fn())
}

export function useDatos() {
  return useSyncExternalStore(
    (fn) => { oyentes.add(fn); return () => oyentes.delete(fn) },
    () => estado,
  )
}

// ---------- Sesión ----------
if (supabase) {
  supabase.auth.onAuthStateChange((_evento, sesion) => {
    const usuario = sesion?.user ?? null
    if (usuario?.id === estado.usuario?.id && estado.listo) return
    fijar({ usuario, listo: !usuario })
    if (usuario) setTimeout(recargar, 0)
  })
}

export async function iniciarSesion(email, clave) {
  const { error } = await supabase.auth.signInWithPassword({ email, password: clave })
  if (error) throw new Error('Correo o contraseña incorrectos.')
}

export async function cerrarSesion() {
  await supabase.auth.signOut()
  fijar({ usuario: null, negocios: [], productos: [], ventas: [], gastos: [], negocioActivo: null })
}

// ---------- Lectura ----------
const num = (v) => Number(v ?? 0)

async function recargar() {
  try {
    const { data: miembros, error: e1 } = await supabase
      .from('miembros').select('rol, negocio:negocios(id, nombre, tipo, nit, direccion, telefono)').eq('usuario_id', estado.usuario.id)
    if (e1) throw e1
    const negocios = miembros.map((m) => ({ ...m.negocio, rol: m.rol }))
    let guardado = null
    try { guardado = localStorage.getItem(NEGOCIO_KEY) } catch { /* sin acceso */ }
    const activo = negocios.find((n) => n.id === (estado.negocioActivo || guardado)) ?? negocios[0]
    if (!activo) { fijar({ negocios, negocioActivo: null, listo: true }); return }

    const desde = new Date(); desde.setDate(desde.getDate() - 62)
    const [prod, vent, gast] = await Promise.all([
      supabase.from('productos').select('*').eq('negocio_id', activo.id).eq('activo', true).order('nombre'),
      supabase.from('ventas').select('*, venta_items(*)').eq('negocio_id', activo.id).eq('anulada', false)
        .gte('fecha', desde.toISOString()).order('fecha', { ascending: false }),
      supabase.from('gastos').select('*').eq('negocio_id', activo.id)
        .gte('fecha', desde.toISOString()).order('fecha', { ascending: false }),
    ])
    for (const r of [prod, vent, gast]) if (r.error) throw r.error

    fijar({
      listo: true, error: '', negocios, negocioActivo: activo.id, rol: activo.rol,
      productos: prod.data.map((p) => ({
        id: p.id, negocioId: p.negocio_id, nombre: p.nombre, categoria: p.categoria, imagen: p.imagen || '',
        precio: num(p.precio), costo: num(p.costo), stock: num(p.stock), minimo: num(p.minimo),
      })),
      ventas: vent.data.map((v) => ({
        id: v.id, negocioId: v.negocio_id, numero: v.numero, fecha: v.fecha, metodo: v.metodo,
        cliente: v.cliente, clienteDoc: v.cliente_doc || '', nota: v.nota, total: num(v.total), costo: num(v.costo),
        items: v.venta_items.map((i) => ({
          productoId: i.producto_id, nombre: i.nombre, precio: num(i.precio), costo: num(i.costo), cantidad: num(i.cantidad),
        })),
      })),
      gastos: gast.data.map((g) => ({
        id: g.id, negocioId: g.negocio_id, fecha: g.fecha, concepto: g.concepto,
        categoria: g.categoria, monto: num(g.monto), metodo: g.metodo,
      })),
    })
  } catch (e) {
    fijar({ listo: true, error: 'No pudimos cargar tus datos. Revisa tu conexión a internet. (' + (e.message || e) + ')' })
  }
}

// Ejecuta un cambio en la base de datos y vuelve a cargar. Si falla, muestra el error.
async function cambio(fn) {
  const { data, error } = await fn()
  if (error) {
    const mensaje = /permission|policy|dueño|row-level/i.test(error.message)
      ? 'Tu usuario no tiene permiso para hacer esto. Pídeselo al dueño del negocio.'
      : error.message
    fijar({ error: mensaje })
    throw new Error(mensaje)
  }
  await recargar()
  return data
}

// ---------- Negocios ----------
export function cambiarNegocio(id) {
  try { localStorage.setItem(NEGOCIO_KEY, id) } catch { /* sin acceso */ }
  fijar({ negocioActivo: id, productos: [], ventas: [], gastos: [] })
  recargar()
}

export function guardarNegocio({ nombre, nit, direccion, telefono }) {
  return cambio(() => supabase.from('negocios').update({ nombre, nit, direccion, telefono }).eq('id', estado.negocioActivo))
}

export async function crearNegocio({ nombre, tipo }) {
  const id = await cambio(() => supabase.rpc('crear_negocio', { p_nombre: nombre, p_tipo: tipo }))
  cambiarNegocio(id)
}

// ---------- Productos ----------
export function guardarProducto(p) {
  const fila = {
    nombre: p.nombre, categoria: p.categoria, precio: p.precio, costo: p.costo,
    stock: p.stock, minimo: p.minimo, imagen: p.imagen || null,
  }
  return cambio(() => p.id
    ? supabase.from('productos').update(fila).eq('id', p.id)
    : supabase.from('productos').insert({ ...fila, negocio_id: estado.negocioActivo }))
}

// Se desactiva en vez de borrarse, para no perder el historial de ventas.
export function borrarProducto(id) {
  return cambio(() => supabase.from('productos').update({ activo: false }).eq('id', id))
}

export function ajustarStock(id, cantidad) {
  return cambio(() => supabase.rpc('ajustar_stock', { p_producto: id, p_cantidad: cantidad }))
}

// ---------- Ventas ----------
export async function registrarVenta({ items, metodo, cliente, clienteDoc, nota }) {
  const venta = await cambio(() => supabase.rpc('registrar_venta', {
    p_negocio: estado.negocioActivo,
    p_items: items.map((i) => ({ producto_id: i.productoId, cantidad: i.cantidad, precio: i.precio })),
    p_metodo: metodo, p_cliente: cliente || '', p_nota: nota || '', p_cliente_doc: clienteDoc || '',
  }))
  return { ...venta, clienteDoc: venta.cliente_doc || '', total: num(venta.total), costo: num(venta.costo), items }
}

export function anularVenta(id) {
  return cambio(() => supabase.rpc('anular_venta', { p_venta: id }))
}

// ---------- Gastos ----------
export function registrarGasto({ concepto, categoria, monto, metodo }) {
  return cambio(() => supabase.from('gastos').insert({ negocio_id: estado.negocioActivo, concepto, categoria, monto, metodo }))
}

export function borrarGasto(id) {
  return cambio(() => supabase.from('gastos').delete().eq('id', id))
}
