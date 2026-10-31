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

export const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Tarjeta', 'Nequi / Daviplata']
export const CATEGORIAS_GASTO = ['Insumos', 'Mercancía', 'Arriendo', 'Servicios', 'Nómina', 'Publicidad', 'Envíos', 'Otros']
