import { useState } from 'react'
import { registrarGasto, METODOS_PAGO, CATEGORIAS_GASTO } from '../store'

export default function FormGasto({ cerrar }) {
  const [f, setF] = useState({ concepto: '', categoria: CATEGORIAS_GASTO[0], monto: '', metodo: METODOS_PAGO[0] })
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const enviar = async (e) => {
    e.preventDefault()
    try { await registrarGasto({ ...f, monto: Number(f.monto) }); cerrar() } catch { /* el error se muestra arriba */ }
  }
  return (
    <div className="modal-fondo" onClick={cerrar}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
        <h2>Registrar gasto</h2>
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
