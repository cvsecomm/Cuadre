import { useState } from 'react'
import { crearNegocio } from '../store'

const TIPOS = [
  { id: 'restaurante', nombre: 'Restaurante o comidas' },
  { id: 'ecommerce', nombre: 'Tienda online' },
  { id: 'tienda', nombre: 'Tienda física' },
  { id: 'general', nombre: 'Otro' },
]

// Formulario para crear un negocio. Si `cerrar` no viene, se muestra a pantalla completa (primer negocio).
export default function FormNegocio({ cerrar }) {
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState(TIPOS[0].id)
  const [error, setError] = useState('')

  const enviar = async (e) => {
    e.preventDefault()
    try { await crearNegocio({ nombre: nombre.trim(), tipo }); cerrar?.() } catch (err) { setError(err.message) }
  }

  const formulario = (
    <form className={cerrar ? 'modal' : 'caja-login'} onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
      {!cerrar && <div className="marca">Cuadre</div>}
      <h2>{cerrar ? 'Nuevo negocio' : 'Crea tu primer negocio'}</h2>
      {!cerrar && <p className="sub">Luego podrás agregar más negocios e invitar a tu equipo.</p>}
      <label className="etiqueta-campo" htmlFor="nombre-negocio">Nombre del negocio</label>
      <input id="nombre-negocio" className="campo" required autoFocus placeholder="Ej: Burger Camilo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <label className="etiqueta-campo">Tipo</label>
      <div className="metodos">
        {TIPOS.map((t) => (
          <button type="button" key={t.id} className={t.id === tipo ? 'activo' : ''} onClick={() => setTipo(t.id)}>{t.nombre}</button>
        ))}
      </div>
      {error && <p className="aviso error">{error}</p>}
      <div className="acciones">
        {cerrar && <button type="button" className="btn" onClick={cerrar}>Cancelar</button>}
        <button className={'btn primario' + (cerrar ? '' : ' grande')}>Crear negocio</button>
      </div>
    </form>
  )
  return cerrar
    ? <div className="modal-fondo" onClick={cerrar}>{formulario}</div>
    : <div className="pantalla-centro">{formulario}</div>
}
