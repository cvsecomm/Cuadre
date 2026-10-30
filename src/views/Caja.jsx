import { useState } from 'react'
import { Search, Trash2, Minus, Plus, ChevronRight, ChevronLeft, Receipt } from 'lucide-react'
import { pesos, registrarVenta, METODOS_PAGO } from '../store'
import ImagenProducto from './Imagen'
import FormGasto from './FormGasto'

export default function Caja({ datos, negocio }) {
  const productos = datos.productos.filter((p) => p.negocioId === negocio.id)
  const categorias = ['Todos', ...new Set(productos.map((p) => p.categoria))]
  const [categoria, setCategoria] = useState('Todos')
  const [buscar, setBuscar] = useState('')
  const [carrito, setCarrito] = useState({}) // productoId -> cantidad
  const [paso, setPaso] = useState('productos') // productos | pago
  const [metodo, setMetodo] = useState(METODOS_PAGO[0])
  const [recibido, setRecibido] = useState('')
  const [cliente, setCliente] = useState('')
  const [recibo, setRecibo] = useState(null)
  const [verCarrito, setVerCarrito] = useState(false)
  const [nuevoGasto, setNuevoGasto] = useState(false)

  const visibles = productos.filter((p) =>
    (categoria === 'Todos' || p.categoria === categoria) &&
    p.nombre.toLowerCase().includes(buscar.toLowerCase()))

  const items = Object.entries(carrito).map(([id, cantidad]) => {
    const producto = productos.find((x) => x.id === id)
    return producto && { producto, cantidad }
  }).filter(Boolean)
  const total = items.reduce((s, i) => s + i.producto.precio * i.cantidad, 0)
  const unidades = items.reduce((s, i) => s + i.cantidad, 0)
  const cambio = Number(recibido) - total

  const sumar = (id, n) => setCarrito((c) => {
    const cantidad = (c[id] || 0) + n
    const nuevo = { ...c }
    if (cantidad <= 0) delete nuevo[id]
    else nuevo[id] = cantidad
    return nuevo
  })
  const quitar = (id) => setCarrito((c) => { const n = { ...c }; delete n[id]; return n })

  const cobrar = () => {
    const venta = registrarVenta({
      items: items.map(({ producto: p, cantidad }) => ({ productoId: p.id, nombre: p.nombre, precio: p.precio, costo: p.costo, cantidad })),
      metodo,
      cliente,
    })
    setRecibo({ ...venta, recibido: Number(recibido) || 0 })
    setCarrito({}); setRecibido(''); setCliente(''); setVerCarrito(false); setPaso('productos')
  }

  return (
    <div className="pos">
      <section className="pos-productos">
        <header className="barra-vender">
          <h1>Nueva venta</h1>
          <label className="buscador">
            <Search size={17} />
            <input placeholder="Buscar productos" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          </label>
          <button className="btn rojo-solido" onClick={() => setNuevoGasto(true)}>Nuevo gasto</button>
        </header>
        <div className="pestanas">
          {categorias.map((c) => (
            <button key={c} className={c === categoria ? 'activo' : ''} onClick={() => setCategoria(c)}>{c}</button>
          ))}
        </div>
        <div className="grilla">
          {visibles.map((p) => {
            const agotado = p.stock <= 0
            return (
              <button key={p.id} className={'producto' + (carrito[p.id] ? ' en-pedido' : '')} onClick={() => sumar(p.id, 1)} disabled={agotado}>
                {carrito[p.id] && <span className="contador">{carrito[p.id]}</span>}
                <ImagenProducto producto={p} />
                <span className="precio">{pesos(p.precio)}</span>
                <span className="nombre">{p.nombre}</span>
                <span className={'disponible' + (p.stock <= p.minimo ? ' bajo' : '')}>
                  {agotado ? 'Agotado' : `${p.stock} disponibles`}
                </span>
              </button>
            )
          })}
          {visibles.length === 0 && <p className="vacio">No hay productos. Agrégalos en Inventario.</p>}
        </div>
      </section>

      <button className="ver-carrito" onClick={() => setVerCarrito(true)} hidden={unidades === 0}>
        <span className="cuenta">{unidades}</span> Ver pedido <strong>{pesos(total)}</strong>
      </button>

      <aside className={'pos-carrito' + (verCarrito ? ' abierto' : '')}>
        {paso === 'productos' ? (
          <>
            <div className="carrito-cabecera">
              <button className="btn enlace solo-movil" onClick={() => setVerCarrito(false)}><ChevronLeft size={18} /></button>
              <h2>Productos</h2>
              {items.length > 0 && <button className="btn enlace subrayado" onClick={() => setCarrito({})}>Vaciar pedido</button>}
            </div>
            <div className="carrito-items">
              {items.length === 0 && (
                <div className="vacio carrito-vacio">
                  <Receipt size={36} strokeWidth={1.5} />
                  <p>Toca un producto para agregarlo al pedido.</p>
                </div>
              )}
              {items.map(({ producto: p, cantidad }) => (
                <div className="item" key={p.id}>
                  <div className="item-fila">
                    <ImagenProducto producto={p} className="mini" />
                    <div className="item-texto">
                      <div>{p.nombre}</div>
                      <small>{p.stock} disponibles</small>
                    </div>
                    <button className="icono-borrar" onClick={() => quitar(p.id)} aria-label={`Quitar ${p.nombre}`}><Trash2 size={16} /></button>
                  </div>
                  <div className="item-fila">
                    <div className="cantidad">
                      <button onClick={() => sumar(p.id, -1)} aria-label="Quitar uno"><Minus size={14} /></button>
                      <span>{cantidad}</span>
                      <button onClick={() => sumar(p.id, 1)} aria-label="Agregar uno"><Plus size={14} /></button>
                    </div>
                    <span className="subtotal">{pesos(p.precio * cantidad)}</span>
                  </div>
                </div>
              ))}
            </div>
            <button className="continuar" disabled={items.length === 0} onClick={() => setPaso('pago')}>
              <span className="cuenta">{unidades}</span>
              <span>Continuar</span>
              <strong>{pesos(total)}</strong>
              <ChevronRight size={18} />
            </button>
          </>
        ) : (
          <>
            <div className="carrito-cabecera">
              <button className="btn enlace" onClick={() => setPaso('productos')}><ChevronLeft size={18} /> Volver</button>
            </div>
            <div className="carrito-items">
              <div className="total-pagar">
                <small>Total a cobrar</small>
                <strong>{pesos(total)}</strong>
              </div>
              <label className="etiqueta-campo">Método de pago</label>
              <div className="metodos">
                {METODOS_PAGO.map((m) => (
                  <button key={m} className={m === metodo ? 'activo' : ''} onClick={() => setMetodo(m)}>{m}</button>
                ))}
              </div>
              {metodo === 'Efectivo' && (
                <>
                  <label className="etiqueta-campo" htmlFor="recibido">¿Con cuánto paga?</label>
                  <input id="recibido" className="campo" type="number" inputMode="numeric" value={recibido} onChange={(e) => setRecibido(e.target.value)} />
                  {recibido !== '' && (
                    <div className={'cambio' + (cambio < 0 ? ' falta' : '')}>
                      <span>{cambio < 0 ? 'Falta' : 'Cambio'}</span><strong>{pesos(Math.abs(cambio))}</strong>
                    </div>
                  )}
                </>
              )}
              <label className="etiqueta-campo" htmlFor="cliente">Cliente (opcional)</label>
              <input id="cliente" className="campo" value={cliente} onChange={(e) => setCliente(e.target.value)} />
            </div>
            <button className="btn primario grande" onClick={cobrar}>Confirmar venta</button>
          </>
        )}
      </aside>

      {nuevoGasto && <FormGasto cerrar={() => setNuevoGasto(false)} />}

      {recibo && (
        <div className="modal-fondo" onClick={() => setRecibo(null)}>
          <div className="modal recibo" onClick={(e) => e.stopPropagation()}>
            <div className="exito">✓</div>
            <h2>¡Venta registrada!</h2>
            <p className="sub">{negocio.nombre} · Recibo #{recibo.numero} · {new Date(recibo.fecha).toLocaleString('es-CO')}</p>
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
              <button className="btn primario" onClick={() => setRecibo(null)}>Nueva venta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
