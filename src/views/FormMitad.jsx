import { useState } from 'react'
import { Search } from 'lucide-react'
import { pesos } from '../store'
import ImagenProducto from './Imagen'

// Pizza mitad y mitad: se eligen dos sabores y se cobra el precio del más caro.
export default function FormMitad({ productos, cerrar, agregar }) {
  const [buscar, setBuscar] = useState('')
  const [primera, setPrimera] = useState(null)
  const lista = productos.filter((p) => p.nombre.toLowerCase().includes(buscar.toLowerCase()))

  const elegir = (p) => {
    if (!primera) { setPrimera(p); setBuscar(''); return }
    agregar(primera, p)
  }

  return (
    <div className="modal-fondo" onClick={cerrar}>
      <div className="modal mitad" onClick={(e) => e.stopPropagation()}>
        <h2>Mitad y mitad</h2>
        <p className="sub">
          {primera
            ? <>Primera mitad: <strong>{primera.nombre}</strong>. Ahora elige la <strong>segunda mitad</strong>.</>
            : <>Elige la <strong>primera mitad</strong>. Se cobra el precio del sabor más caro.</>}
        </p>
        <label className="buscador">
          <Search size={17} />
          <input placeholder="Buscar sabor" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        </label>
        <div className="mitad-lista">
          {lista.map((p) => (
            <button key={p.id} className={'mitad-opcion' + (primera?.id === p.id ? ' elegida' : '')} onClick={() => elegir(p)}>
              <ImagenProducto producto={p} className="mini" />
              <span>{p.nombre}</span>
              <strong>{pesos(p.precio)}</strong>
            </button>
          ))}
          {lista.length === 0 && <p className="vacio">No hay productos con ese nombre.</p>}
        </div>
        <div className="acciones">
          {primera && <button className="btn" onClick={() => setPrimera(null)}>Cambiar primera mitad</button>}
          <button className="btn" onClick={cerrar}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
