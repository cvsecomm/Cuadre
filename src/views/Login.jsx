import { useState } from 'react'
import { iniciarSesion } from '../store'

export default function Login() {
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e) => {
    e.preventDefault()
    setEnviando(true); setError('')
    try { await iniciarSesion(email.trim(), clave) } catch (err) { setError(err.message) }
    setEnviando(false)
  }

  return (
    <div className="pantalla-centro">
      <form className="caja-login" onSubmit={enviar}>
        <div className="marca">Cuadre</div>
        <h1>Inicia sesión</h1>
        <p className="sub">Entra con el correo y la contraseña que te dio el dueño del negocio.</p>
        <label className="etiqueta-campo" htmlFor="email">Correo</label>
        <input id="email" className="campo" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="etiqueta-campo" htmlFor="clave">Contraseña</label>
        <input id="clave" className="campo" type="password" autoComplete="current-password" required value={clave} onChange={(e) => setClave(e.target.value)} />
        {error && <p className="aviso error">{error}</p>}
        <button className="btn primario grande" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  )
}
