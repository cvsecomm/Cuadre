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
  negocioActivo: null, negocios: [], productos: [], ventas: [], gastos: [], pedidos: [], cierres: [], empleados: [], turnos: [],
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
  fijar({ usuario: null, negocios: [], productos: [], ventas: [], gastos: [], pedidos: [], cierres: [], empleados: [], turnos: [], negocioActivo: null })
}

// ---------- Lectura ----------
const num = (v) => Number(v ?? 0)

const aVenta = (v) => ({
  id: v.id, negocioId: v.negocio_id, numero: v.numero, fecha: v.fecha, metodo: v.metodo,
  cliente: v.cliente, clienteDoc: v.cliente_doc || '', nota: v.nota, total: num(v.total), costo: num(v.costo),
  items: v.venta_items.map((i) => ({
    productoId: i.producto_id, nombre: i.nombre, precio: num(i.precio), costo: num(i.costo), cantidad: num(i.cantidad),
  })),
})
const aGasto = (g) => ({
  id: g.id, negocioId: g.negocio_id, fecha: g.fecha, concepto: g.concepto,
  categoria: g.categoria, monto: num(g.monto), metodo: g.metodo,
})

// Ventas y gastos de un rango de fechas cualquiera (para consultar días más antiguos que los que se cargan al inicio).
export async function movimientosEntre(desde, hasta) {
  const [vent, gast] = await Promise.all([
    supabase.from('ventas').select('*, venta_items(*)').eq('negocio_id', estado.negocioActivo).eq('anulada', false)
      .gte('fecha', desde.toISOString()).lt('fecha', hasta.toISOString()).order('fecha', { ascending: false }),
    supabase.from('gastos').select('*').eq('negocio_id', estado.negocioActivo)
      .gte('fecha', desde.toISOString()).lt('fecha', hasta.toISOString()).order('fecha', { ascending: false }),
  ])
  if (vent.error || gast.error) throw new Error((vent.error || gast.error).message)
  return { ventas: vent.data.map(aVenta), gastos: gast.data.map(aGasto) }
}

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
      ventas: vent.data.map(aVenta),
      gastos: gast.data.map(aGasto),
    })
    await Promise.all([cargarPedidos(), cargarCierres(), cargarNomina()])
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
  fijar({ negocioActivo: id, productos: [], ventas: [], gastos: [], pedidos: [], cierres: [], empleados: [], turnos: [] })
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

