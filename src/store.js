// Punto único de acceso a los datos. Las pantallas importan de aquí.
// Si la app tiene configurado Supabase (archivo .env), usa la nube con inicio de sesión;
// si no, guarda todo en el navegador.
import * as local from './datos/local'
import * as nube from './datos/nube'

export const MODO_NUBE = nube.configurado
const d = MODO_NUBE ? nube : local

export const useDatos = () => d.useDatos()
export const cambiarNegocio = (...a) => d.cambiarNegocio(...a)
export const guardarProducto = (...a) => d.guardarProducto(...a)
export const ponerFotos = (...a) => d.ponerFotos(...a)
export const borrarProducto = (...a) => d.borrarProducto(...a)
export const ajustarStock = (...a) => d.ajustarStock(...a)
export const crearPedido = (...a) => d.crearPedido(...a)
export const guardarPedido = (...a) => d.guardarPedido(...a)
export const borrarPedido = (...a) => d.borrarPedido(...a)
export const registrarCierre = (...a) => d.registrarCierre(...a)
export const borrarCierre = (...a) => d.borrarCierre(...a)
export const movimientosEntre = (...a) => d.movimientosEntre(...a)
export const guardarEmpleado = (...a) => d.guardarEmpleado(...a)
export const registrarTurno = (...a) => d.registrarTurno(...a)
export const borrarTurno = (...a) => d.borrarTurno(...a)
export const pagarNomina = (...a) => d.pagarNomina(...a)
export const guardarReceta = (...a) => d.guardarReceta(...a)
export const registrarVenta = (...a) => d.registrarVenta(...a)
export const anularVenta = (...a) => d.anularVenta(...a)
export const registrarGasto = (...a) => d.registrarGasto(...a)
export const borrarGasto = (...a) => d.borrarGasto(...a)
export const crearNegocio = (...a) => d.crearNegocio(...a)
export const guardarNegocio = (...a) => d.guardarNegocio(...a)
export const iniciarSesion = (...a) => nube.iniciarSesion(...a)
export const cerrarSesion = () => nube.cerrarSesion()

// ---------- Utilidades ----------
export const pesos = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0)

export const esHoy = (iso) => new Date(iso).toDateString() === new Date().toDateString()

// Suma lo vendido por método de pago. Una venta con pago dividido reparte su total entre sus pagos.
export function sumarPorMetodo(ventas) {
  const porMetodo = {}
  ventas.forEach((v) => {
    const pagos = v.pagos?.length ? v.pagos : [{ metodo: v.metodo, monto: v.total }]
    pagos.forEach((p) => { porMetodo[p.metodo] = (porMetodo[p.metodo] || 0) + p.monto })
  })
  return porMetodo
}
// Texto corto del pago: "Efectivo" o "Nequi $15.000 + Efectivo $35.000".
export const textoPago = (v) => (v.pagos?.length ? v.pagos.map((p) => `${p.metodo} ${pesos(p.monto)}`).join(' + ') : v.metodo)

export const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Tarjeta', 'Nequi / Daviplata']
export const CATEGORIAS_GASTO = ['Insumos', 'Mercancía', 'Arriendo', 'Servicios', 'Nómina', 'Publicidad', 'Envíos', 'Otros']

// Funciones que por ahora solo tiene el negocio El Cobertizo (calendario en Movimientos, consumos internos, nómina).
export const esCobertizo = (negocio) => /cobertizo/i.test(negocio?.nombre || '')

// Productos de un negocio con lo que dice su receta: si un producto tiene receta, lo disponible
// sale de sus insumos (cuántos alcanzan) y el costo es la suma de lo que gasta.
export function conRecetas(datos, negocioId) {
  const productos = datos.productos.filter((p) => p.negocioId === negocioId)
  return productos.map((p) => {
    const receta = (datos.recetas || []).filter((r) => r.productoId === p.id)
      .map((r) => ({ ...r, insumo: productos.find((x) => x.id === r.insumoId) })).filter((r) => r.insumo)
    if (receta.length === 0) return p
    return {
      ...p, receta,
      stock: Math.max(0, Math.floor(Math.min(...receta.map((r) => r.insumo.stock / r.cantidad)))),
      costo: Math.round(receta.reduce((s, r) => s + r.insumo.costo * r.cantidad, 0)),
    }
  })
}
