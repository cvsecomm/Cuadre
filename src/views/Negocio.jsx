import { useState } from 'react'
import { guardarNegocio } from '../store'

// Datos que salen en el encabezado del recibo impreso.
export default function Negocio({ negocio }) {
  const [f, setF] = useState({
    nombre: negocio.nombre, nit: negocio.nit || '', direccion: negocio.direccion || '', telefono: negocio.telefono || '',
  })
  const [guardado, setGuardado] = useState(false)
  const cambiar = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setGuardado(false) }

  const enviar = async (e) => {
    e.preventDefault()
    try {
      await guardarNegocio({ nombre: f.nombre.trim(), nit: f.nit.trim(), direccion: f.direccion.trim(), telefono: f.telefono.trim() })
      setGuardado(true)
    } catch { /* el error se muestra arriba */ }
  }

  return (
    <>
      <header className="titulo">
        <div>
          <h1>Datos del negocio</h1>
          <p className="sub">Así aparecen en el encabezado de tus recibos.</p>
        </div>
      </header>
      <div className="dos-columnas">
        <form className="panel" onSubmit={enviar}>
          <label className="etiqueta-campo" htmlFor="neg-nombre">Nombre</label>
          <input id="neg-nombre" className="campo" required value={f.nombre} onChange={cambiar('nombre')} />
          <label className="etiqueta-campo" htmlFor="neg-nit">NIT</label>
          <input id="neg-nit" className="campo" placeholder="Ej: 900123456-7" value={f.nit} onChange={cambiar('nit')} />
          <label className="etiqueta-campo" htmlFor="neg-dir">Dirección</label>
          <input id="neg-dir" className="campo" placeholder="Ej: Calle 10 # 20-30, Bogotá" value={f.direccion} onChange={cambiar('direccion')} />
          <label className="etiqueta-campo" htmlFor="neg-tel">Teléfono</label>
          <input id="neg-tel" className="campo" inputMode="tel" value={f.telefono} onChange={cambiar('telefono')} />
          <div className="acciones">
            {guardado && <span className="verde guardado">Guardado ✓</span>}
            <button className="btn primario">Guardar</button>
          </div>
        </form>
        <section className="panel">
          <h2>Vista previa del recibo</h2>
          <div className="recibo-negocio muestra">
            <strong>{f.nombre || 'Nombre del negocio'}</strong>
            {f.nit && <span>NIT {f.nit}</span>}
            {f.direccion && <span>{f.direccion}</span>}
            {f.telefono && <span>Tel. {f.telefono}</span>}
            <span>Recibo #1 · {new Date().toLocaleDateString('es-CO')}</span>
          </div>
          <p className="sub nota">Esto es un recibo de venta. No reemplaza la factura electrónica de la DIAN.</p>
        </section>
      </div>
    </>
  )
}
