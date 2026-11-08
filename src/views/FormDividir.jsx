import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { pesos } from '../store'

// Dividir la cuenta: se escogen los productos que pasan a una cuenta nueva
// (ej. cada persona de la mesa paga lo suyo). Cada cuenta se cobra por separado.
export default function FormDividir({ lineas, cerrar, dividir }) {
  const [mover, setMover] = useState(() => lineas.map(() => 0))
  const cambiar = (i, n) => setMover(mover.map((c, j) => (j === i ? Math.min(lineas[i].cantidad, Math.max(0, c + n)) : c)))
  const totalNueva = lineas.reduce((s, l, i) => s + l.precio * mover[i], 0)
  const totalQueda = lineas.reduce((s, l, i) => s + l.precio * (l.cantidad - mover[i]), 0)
  const quedaAlgo = lineas.some((l, i) => l.cantidad - mover[i] > 0)
  const moverAlgo = mover.some((c) => c > 0)

  return (
    <div className="modal-fondo" onClick={cerrar}>
      <div className="modal dividir" onClick={(e) => e.stopPropagation()}>
        <h2>Dividir cuenta</h2>
        <p className="sub">Escoge lo que va a pagar la otra persona. Eso pasa a una cuenta nueva y cada una se cobra aparte.</p>
        <div className="dividir-lista">
          {lineas.map((l, i) => (
            <div className="dividir-fila" key={i}>
              <div className="item-texto">
                <div>{l.nombre}</div>
                <small>{l.cantidad} en la cuenta · {pesos(l.precio)} c/u</small>
              </div>
              <div className="cantidad">
                <button onClick={() => cambiar(i, -1)} aria-label="Quitar uno"><Minus size={14} /></button>
                <span>{mover[i]}</span>
                <button onClick={() => cambiar(i, 1)} aria-label="Agregar uno"><Plus size={14} /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="dividir-totales">
          <div><small>Cuenta nueva</small><strong>{pesos(totalNueva)}</strong></div>
          <div><small>Queda en esta</small><strong>{pesos(totalQueda)}</strong></div>
        </div>
        {moverAlgo && !quedaAlgo && <p className="sub">Deja al menos un producto en esta cuenta.</p>}
        <div className="acciones">
          <button className="btn" onClick={cerrar}>Cancelar</button>
          <button className="btn primario" disabled={!moverAlgo || !quedaAlgo} onClick={() => dividir(mover)}>Pasar a cuenta nueva</button>
        </div>
      </div>
    </div>
  )
}
