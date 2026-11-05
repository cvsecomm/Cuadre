import { useState } from 'react'
import { registrarGasto, ajustarStock, guardarProducto, useDatos, esCobertizo, pesos, METODOS_PAGO, CATEGORIAS_GASTO } from '../store'

export default function FormGasto({ cerrar }) {
  const datos = useDatos()
  const negocio = datos.negocios.find((n) => n.id === datos.negocioActivo)
  // Compra de insumos (El Cobertizo): lo comprado se suma solo al inventario de insumos.
  const insumos = esCobertizo(negocio) ? datos.productos.filter((p) => p.negocioId === negocio.id && p.esInsumo) : []
  const [f, setF] = useState({ concepto: '', categoria: CATEGORIAS_GASTO[0], monto: '', metodo: METODOS_PAGO[0], insumoId: '', cantidad: '', actualizarCosto: true })
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const insumo = insumos.find((p) => p.id === f.insumoId)
  const cantidad = Number(f.cantidad) || 0
  const costoUnidad = insumo && cantidad > 0 ? Number(f.monto) / cantidad : 0
  const elegirInsumo = (e) => {
    const p = insumos.find((x) => x.id === e.target.value)
    setF({ ...f, insumoId: e.target.value, concepto: p ? `Compra de ${p.nombre}` : f.concepto, categoria: p ? 'Insumos' : f.categoria })
  }
  const enviar = async (e) => {
    e.preventDefault()
    try {
      await registrarGasto({ concepto: f.concepto, categoria: f.categoria, monto: Number(f.monto), metodo: f.metodo })
      if (insumo && cantidad > 0) {
        if (f.actualizarCosto && costoUnidad > 0) await guardarProducto({ ...insumo, costo: Math.round(costoUnidad * 100) / 100 })
        await ajustarStock(insumo.id, cantidad)
      }
      cerrar()
    } catch { /* el error se muestra arriba */ }
  }
  return (
    <div className="modal-fondo" onClick={cerrar}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
        <h2>Registrar gasto</h2>
        {insumos.length > 0 && (
          <div className="compra-insumo">
            <label className="etiqueta-campo">¿Es compra de un insumo? (opcional)</label>
            <select className="campo" value={f.insumoId} onChange={elegirInsumo}>
              <option value="">No, es otro gasto</option>
              {insumos.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.unidad})</option>)}
            </select>
            {insumo && (
              <>
                <label className="etiqueta-campo">¿Cuánto compraste? (en {insumo.unidad})</label>
                <input className="campo" required type="number" min="0" step="any" inputMode="decimal" placeholder={insumo.unidad === 'g' ? 'Ej: 2000' : ''} value={f.cantidad} onChange={cambiar('cantidad')} />
                {cantidad > 0 && (
                  <p className="sub">Se suman {cantidad.toLocaleString('es-CO')} {insumo.unidad} a {insumo.nombre} (ahora tiene {insumo.stock.toLocaleString('es-CO')}).</p>
                )}
                {costoUnidad > 0 && (
                  <label className="casilla">
                    <input type="checkbox" checked={f.actualizarCosto} onChange={(e) => setF({ ...f, actualizarCosto: e.target.checked })} />
                    Actualizar costo a {pesos(costoUnidad)} por {insumo.unidad}
                  </label>
                )}
              </>
            )}
          </div>
        )}
        <label className="etiqueta-campo">Concepto</label>
        <input className="campo" required autoFocus placeholder="Ej: compra de pan" value={f.concepto} onChange={cambiar('concepto')} />
        <label className="etiqueta-campo">Valor</label>
        <input className="campo" required type="number" min="1" inputMode="numeric" value={f.monto} onChange={cambiar('monto')} />
        <label className="etiqueta-campo">Categoría</label>
        <select className="campo" value={f.categoria} onChange={cambiar('categoria')}>
          {CATEGORIAS_GASTO.map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="etiqueta-campo">Pagado con</label>
        <select className="campo" value={f.metodo} onChange={cambiar('metodo')}>
          {METODOS_PAGO.map((m) => <option key={m}>{m}</option>)}
        </select>
        <div className="acciones">
          <button type="button" className="btn" onClick={cerrar}>Cancelar</button>
          <button className="btn primario">Guardar</button>
        </div>
      </form>
    </div>
  )
}
