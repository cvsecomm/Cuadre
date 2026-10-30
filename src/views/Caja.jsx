import { useState } from 'react'
import { pesos, registrarVenta, METODOS_PAGO } from '../store'
import ImagenProducto from './Imagen'

export default function Caja({ datos, negocio }) {
  const productos = datos.productos.filter((p) => p.negocioId === negocio.id)
  const categorias = ['Todas', ...new Set(productos.map((p) => p.categoria))]
  const [categoria, setCategoria] = useState('Todas')
  const [buscar, setBuscar] = useState('')
  const [carrito, setCarrito] = useState({}) // productoId -> cantidad
  const [metodo, setMetodo] = useState(METODOS_PAGO[0])
  const [recibido, setRecibido] = useState('')
  const [cliente, setCliente] = useState('')
  const [recibo, setRecibo] = useState(null)
  const [verCarrito, setVerCarrito] = useState(false)

  const visibles = productos.filter((p) =>
    (categoria === 'Todas' || p.categoria === categoria) &&
    p.nombre.toLowerCase().includes(buscar.toLowerCase()))

  const items = Object.entries(carrito).map(([id, cantidad]) => {
    const p = productos.find((x) => x.id === id)
    return p && { productoId: p.id, nombre: p.nombre, precio: p.precio, costo: p.costo, cantidad }
  }).filter(Boolean)
  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const unidades = items.reduce((s, i) => s + i.cantidad, 0)
  const cambio = Number(recibido) - total

  const sumar = (id, n) => setCarrito((c) => {
    const cantidad = (c[id] || 0) + n
    const nuevo = { ...c }
    if (cantidad <= 0) delete nuevo[id]
    else nuevo[id] = cantidad
    return nuevo
  })

  const cobrar = () => {
    const venta = registrarVenta({ items, metodo, cliente })
    setRecibo({ ...venta, recibido: Number(recibido) || 0 })
    setCarrito({}); setRecibido(''); setCliente(''); setVerCarrito(false)
  }

  return (
    <div className="pos">
      <section className="pos-productos">
        <input className="campo" placeholder="Buscar producto…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        <div className="chips">
          {categorias.map((c) => (
            <button key={c} className={'chip' + (c === categoria ? ' activo' : '')} onClick={() => setCategoria(c)}>{c}</button>
          ))}
        </div>
        <div className="grilla">
          {visibles.map((p) => (
            <button key={p.id} className={'producto' + (carrito[p.id] ? ' en-pedido' : '')} onClick={() => sumar(p.id, 1)} disabled={p.stock <= 0}>
              <ImagenProducto producto={p} />
              <span className="info">
                <span className="nombre">{p.nombre}</span>
                <span className="precio">{pesos(p.precio)}</span>
                <span className={'stock' + (p.stock <= p.minimo ? ' alerta' : '')}>{p.stock <= 0 ? 'Agotado' : `${p.stock} disponibles`}</span>
                <span className="agregar">{carrito[p.id] ? `${carrito[p.id]} en el pedido` : '+ Agregar'}</span>
              </span>
            </button>
          ))}
          {visibles.length === 0 && <p className="vacio">No hay productos. Agrégalos en Inventario.</p>}
        </div>
      </section>

      <button className="ver-carrito" onClick={() => setVerCarrito(true)} hidden={unidades === 0}>
        Ver pedido ({unidades}) · {pesos(total)}
      </button>

      <aside className={'pos-carrito' + (verCarrito ? ' abierto' : '')}>
        <div className="carrito-cabecera">
          <h2>Pedido actual</h2>
          <button className="btn enlace solo-movil" onClick={() => setVerCarrito(false)}>Cerrar</button>
        </div>
        <div className="carrito-items">
          {items.length === 0 && <p className="vacio">Toca un producto para agregarlo.</p>}
          {items.map((i) => (
            <div className="item" key={i.productoId}>
              <ImagenProducto producto={productos.find((p) => p.id === i.productoId)} className="mini" />
              <div>
                <div>{i.nombre}</div>
                <small>{pesos(i.precio)} c/u</small>
              </div>
              <div className="cantidad">
                <button onClick={() => sumar(i.productoId, -1)} aria-label="Quitar uno">−</button>
                <span>{i.cantidad}</span>
                <button onClick={() => sumar(i.productoId, 1)} aria-label="Agregar uno">+</button>
              </div>
              <strong>{pesos(i.precio * i.cantidad)}</strong>
            </div>
          ))}
        </div>
        <div className="carrito-pie">
          <div className="fila total"><span>Total</span><strong>{pesos(total)}</strong></div>
          <label className="etiqueta-campo">Método de pago</label>
          <div className="chips">
            {METODOS_PAGO.map((m) => (
              <button key={m} className={'chip' + (m === metodo ? ' activo' : '')} onClick={() => setMetodo(m)}>{m}</button>
            ))}
          </div>
          {metodo === 'Efectivo' && (
            <>
              <input className="campo" type="number" inputMode="numeric" placeholder="¿Con cuánto paga?" value={recibido} onChange={(e) => setRecibido(e.target.value)} />
              {recibido !== '' && <div className="fila"><span>Cambio</span><strong className={cambio < 0 ? 'rojo' : 'verde'}>{pesos(cambio)}</strong></div>}
            </>
          )}
          <input className="campo" placeholder="Cliente (opcional)" value={cliente} onChange={(e) => setCliente(e.target.value)} />
          <button className="btn primario grande" disabled={items.length === 0} onClick={cobrar}>Cobrar {pesos(total)}</button>
        </div>
      </aside>

      {recibo && (
        <div className="modal-fondo" onClick={() => setRecibo(null)}>
          <div className="modal recibo" onClick={(e) => e.stopPropagation()}>
            <h2>{negocio.nombre}</h2>
            <p className="sub">Recibo #{recibo.numero} · {new Date(recibo.fecha).toLocaleString('es-CO')}</p>
            {recibo.cliente && <p>Cliente: {recibo.cliente}</p>}
            <hr />
            {recibo.items.map((i) => (
              <div className="fila" key={i.productoId}><span>{i.cantidad} × {i.nombre}</span><span>{pesos(i.precio * i.cantidad)}</span></div>
            ))}
            <hr />
            <div className="fila total"><span>Total</span><strong>{pesos(recibo.total)}</strong></div>
            <div className="fila"><span>Pago</span><span>{recibo.metodo}</span></div>
            {recibo.recibido > 0 && <div className="fila"><span>Cambio</span><span>{pesos(recibo.recibido - recibo.total)}</span></div>}
            <div className="acciones no-imprimir">
              <button className="btn" onClick={() => window.print()}>Imprimir</button>
              <button className="btn primario" onClick={() => setRecibo(null)}>Listo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
