import { useState } from 'react'
import { pesos, guardarProducto, borrarProducto, ajustarStock, ponerFotos, guardarReceta, conRecetas, esCobertizo } from '../store'
import ImagenProducto from './Imagen'
import { reducirImagen } from '../imagenes'

const VACIO = { nombre: '', categoria: '', precio: '', costo: '', stock: '', minimo: 5 }
const VACIO_INSUMO = { nombre: '', categoria: 'Insumos', precio: 0, costo: '', stock: '', minimo: 5, esInsumo: true, unidad: 'und' }
const UNIDADES = ['und', 'g', 'kg', 'ml', 'l', 'porción']
const cifra = (n) => Number(n.toFixed(3)).toLocaleString('es-CO')

export default function Inventario({ datos, negocio, esDueno }) {
  // Insumos y recetas: por ahora solo en El Cobertizo
  const conInsumos = esCobertizo(negocio)
  const [seccion, setSeccion] = useState('productos') // productos | insumos
  const enInsumos = conInsumos && seccion === 'insumos'
  const todos = conRecetas(datos, negocio.id)
  const insumos = todos.filter((p) => p.esInsumo)
  const productos = todos.filter((p) => (enInsumos ? p.esInsumo : !p.esInsumo))
  const [buscar, setBuscar] = useState('')
  const [editando, setEditando] = useState(null)
  const [ajuste, setAjuste] = useState(null)
  const [receta, setReceta] = useState(null)

  const visibles = productos.filter((p) => p.nombre.toLowerCase().includes(buscar.toLowerCase()))
  const conStockPropio = productos.filter((p) => !p.receta)
  const valorCosto = conStockPropio.reduce((s, p) => s + p.costo * Math.max(p.stock, 0), 0)
  const valorVenta = conStockPropio.reduce((s, p) => s + p.precio * Math.max(p.stock, 0), 0)
  const categorias = [...new Set(productos.map((p) => p.categoria))]

  // Archivo de fotos preparado aparte: { "NOMBRE DEL PRODUCTO": "data:image/jpeg;base64,..." }
  const [importando, setImportando] = useState(false)
  const [avisoFotos, setAvisoFotos] = useState('')
  const importarFotos = async (e) => {
    const archivo = e.target.files[0]
    e.target.value = ''
    if (!archivo) return
    setImportando(true); setAvisoFotos('')
    try {
      const n = await ponerFotos(JSON.parse(await archivo.text()))
      setAvisoFotos(n ? `Listo: ${n} productos quedaron con foto.` : 'No había productos sin foto que coincidan con el archivo.')
    } catch {
      setAvisoFotos('No se pudieron subir las fotos. Revisa que sea el archivo correcto.')
    }
    setImportando(false)
  }

  return (
    <>
      <header className="titulo">
        <h1>Inventario</h1>
        {esDueno && (
          <div className="titulo-acciones">
            <label className={'btn' + (importando ? ' deshabilitado' : '')}>
              {importando ? 'Subiendo fotos…' : 'Importar fotos'}
              <input type="file" accept=".json,application/json" hidden disabled={importando} onChange={importarFotos} />
            </label>
            <button className="btn primario" onClick={() => setEditando(enInsumos ? VACIO_INSUMO : VACIO)}>{enInsumos ? 'Nuevo insumo' : 'Nuevo producto'}</button>
          </div>
        )}
      </header>
      {avisoFotos && <p className="aviso">{avisoFotos}</p>}
      {conInsumos && (
        <div className="chips">
          <button className={'chip' + (!enInsumos ? ' activo' : '')} onClick={() => setSeccion('productos')}>Productos para vender</button>
          <button className={'chip' + (enInsumos ? ' activo' : '')} onClick={() => setSeccion('insumos')}>Insumos ({insumos.length})</button>
        </div>
      )}
      {enInsumos && <p className="sub">Los insumos no salen en Vender. Se descuentan solos cuando vendes un producto que los tiene en su receta.</p>}

      <section className="tarjetas">
        <div className="tarjeta t-azul"><span>Total de referencias</span><strong>{productos.length}</strong></div>
        <div className="tarjeta t-ambar"><span>Inventario a costo</span><strong>{pesos(valorCosto)}</strong></div>
        {!enInsumos && <div className="tarjeta t-verde"><span>Inventario a precio de venta</span><strong>{pesos(valorVenta)}</strong></div>}
      </section>

      <section className="panel">
        <input className="campo" placeholder="Buscar producto…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        <div className="tabla">
          <div className="tabla-fila cabecera">
            {enInsumos
              ? <><span>Insumo</span><span>Unidad</span><span>Costo por unidad</span><span>Valor en stock</span><span>Disponible</span><span></span></>
              : <><span>Producto</span><span>Precio</span><span>Costo</span><span>Ganancia</span><span>Disponible</span><span></span></>}
          </div>
          {visibles.map((p) => (
            <div className="tabla-fila" key={p.id}>
              <span className="con-foto">
                <ImagenProducto producto={p} className="mini" />
                <span><strong>{p.nombre}</strong><small>{p.categoria}</small></span>
              </span>
              {p.esInsumo ? (
                <>
                  <span data-label="Unidad">{p.unidad}</span>
                  <span data-label="Costo">{pesos(p.costo)}</span>
                  <span data-label="Valor">{pesos(p.costo * Math.max(p.stock, 0))}</span>
                </>
              ) : (
                <>
                  <span data-label="Precio">{pesos(p.precio)}</span>
                  <span data-label="Costo">{pesos(p.costo)}</span>
                  <span data-label="Ganancia">
                    {pesos(p.precio - p.costo)}
                    {p.precio > 0 && <span className="porcentaje">{Math.round(((p.precio - p.costo) / p.precio) * 100)}%</span>}
                  </span>
                </>
              )}
              <span data-label="Stock">
                <span className={'etiqueta' + (p.stock <= p.minimo ? ' alerta' : '')}>
                  {p.receta ? `Alcanza ${p.stock}` : `${cifra(p.stock)}${p.esInsumo && p.unidad !== 'und' ? ' ' + p.unidad : ''}`}
                </span>
              </span>
              <span className="acciones-fila">
                {esDueno && conInsumos && !p.esInsumo && <button className="btn enlace" onClick={() => setReceta(p)}>Receta</button>}
                {esDueno && !p.receta && <button className="btn enlace" onClick={() => setAjuste(p)}>Stock</button>}
                {esDueno && <button className="btn enlace" onClick={() => setEditando(p.receta ? { ...datos.productos.find((x) => x.id === p.id), receta: p.receta } : p)}>Editar</button>}
              </span>
            </div>
          ))}
          {visibles.length === 0 && <p className="vacio">No hay productos.</p>}
        </div>
      </section>

      {editando && <FormProducto inicial={editando} categorias={categorias} cerrar={() => setEditando(null)} />}
      {receta && <FormReceta producto={receta} insumos={insumos} recetas={datos.recetas} cerrar={() => setReceta(null)} />}
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
  const insumo = Boolean(f.esInsumo)
  const enviar = async (e) => {
    e.preventDefault()
    try {
      const { receta: _receta, ...producto } = f // la receta se guarda aparte
      await guardarProducto({
        ...producto, nombre: f.nombre.trim(), categoria: f.categoria.trim() || 'General',
        precio: Number(f.precio), costo: Number(f.costo) || 0, stock: Number(f.stock) || 0, minimo: Number(f.minimo) || 0,
      })
      cerrar()
    } catch { /* el error se muestra arriba */ }
  }
  return (
    <div className="modal-fondo" onClick={cerrar}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
        <h2>{inicial.id ? (insumo ? 'Editar insumo' : 'Editar producto') : (insumo ? 'Nuevo insumo' : 'Nuevo producto')}</h2>
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
        {insumo ? (
          <div className="dos">
            <div>
              <label className="etiqueta-campo">Unidad de medida</label>
              <select className="campo" value={f.unidad} onChange={cambiar('unidad')}>{UNIDADES.map((u) => <option key={u}>{u}</option>)}</select>
            </div>
            <div><label className="etiqueta-campo">Costo por {f.unidad}</label><input className="campo" type="number" min="0" step="any" value={f.costo} onChange={cambiar('costo')} /></div>
          </div>
        ) : (
          <div className="dos">
            <div><label className="etiqueta-campo">Precio de venta</label><input className="campo" required type="number" min="0" value={f.precio} onChange={cambiar('precio')} /></div>
            {!f.receta && <div><label className="etiqueta-campo">Costo</label><input className="campo" type="number" min="0" value={f.costo} onChange={cambiar('costo')} /></div>}
          </div>
        )}
        {f.receta && <p className="aviso">Este producto tiene receta: su costo y lo disponible salen de los insumos.</p>}
        <div className="dos">
          {!f.receta && <div><label className="etiqueta-campo">Stock actual{insumo ? ` (${f.unidad})` : ''}</label><input className="campo" type="number" step="any" value={f.stock} onChange={cambiar('stock')} /></div>}
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

// Receta de un producto: qué insumos gasta y cuánto de cada uno por unidad vendida.
function FormReceta({ producto, insumos, recetas, cerrar }) {
  const [lineas, setLineas] = useState(() => recetas.filter((r) => r.productoId === producto.id)
    .map((r) => ({ insumoId: r.insumoId, cantidad: String(r.cantidad) })))
  const [guardando, setGuardando] = useState(false)
  const cambiar = (i, k, v) => setLineas(lineas.map((l, j) => (j === i ? { ...l, [k]: v } : l)))
  const libres = (actual) => insumos.filter((x) => x.id === actual || !lineas.some((l) => l.insumoId === x.id))
  const agregar = () => {
    const siguiente = libres(null)[0]
    if (siguiente) setLineas([...lineas, { insumoId: siguiente.id, cantidad: '1' }])
  }
  const costo = lineas.reduce((s, l) => s + (insumos.find((x) => x.id === l.insumoId)?.costo || 0) * (Number(l.cantidad) || 0), 0)
  const enviar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      await guardarReceta(producto.id, lineas.filter((l) => Number(l.cantidad) > 0).map((l) => ({ insumoId: l.insumoId, cantidad: Number(l.cantidad) })))
      cerrar()
    } catch { setGuardando(false) }
  }
  return (
    <div className="modal-fondo" onClick={cerrar}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
        <h2>Receta de {producto.nombre}</h2>
        <p className="sub">Cuánto gasta de cada insumo <strong>por cada unidad</strong> que vendes.</p>
        {insumos.length === 0 && <p className="aviso">Primero crea tus insumos en la pestaña “Insumos” (ej: pan, carne).</p>}
        {lineas.map((l, i) => {
          const ins = insumos.find((x) => x.id === l.insumoId)
          return (
            <div className="receta-linea" key={i}>
              <select className="campo" value={l.insumoId} onChange={(e) => cambiar(i, 'insumoId', e.target.value)}>
                {libres(l.insumoId).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
              </select>
              <input className="campo" type="number" min="0" step="any" inputMode="decimal" value={l.cantidad} onChange={(e) => cambiar(i, 'cantidad', e.target.value)} aria-label="Cantidad" />
              <span className="receta-unidad">{ins?.unidad}</span>
              <button type="button" className="icono-borrar" onClick={() => setLineas(lineas.filter((_, j) => j !== i))} aria-label="Quitar insumo">✕</button>
            </div>
          )
        })}
        {libres(null).length > 0 && <button type="button" className="btn enlace" onClick={agregar}>+ Agregar insumo</button>}
        {lineas.length > 0 && <div className="fila total"><span>Costo por unidad</span><strong>{pesos(costo)}</strong></div>}
        {lineas.length > 0 && producto.precio > 0 && <p className="sub">Ganancia: {pesos(producto.precio - costo)} ({Math.round(((producto.precio - costo) / producto.precio) * 100)}%)</p>}
        <div className="acciones">
          <button type="button" className="btn" onClick={cerrar}>Cancelar</button>
          <button className="btn primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar receta'}</button>
        </div>
      </form>
    </div>
  )
}
