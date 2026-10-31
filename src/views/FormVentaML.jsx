import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { pesos, registrarVenta } from '../store'
import ImagenProducto from './Imagen'

// Venta rápida de Mercado Libre: solo se escribe lo que llegó a la cuenta.
export default function FormVentaML({ producto: p, cerrar, listo }) {
  const [llego, setLlego] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [guardando, setGuardando] = useState(false)
  const monto = Number(llego)

  const enviar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      await registrarVenta({
        items: [{ productoId: p.id, nombre: p.nombre, precio: monto / cantidad, costo: p.costo, cantidad }],
        metodo: 'Mercado Libre',
      })
      listo(`Venta guardada: ${cantidad} × ${p.nombre} por ${pesos(monto)}`)
    } catch {
      setGuardando(false) // el error se muestra arriba de la pantalla
    }
  }

  return (
    <div className="modal-fondo" onClick={cerrar}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
        <h2>Venta Mercado Libre</h2>
        <div className="ml-producto">
          <ImagenProducto producto={p} className="mini" />
          <div>
            <strong>{p.nombre}</strong>
            <small>{p.stock} disponibles</small>
          </div>
          <div className="cantidad">
            <button type="button" onClick={() => setCantidad((c) => Math.max(1, c - 1))} aria-label="Quitar uno"><Minus size={14} /></button>
            <span>{cantidad}</span>
            <button type="button" onClick={() => setCantidad((c) => c + 1)} aria-label="Agregar uno"><Plus size={14} /></button>
          </div>
        </div>
        <label className="etiqueta-campo" htmlFor="llego">¿Cuánto te llegó?</label>
        <input id="llego" className="campo" required autoFocus type="number" min="1" inputMode="numeric" value={llego} onChange={(e) => setLlego(e.target.value)} />
        {monto > 0 && (
          <p className="ml-ganancia">Ganancia: <strong>{pesos(monto - p.costo * cantidad)}</strong></p>
        )}
        <div className="acciones">
          <button type="button" className="btn" onClick={cerrar}>Cancelar</button>
          <button className="btn primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  )
}