// Pone fotos a varios productos a la vez (fotos = { nombre: dataURL }). Solo a los que no tienen foto.
export async function ponerFotos(fotos) {
  const pendientes = estado.productos.filter((p) => p.negocioId === estado.negocioActivo && !p.imagen && fotos[p.nombre])
  for (let i = 0; i < pendientes.length; i += 10) {
    const lote = pendientes.slice(i, i + 10)
    const respuestas = await Promise.all(lote.map((p) =>
      supabase.from('productos').update({ imagen: fotos[p.nombre] }).eq('id', p.id)))
    const fallo = respuestas.find((r) => r.error)
    if (fallo) { fijar({ error: fallo.error.message }); await recargar(); throw new Error(fallo.error.message) }
  }
  await recargar()
  return pendientes.length
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

// ---------- Pedidos abiertos ----------
// Se ven en todos los equipos del negocio. Los cambios se muestran al instante y se guardan por detrás;
// cada 10 segundos se traen los pedidos que hicieron otras personas.
let escribiendo = 0

async function cargarPedidos() {
  if (!estado.negocioActivo || escribiendo) return
  const negocio = estado.negocioActivo
  const { data, error } = await supabase.from('pedidos').select('*').eq('negocio_id', negocio).order('creado_en')
  if (error || escribiendo || negocio !== estado.negocioActivo) return // si la tabla no existe todavía, no se muestran
  fijar({ pedidos: data.map((p) => ({ id: p.id, negocioId: p.negocio_id, nombre: p.nombre, items: p.items || [] })) })
}

if (supabase) {
  setInterval(() => { if (estado.usuario && !document.hidden) cargarPedidos() }, 10000)
}

async function escribirPedido(fn) {
  escribiendo++
  const { error } = await fn()
  escribiendo--
  if (error) {
    fijar({ error: 'No se pudo guardar el pedido: ' + error.message })
    await cargarPedidos()
    throw new Error(error.message)
  }
}

export function crearPedido(nombre, items = []) {
  const pedido = { id: crypto.randomUUID(), negocioId: estado.negocioActivo, nombre, items }
  fijar({ pedidos: [...estado.pedidos, pedido] })
  escribirPedido(() => supabase.from('pedidos').insert({ id: pedido.id, negocio_id: pedido.negocioId, nombre, items })).catch(() => {})
  return pedido.id
}

export function guardarPedido(id, cambios) {
  fijar({ pedidos: estado.pedidos.map((p) => (p.id === id ? { ...p, ...cambios } : p)) })
  return escribirPedido(() => supabase.from('pedidos')
    .update({ ...cambios, actualizado_en: new Date().toISOString() }).eq('id', id)).catch(() => {})
}

export function borrarPedido(id) {
  fijar({ pedidos: estado.pedidos.filter((p) => p.id !== id) })
  return escribirPedido(() => supabase.from('pedidos').delete().eq('id', id)).catch(() => {})
}

// ---------- Cierres de caja ----------
async function cargarCierres() {
  const negocio = estado.negocioActivo
  if (!negocio) return
  const { data, error } = await supabase.from('cierres').select('*').eq('negocio_id', negocio)
    .order('fecha', { ascending: false }).limit(60)
  if (error || negocio !== estado.negocioActivo) return // si la tabla no existe todavía, no se muestran
  fijar({
    cierres: data.map((c) => ({
      id: c.id, negocioId: c.negocio_id, fecha: c.fecha, desde: c.desde, base: num(c.base), ventas: num(c.ventas),
      gastos: num(c.gastos), esperado: num(c.esperado), contado: num(c.contado), porMetodo: c.por_metodo || {},
      numVentas: c.num_ventas, nota: c.nota,
    })),
  })
}

export function registrarCierre(c) {
  return cambio(() => supabase.from('cierres').insert({
    negocio_id: estado.negocioActivo, desde: c.desde, base: c.base, ventas: c.ventas, gastos: c.gastos,
    esperado: c.esperado, contado: c.contado, por_metodo: c.porMetodo, num_ventas: c.numVentas, nota: c.nota,
  }))
}

export function borrarCierre(id) {
  return cambio(() => supabase.from('cierres').delete().eq('id', id))
}

// ---------- Nómina ----------
async function cargarNomina() {
  const negocio = estado.negocioActivo
  if (!negocio) return
  const desde = new Date(); desde.setDate(desde.getDate() - 70)
  const [emp, tur] = await Promise.all([
    supabase.from('empleados').select('*').eq('negocio_id', negocio).order('nombre'),
    supabase.from('turnos').select('*').eq('negocio_id', negocio).gte('fecha', desde.toLocaleDateString('en-CA'))
      .order('fecha', { ascending: false }),
  ])
  if (emp.error || tur.error || negocio !== estado.negocioActivo) return // tabla sin crear o sin permiso: no se muestra
  fijar({
    empleados: emp.data.map((e) => ({
      id: e.id, negocioId: e.negocio_id, nombre: e.nombre, cargo: e.cargo, valorHora: num(e.valor_hora), activo: e.activo,
    })),
    turnos: tur.data.map((t) => ({
      id: t.id, negocioId: t.negocio_id, empleadoId: t.empleado_id, fecha: t.fecha, entrada: t.entrada?.slice(0, 5) || '',
      salida: t.salida?.slice(0, 5) || '', horas: num(t.horas), valorHora: num(t.valor_hora), nota: t.nota, pagado: Boolean(t.pago_id),
    })),
  })
}

export function guardarEmpleado(e) {
  const fila = { nombre: e.nombre, cargo: e.cargo, valor_hora: e.valorHora, activo: e.activo }
  return cambio(() => e.id
    ? supabase.from('empleados').update(fila).eq('id', e.id)
    : supabase.from('empleados').insert({ ...fila, negocio_id: estado.negocioActivo }))
}

export function registrarTurno(t) {
  return cambio(() => supabase.from('turnos').insert({
    negocio_id: estado.negocioActivo, empleado_id: t.empleadoId, fecha: t.fecha, entrada: t.entrada || null,
    salida: t.salida || null, horas: t.horas, valor_hora: t.valorHora, nota: t.nota,
  }))
}

export function borrarTurno(id) {
  return cambio(() => supabase.from('turnos').delete().eq('id', id))
}

export function pagarNomina(empleadoId, turnoIds, metodo) {
  return cambio(() => supabase.rpc('pagar_nomina', { p_empleado: empleadoId, p_turnos: turnoIds, p_metodo: metodo }))
}

// ---------- Gastos ----------
export function registrarGasto({ concepto, categoria, monto, metodo }) {
  return cambio(() => supabase.from('gastos').insert({ negocio_id: estado.negocioActivo, concepto, categoria, monto, metodo }))
}

export function borrarGasto(id) {
  return cambio(() => supabase.from('gastos').delete().eq('id', id))
}
