// Modo local: guarda todo en el navegador (localStorage), con datos de ejemplo.
// Se usa en la vista previa y cuando la app no tiene Supabase configurado.
import { useSyncExternalStore } from 'react'

const KEY = 'cuadre-datos-v1'

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

function datosIniciales() {
  const tienda = { id: uid(), nombre: 'Tienda online', tipo: 'ecommerce' }
  const resto = { id: uid(), nombre: 'Restaurante', tipo: 'restaurante' }
  const p = (negocioId, nombre, categoria, precio, costo, stock, minimo = 5) =>
    ({ id: uid(), negocioId, nombre, categoria, precio, costo, stock, minimo })
  return {
    negocioActivo: resto.id,
    negocios: [tienda, resto],
    productos: [
      p(resto.id, 'Hamburguesa sencilla', 'Comidas', 15000, 6500, 40),
      p(resto.id, 'Hamburguesa doble', 'Comidas', 22000, 10000, 30),
      p(resto.id, 'Perro caliente', 'Comidas', 12000, 4500, 35),
      p(resto.id, 'Papas fritas', 'Acompañantes', 6000, 1800, 60),
      p(resto.id, 'Gaseosa', 'Bebidas', 4000, 2000, 48, 12),
      p(resto.id, 'Jugo natural', 'Bebidas', 6000, 2200, 4),
      p(tienda.id, 'Camiseta básica', 'Ropa', 45000, 20000, 25),
      p(tienda.id, 'Gorra', 'Accesorios', 35000, 14000, 3),
      p(tienda.id, 'Envío nacional', 'Servicios', 12000, 9000, 9999, 0),
    ],
    ventas: [],
    gastos: [],
  }
}

function cargar() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* datos dañados o sin acceso: empezamos de cero */ }
  return datosIniciales()
}

let estado = { ...cargar(), listo: true, modo: 'local', rol: 'dueno' }
const oyentes = new Set()

function guardar(nuevo) {
  estado = nuevo
  try { localStorage.setItem(KEY, JSON.stringify(estado)) } catch { /* sin espacio */ }
  oyentes.forEach((fn) => fn())
}

export function useDatos() {
  return useSyncExternalStore(
    (fn) => { oyentes.add(fn); return () => oyentes.delete(fn) },
    () => estado,
  )
}

// ---------- Negocios ----------
export function cambiarNegocio(id) {
  guardar({ ...estado, negocioActivo: id })
}

// ---------- Productos ----------
export function guardarProducto(prod) {
  const existe = estado.productos.some((p) => p.id === prod.id)
  const productos = existe
    ? estado.productos.map((p) => (p.id === prod.id ? prod : p))
    : [...estado.productos, { ...prod, id: uid(), negocioId: estado.negocioActivo }]
  guardar({ ...estado, productos })
}

export function ponerFotos(fotos) {
  let n = 0
  const productos = estado.productos.map((p) => {
    if (p.negocioId !== estado.negocioActivo || p.imagen || !fotos[p.nombre]) return p
    n++
    return { ...p, imagen: fotos[p.nombre] }
  })
  guardar({ ...estado, productos })
  return n
}

export function borrarProducto(id) {
  guardar({ ...estado, productos: estado.productos.filter((p) => p.id !== id) })
}

export function ajustarStock(id, cantidad) {
  guardar({
    ...estado,
    productos: estado.productos.map((p) => (p.id === id ? { ...p, stock: p.stock + cantidad } : p)),
  })
}

// ---------- Ventas ----------
// items: [{ productoId, nombre, precio, costo, cantidad }]
export function registrarVenta({ items, metodo, cliente, clienteDoc, nota }) {
  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const costo = items.reduce((s, i) => s + i.costo * i.cantidad, 0)
  const ventasNegocio = estado.ventas.filter((v) => v.negocioId === estado.negocioActivo)
  const venta = {
    id: uid(),
    numero: ventasNegocio.length + 1,
    negocioId: estado.negocioActivo,
    fecha: new Date().toISOString(),
    items, total, costo, metodo, cliente: cliente || '', clienteDoc: clienteDoc || '', nota: nota || '',
  }
  const vendidos = Object.fromEntries(items.map((i) => [i.productoId, i.cantidad]))
  guardar({
    ...estado,
    ventas: [venta, ...estado.ventas],
    productos: estado.productos.map((p) =>
      vendidos[p.id] ? { ...p, stock: p.stock - vendidos[p.id] } : p),
  })
  return venta
}

export function anularVenta(id) {
  const venta = estado.ventas.find((v) => v.id === id)
  if (!venta) return
  const devueltos = Object.fromEntries(venta.items.map((i) => [i.productoId, i.cantidad]))
  guardar({
    ...estado,
    ventas: estado.ventas.filter((v) => v.id !== id),
    productos: estado.productos.map((p) =>
      devueltos[p.id] ? { ...p, stock: p.stock + devueltos[p.id] } : p),
  })
}

// ---------- Gastos ----------
export function registrarGasto({ concepto, categoria, monto, metodo }) {
  const gasto = {
    id: uid(), negocioId: estado.negocioActivo, fecha: new Date().toISOString(),
    concepto, categoria, monto, metodo,
  }
  guardar({ ...estado, gastos: [gasto, ...estado.gastos] })
}

export function borrarGasto(id) {
  guardar({ ...estado, gastos: estado.gastos.filter((g) => g.id !== id) })
}


export function crearNegocio({ nombre, tipo }) {
  const negocio = { id: uid(), nombre, tipo }
  guardar({ ...estado, negocios: [...estado.negocios, negocio], negocioActivo: negocio.id })
}

export function guardarNegocio(cambios) {
  guardar({ ...estado, negocios: estado.negocios.map((n) => (n.id === estado.negocioActivo ? { ...n, ...cambios } : n)) })
}
