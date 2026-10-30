import { useState } from 'react'
import { pesos, guardarProducto, borrarProducto, ajustarStock } from '../store'
import ImagenProducto from './Imagen'
import { reducirImagen } from '../imagenes'

const VACIO = { nombre: '', categoria: '', precio: '', costo: '', stock: '', minimo: 5 }

export default function Inventario({ datos, negocio, esDueno }) {
  const productos = datos.productos.filter((p) => p.negocioId === negocio.id)
  const [buscar, setBuscar] = useState('')
  const [editando, setEditando] = useState(null)
  const [ajuste, setAjuste] = useState(null)

  const visibles = productos.filter((p) => p.nombre.toLowerCase().includes(buscar.toLowerCase()))
  const valorCosto = productos.reduce((s, p) => s + p.costo * Math.max(p.stock, 0), 0)
  const valorVenta = productos.reduce((s, p) => s + p.precio * Math.max(p.stock, 0), 0)
  const categorias = [...new Set(productos.map((p) => p.categoria))]

  return (
    <>
      <header className="titulo">
        <h1>Inventario</h1>
        {esDueno && <button className="btn primario" onClick={() => setEditando(VACIO)}>Nuevo producto</button>}
      </header>

      <section className="tarjetas">
        <div className="tarjeta t-azul"><span>Total de referencias</span><strong>{productos.length}</strong></div>
        <div className="tarjeta t-ambar"><span>Inventario a costo</span><strong>{pesos(valorCosto)}</strong></div>
        <div className="tarjeta t-verde"><span>Inventario a precio de venta</span><strong>{pesos(valorVenta)}</strong></div>
      </section>

      <section className="panel">
        <input className="campo" placeholder="Buscar producto…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        <div className="tabla">
          <div className="tabla-fila cabecera">
            <span>Producto</span><span>Precio</span><span>Costo</span><span>Ganancia</span><span>Disponible</span><span></span>
          </div>
          {visibles.map((p) => (
            <div className="tabla-fila" key={p.id}>
              <span className="con-foto">
                <ImagenProducto producto={p} className="mini" />
                <span><strong>{p.nombre}</strong><small>{p.categoria}</small></span>
              </span>
              <span data-label="Precio">{pesos(p.precio)}</span>
              <span data-label="Costo">{pesos(p.costo)}</span>
              <span data-label="Ganancia">
                {pesos(p.precio - p.costo)}
                {p.precio > 0 && <span className="porcentaje">{Math.round(((p.precio - p.costo) / p.precio) * 100)}%</span>}
              </span>
              <span data-label="Stock"><span className={'etiqueta' + (p.stock <= p.minimo ? ' alerta' : '')}>{p.stock}</span></span>
              <span className="acciones-fila">
                {esDueno && <button className="btn enlace" onClick={() => setAjuste(p)}>Stock</button>}
                {esDueno && <button className="btn enlace" onClick={() => setEditando(p)}>Editar</button>}
              </span>
            </div>
          ))}
          {visibles.length === 0 && <p className="vacio">No hay productos.</p>}
        </div>
      </section>

      {editando && <FormProducto inicial={editando} categorias={categorias} cerrar={() => setEditando(null)} />}
      {ajuste && <FormAjuste producto={ajuste} cerrar={() => setAjuste(null)} />}
    </>
  )
}

function FormProducto({ inicial, categorias, cerrar }) {
  const [f, setF] = useState(inicial)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const [errorFoto, setErrorFoto] = useState('')
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const elegirFoto = async (e) => {
    const archivo = e.target.files[0]
    if (!archivo) return
    try {
      setF({ ...f, imagen: await reducirImagen(archivo) })
      setErrorFoto('')
    } catch {
      setErrorFoto('No pudimos leer esa imagen. Prueba con una foto JPG o PNG.')
    }
  }
  const enviar = async (e) => {
    e.preventDefault()
    try {
      await guardarProducto({
      ...f, nombre: f.nombre.trim(), categoria: f.categoria.trim() || 'General',
        precio: Number(f.precio), costo: Number(f.costo) || 0, stock: Number(f.stock) || 0, minimo: Number(f.minimo) || 0,
      })
      cerrar()
    } catch { /* el error se muestra arriba */ }
  }
  return (
    <div className="modal-fondo" onClick={cerrar}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
        <h2>{inicial.id ? 'Editar producto' : 'Nuevo producto'}</h2>
        <div className="foto-campo">
          <ImagenProducto producto={f} className="grande" />
          <div>
            <label className="btn" htmlFor="foto-producto">{f.imagen ? 'Cambiar foto' : 'Agregar foto'}</label>
            <input id="foto-producto" type="file" accept="image/*" hidden onChange={elegirFoto} />
            {f.imagen && <button type="button" className="btn enlace peligro" onClick={() => setF({ ...f, imagen: '' })}>Quitar</button>}
            <small>Puedes tomarla con la cámara del celular.</small>
            {errorFoto && <small className="rojo">{errorFoto}</small>}
          </div>
        </div>
        <label className="etiqueta-campo">Nombre</label>
        <input className="campo" required autoFocus value={f.nombre} onChange={cambiar('nombre')} />
        <label className="etiqueta-campo">Categoría</label>
        <input className="campo" list="categorias" placeholder="Ej: Bebidas" value={f.categoria} onChange={cambiar('categoria')} />
        <datalist id="categorias">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
        <div className="dos">
          <div><label className="etiqueta-campo">Precio de venta</label><input className="campo" required type="number" min="0" value={f.precio} onChange={cambiar('precio')} /></div>
          <div><label className="etiqueta-campo">Costo</label><input className="campo" type="number" min="0" value={f.costo} onChange={cambiar('costo')} /></div>
        </div>
        <div className="dos">
          <div><label className="etiqueta-campo">Stock actual</label><input className="campo" type="number" value={f.stock} onChange={cambiar('stock')} /></div>
          <div><label className="etiqueta-campo">Avisar cuando queden</label><input className="campo" type="number" min="0" value={f.minimo} onChange={cambiar('minimo')} /></div>
        </div>
        <div className="acciones">
          {inicial.id && (confirmarBorrado
            ? <button type="button" className="btn peligro" onClick={() => Promise.resolve(borrarProducto(inicial.id)).then(cerrar, () => {})}>Sí, borrar</button>
            : <button type="button" className="btn peligro" onClick={() => setConfirmarBorrado(true)}>Borrar</button>)}
          <button type="button" className="btn" onClick={cerrar}>Cancelar</button>
          <button className="btn primario">Guardar</button>
        </div>
      </form>
    </div>
  )
}

function FormAjuste({ producto, cerrar }) {
  const [cantidad, setCantidad] = useState('')
  const aplicar = (signo) => {
    const n = Number(cantidad)
    if (n > 0) Promise.resolve(ajustarStock(producto.id, signo * n)).then(cerrar, () => {})
  }
  return (
    <div className="modal-fondo" onClick={cerrar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{producto.nombre}</h2>
        <p className="sub">Stock actual: {producto.stock}</p>
        <label className="etiqueta-campo">Cantidad</label>
        <input className="campo" type="number" min="1" autoFocus value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
        <div className="acciones">
          <button className="btn" onClick={() => aplicar(-1)}>Sacar (daño, pérdida)</button>
          <button className="btn primario" onClick={() => aplicar(1)}>Entrada (compra)</button>
        </div>
      </div>
    </div>
  )
}
