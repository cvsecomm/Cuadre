import { useEffect, useState } from 'react'
import { Search, Trash2, Minus, Plus, Pencil, Printer, ChevronRight, ChevronLeft, Receipt } from 'lucide-react'
import { pesos, registrarVenta, crearPedido, guardarPedido, borrarPedido, METODOS_PAGO, esCobertizo, conRecetas } from '../store'

const CONSUMO = 'Consumo interno'
import ImagenProducto from './Imagen'
import FormGasto from './FormGasto'
import FormVentaML from './FormVentaML'
import FormMitad from './FormMitad'

const leerModoML = (negocio) => {
  try {
    const v = localStorage.getItem('cuadre-ml-' + negocio.id)
    return v === null ? negocio.tipo === 'ecommerce' : v === '1'
  } catch { return negocio.tipo === 'ecommerce' }
}

export default function Caja({ datos, negocio }) {
  // Los insumos (pan, carne…) no se venden: se gastan con las recetas.
  const productos = conRecetas(datos, negocio.id).filter((p) => !p.esInsumo)
  const categorias = ['Todos', ...new Set(productos.map((p) => p.categoria))]
  const [categoria, setCategoria] = useState('Todos')
  const [buscar, setBuscar] = useState('')
  // Pedidos abiertos (mesas o cuentas): cada uno guarda sus productos hasta que se cobra.
  const pedidos = datos.pedidos.filter((p) => p.negocioId === negocio.id)
  const [pedidoId, setPedidoId] = useState(null)
  const pedido = pedidos.find((p) => p.id === pedidoId) ?? pedidos[0]
  const normales = (pedido?.items ?? []).filter((i) => !i.mitad)
  const carrito = Object.fromEntries(normales.map((i) => [i.productoId, i.cantidad])) // productoId -> cantidad
  // Pizzas mitad y mitad: { mitad: [idA, idB], cantidad }. Se cobra el precio del sabor más caro.
  const mitades = (pedido?.items ?? []).filter((i) => i.mitad).map((m) => {
    const a = productos.find((p) => p.id === m.mitad[0])
    const b = productos.find((p) => p.id === m.mitad[1])
    return a && b && { a, b, cantidad: m.cantidad, precio: Math.max(a.precio, b.precio) }
  }).filter(Boolean)
  const [elegirMitad, setElegirMitad] = useState(false)
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  // Comanda para cocina: se dibuja solo mientras se imprime, para que no se mezcle con el recibo.
  const [comanda, setComanda] = useState(null)
  useEffect(() => {
    if (!comanda) return
    window.print()
    setComanda(null)
  }, [comanda])
  const [paso, setPaso] = useState('productos') // productos | pago
  const [metodo, setMetodo] = useState(METODOS_PAGO[0])
  const [recibido, setRecibido] = useState('')
  const [cliente, setCliente] = useState('')
  const [clienteDoc, setClienteDoc] = useState('')
  const [recibo, setRecibo] = useState(null)
  const [verCarrito, setVerCarrito] = useState(false)
  const [nuevoGasto, setNuevoGasto] = useState(false)
  const [modoML, setModoML] = useState(() => leerModoML(negocio))
  const [ventaML, setVentaML] = useState(null) // producto que se está vendiendo por Mercado Libre
  const [aviso, setAviso] = useState('')

  const cambiarModoML = () => {
    const nuevo = !modoML
    setModoML(nuevo)
    try { localStorage.setItem('cuadre-ml-' + negocio.id, nuevo ? '1' : '0') } catch { /* sin almacenamiento */ }
  }
  const terminarVentaML = (texto) => {
    setVentaML(null)
    setAviso(texto)
    setTimeout(() => setAviso(''), 3000)
  }

  const visibles = productos.filter((p) =>
    (categoria === 'Todos' || p.categoria === categoria) &&
    p.nombre.toLowerCase().includes(buscar.toLowerCase()))

  const items = Object.entries(carrito).map(([id, cantidad]) => {
    const producto = productos.find((x) => x.id === id)
    return producto && { producto, cantidad }
  }).filter(Boolean)
  const total = items.reduce((s, i) => s + i.producto.precio * i.cantidad, 0) + mitades.reduce((s, m) => s + m.precio * m.cantidad, 0)
  const unidades = items.reduce((s, i) => s + i.cantidad, 0) + mitades.reduce((s, m) => s + m.cantidad, 0)
  const lineas = items.length + mitades.length
  // Consumo interno (comida del personal, etc.): sale del inventario pero no se cobra.
  const metodos = esCobertizo(negocio) ? [...METODOS_PAGO, CONSUMO] : METODOS_PAGO
  const esConsumo = metodo === CONSUMO
  const costoTotal = items.reduce((s, i) => s + i.producto.costo * i.cantidad, 0)
    + mitades.reduce((s, m) => s + (m.a.costo + m.b.costo) / 2 * m.cantidad, 0)
  const cambio = Number(recibido) - total

  const nombreNuevo = () => {
    let n = pedidos.length + 1
    while (pedidos.some((p) => p.nombre === `Mesa ${n}`)) n++
    return `Mesa ${n}`
  }
  const nuevoPedido = () => {
    setPedidoId(crearPedido(nombreNuevo()))
    setPaso('productos'); setConfirmarBorrar(false)
  }
  const elegirPedido = (id) => { setPedidoId(id); setPaso('productos'); setConfirmarBorrar(false) }
  const guardarItems = (items) => {
    if (pedido) guardarPedido(pedido.id, { items })
    else setPedidoId(crearPedido(nombreNuevo(), items))
  }
  const listaMitades = () => mitades.map((m) => ({ mitad: [m.a.id, m.b.id], cantidad: m.cantidad }))
  const cambiarCarrito = (nuevo) => {
    guardarItems([...Object.entries(nuevo).map(([productoId, cantidad]) => ({ productoId, cantidad })), ...listaMitades()])
  }
  const cambiarMitades = (lista) => guardarItems([...normales, ...lista.filter((m) => m.cantidad > 0)])
  const sumarMitad = (i, n) => cambiarMitades(listaMitades().map((m, j) => (j === i ? { ...m, cantidad: m.cantidad + n } : m)))
  const agregarMitad = (a, b) => {
    const lista = listaMitades()
    const igual = lista.findIndex((m) => (m.mitad[0] === a.id && m.mitad[1] === b.id) || (m.mitad[0] === b.id && m.mitad[1] === a.id))
    if (igual >= 0) lista[igual] = { ...lista[igual], cantidad: lista[igual].cantidad + 1 }
    else lista.push({ mitad: [a.id, b.id], cantidad: 1 })
    cambiarMitades(lista)
    setElegirMitad(false)
  }
  const sumar = (id, n) => {
    const cantidad = (carrito[id] || 0) + n
    const nuevo = { ...carrito }
    if (cantidad <= 0) delete nuevo[id]
    else nuevo[id] = cantidad
    cambiarCarrito(nuevo)
  }
  const quitar = (id) => { const n = { ...carrito }; delete n[id]; cambiarCarrito(n) }
  const eliminarPedido = () => {
    if (pedido) borrarPedido(pedido.id)
    setPedidoId(null); setConfirmarBorrar(false); setPaso('productos')
  }

  const [cobrando, setCobrando] = useState(false)
  const cobrar = async () => {
    setCobrando(true)
    let venta
    try {
      venta = await registrarVenta({
        items: [
          ...items.map(({ producto: p, cantidad }) => ({ productoId: p.id, nombre: p.nombre, precio: esConsumo ? 0 : p.precio, costo: p.costo, cantidad })),
          // Cada mitad descuenta media unidad de su sabor; entre las dos suman el precio del más caro.
          ...mitades.flatMap((m) => [m.a, m.b].map((p) => ({
            productoId: p.id, nombre: `½ ${p.nombre}`, precio: esConsumo ? 0 : m.precio, costo: p.costo, cantidad: m.cantidad / 2,
          }))),
        ],
        metodo,
        cliente,
        clienteDoc,
      })
    } catch {
      setCobrando(false) // el error se muestra arriba de la pantalla
      return
    }
    setCobrando(false)
    setRecibo({ ...venta, recibido: Number(recibido) || 0 })
    borrarPedido(pedido.id)
    setPedidoId(null); setMetodo(METODOS_PAGO[0]); setRecibido(''); setCliente(''); setClienteDoc(''); setVerCarrito(false); setPaso('productos')
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
          <div className="vender-acciones">
            <button className={'chip modo-ml' + (modoML ? ' activo' : '')} onClick={cambiarModoML} aria-pressed={modoML}>
              Mercado Libre {modoML ? 'activado' : ''}
            </button>
            {!modoML && <button className="chip mitad-boton" onClick={() => setElegirMitad(true)}>½ Mitad y mitad</button>}
            <button className="btn rojo-solido" onClick={() => setNuevoGasto(true)}>Nuevo gasto</button>
          </div>
        </header>
        {modoML && <p className="aviso ml-aviso">Modo Mercado Libre: toca un producto y escribe cuánto te llegó.</p>}
        <div className="pestanas">
          {categorias.map((c) => (
            <button key={c} className={c === categoria ? 'activo' : ''} onClick={() => setCategoria(c)}>{c}</button>
          ))}
        </div>
        <div className="grilla">
          {visibles.map((p) => {
            const agotado = p.stock <= 0
            return (
              <button key={p.id} className={'producto' + (carrito[p.id] ? ' en-pedido' : '')} onClick={() => (modoML ? setVentaML(p) : sumar(p.id, 1))} disabled={agotado}>
                {carrito[p.id] && <span className="contador">{carrito[p.id]}</span>}
                <ImagenProducto producto={p} />
                {!modoML && <span className="precio">{pesos(p.precio)}</span>}
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

      <button className="ver-carrito" onClick={() => setVerCarrito(true)} hidden={pedidos.length === 0 || modoML}>
        <span className="cuenta">{unidades}</span> {pedidos.length > 1 ? `${pedido.nombre} · ${pedidos.length} abiertos` : 'Ver pedido'} <strong>{pesos(total)}</strong>
      </button>

      <aside className={'pos-carrito' + (verCarrito ? ' abierto' : '')}>
        {paso === 'productos' ? (
          <>
            <div className="carrito-cabecera">
              <button className="btn enlace solo-movil" onClick={() => setVerCarrito(false)}><ChevronLeft size={18} /></button>
              {pedido ? (
                <label className="pedido-nombre-caja" title="Toca para cambiar el nombre">
                  <input key={pedido.id} className="pedido-nombre" defaultValue={pedido.nombre} aria-label="Nombre del pedido"
                    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
                    onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== pedido.nombre) guardarPedido(pedido.id, { nombre: v }) }} />
                  <Pencil size={15} />
                </label>
              ) : <h2>Productos</h2>}
              {pedido && (confirmarBorrar ? (
                <span className="confirmar-borrar">
                  <button className="btn enlace" onClick={() => setConfirmarBorrar(false)}>No</button>
                  <button className="btn enlace rojo" onClick={eliminarPedido}>Sí, eliminar</button>
                </span>
              ) : <button className="btn enlace subrayado" onClick={() => setConfirmarBorrar(true)}>Eliminar pedido</button>)}
            </div>
            <div className="pedidos-abiertos">
              {pedidos.map((p) => (
                <button key={p.id} className={'chip' + (p.id === pedido?.id ? ' activo' : '')} onClick={() => elegirPedido(p.id)}>
                  {p.nombre} <small>{p.items.reduce((s, i) => s + i.cantidad, 0)}</small>
                </button>
              ))}
              <button className="chip nuevo" onClick={nuevoPedido}><Plus size={14} /> Nuevo pedido</button>
            </div>
            <div className="carrito-items">
              {lineas === 0 && (
                <div className="vacio carrito-vacio">
                  <Receipt size={36} strokeWidth={1.5} />
                  <p>{pedido ? 'Toca un producto para agregarlo. Para cambiar el nombre (Mesa 1, Domicilio…) toca el título.' : 'Toca un producto para empezar un pedido.'}</p>
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
              {mitades.map((m, i) => (
                <div className="item" key={'mitad' + i}>
                  <div className="item-fila">
                    <span className="mini imagen-mitad">½</span>
                    <div className="item-texto">
                      <div>½ {m.a.nombre} + ½ {m.b.nombre}</div>
                      <small>Mitad y mitad</small>
                    </div>
                    <button className="icono-borrar" onClick={() => sumarMitad(i, -m.cantidad)} aria-label="Quitar mitad y mitad"><Trash2 size={16} /></button>
                  </div>
                  <div className="item-fila">
                    <div className="cantidad">
                      <button onClick={() => sumarMitad(i, -1)} aria-label="Quitar uno"><Minus size={14} /></button>
                      <span>{m.cantidad}</span>
                      <button onClick={() => sumarMitad(i, 1)} aria-label="Agregar uno"><Plus size={14} /></button>
                    </div>
                    <span className="subtotal">{pesos(m.precio * m.cantidad)}</span>
                  </div>
                </div>
              ))}
            </div>
            {lineas > 0 && (
              <button className="btn imprimir-comanda" onClick={() => setComanda({ nombre: pedido.nombre, fecha: new Date(), items, mitades })}>
                <Printer size={17} /> Imprimir comanda
              </button>
            )}
            <button className="continuar" disabled={lineas === 0} onClick={() => setPaso('pago')}>
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
                <small>{esConsumo ? 'Consumo interno (no se cobra)' : 'Total a cobrar'}</small>
                <strong>{pesos(esConsumo ? 0 : total)}</strong>
                {esConsumo && <small>Costo de lo consumido: {pesos(costoTotal)}</small>}
              </div>
              <label className="etiqueta-campo">Método de pago</label>
              <div className="metodos">
                {metodos.map((m) => (
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
              <label className="etiqueta-campo" htmlFor="cliente">{esConsumo ? '¿Quién lo consumió? (opcional)' : 'Cliente (opcional)'}</label>
              <input id="cliente" className="campo" placeholder={esConsumo ? 'Ej: almuerzo de Carlos' : ''} value={cliente} onChange={(e) => setCliente(e.target.value)} />
              {!esConsumo && (
                <>
                  <label className="etiqueta-campo" htmlFor="cliente-doc">Cédula o NIT del cliente (opcional)</label>
                  <input id="cliente-doc" className="campo" inputMode="numeric" value={clienteDoc} onChange={(e) => setClienteDoc(e.target.value)} />
                </>
              )}
            </div>
            <button className="btn primario grande" onClick={cobrar} disabled={cobrando}>{cobrando ? 'Guardando…' : esConsumo ? 'Registrar consumo' : 'Confirmar venta'}</button>
          </>
        )}
      </aside>

      {comanda && (
        <div className="comanda">
          <strong className="comanda-titulo">COMANDA</strong>
          <div className="comanda-mesa">{comanda.nombre}</div>
          <div className="comanda-fecha">{comanda.fecha.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</div>
          <hr />
          {comanda.items.map(({ producto: p, cantidad }) => (
            <div className="comanda-item" key={p.id}><strong>{cantidad}</strong><span>{p.nombre}</span></div>
          ))}
          {comanda.mitades.map((m, i) => (
            <div className="comanda-item" key={'m' + i}><strong>{m.cantidad}</strong><span>½ {m.a.nombre} + ½ {m.b.nombre}</span></div>
          ))}
          <hr />
        </div>
      )}
      {nuevoGasto && <FormGasto cerrar={() => setNuevoGasto(false)} />}
      {elegirMitad && (
        <FormMitad productos={categoria === 'Todos' ? productos : productos.filter((p) => p.categoria === categoria)}
          cerrar={() => setElegirMitad(false)} agregar={agregarMitad} />
      )}
      {ventaML && <FormVentaML producto={ventaML} cerrar={() => setVentaML(null)} listo={terminarVentaML} />}
      {aviso && <div className="toast">✓ {aviso}</div>}

      {recibo && (
        <div className="modal-fondo" onClick={() => setRecibo(null)}>
          <div className="modal recibo" onClick={(e) => e.stopPropagation()}>
            <div className="exito no-imprimir">✓</div>
            <h2 className="no-imprimir">{recibo.metodo === CONSUMO ? "¡Consumo registrado!" : "¡Venta registrada!"}</h2>
            <div className="recibo-negocio">
              <strong>{negocio.nombre}</strong>
              {negocio.nit && <span>NIT {negocio.nit}</span>}
              {negocio.direccion && <span>{negocio.direccion}</span>}
              {negocio.telefono && <span>Tel. {negocio.telefono}</span>}
              <span>Recibo #{recibo.numero} · {new Date(recibo.fecha).toLocaleString('es-CO')}</span>
            </div>
            {(recibo.cliente || recibo.clienteDoc) && (
              <p className="recibo-cliente">
                Cliente: {recibo.cliente || '—'}{recibo.clienteDoc && <> · C.C./NIT {recibo.clienteDoc}</>}
              </p>
            )}
            <hr />
            {recibo.items.map((i, n) => (
              <div className="fila" key={n}><span>{i.nombre.startsWith("½ ") ? i.cantidad * 2 : i.cantidad} × {i.nombre}</span><span>{pesos(i.precio * i.cantidad)}</span></div>
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
