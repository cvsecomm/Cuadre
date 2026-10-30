import { useState } from 'react'
import { pesos, registrarGasto, borrarGasto, anularVenta, METODOS_PAGO, CATEGORIAS_GASTO } from '../store'

const PERIODOS = { hoy: 'Hoy', semana: 'Últimos 7 días', mes: 'Este mes', todo: 'Todo' }

function enPeriodo(iso, periodo) {
  const f = new Date(iso), ahora = new Date()
  if (periodo === 'hoy') return f.toDateString() === ahora.toDateString()
  if (periodo === 'semana') return ahora - f <= 7 * 24 * 3600 * 1000
  if (periodo === 'mes') return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear()
  return true
}

export default function Movimientos({ datos, negocio }) {
  const [periodo, setPeriodo] = useState('hoy')
  const [tipo, setTipo] = useState('todos')
  const [nuevoGasto, setNuevoGasto] = useState(false)
  const [confirmando, setConfirmando] = useState(null)

  const ventas = datos.ventas.filter((v) => v.negocioId === negocio.id && enPeriodo(v.fecha, periodo))
  const gastos = datos.gastos.filter((g) => g.negocioId === negocio.id && enPeriodo(g.fecha, periodo))
  const ingresos = ventas.reduce((s, v) => s + v.total, 0)
  const egresos = gastos.reduce((s, g) => s + g.monto, 0)

  const lista = [
    ...(tipo !== 'gastos' ? ventas.map((v) => ({ ...v, clase: 'venta' })) : []),
    ...(tipo !== 'ventas' ? gastos.map((g) => ({ ...g, clase: 'gasto' })) : []),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha))

  return (
    <>
      <header className="titulo">
        <h1>Movimientos</h1>
        <button className="btn primario" onClick={() => setNuevoGasto(true)}>Registrar gasto</button>
      </header>

      <div className="chips">
        {Object.entries(PERIODOS).map(([k, n]) => (
          <button key={k} className={'chip' + (k === periodo ? ' activo' : '')} onClick={() => setPeriodo(k)}>{n}</button>
        ))}
      </div>

      <section className="tarjetas">
        <div className="tarjeta t-verde"><span>Ingresos</span><strong>{pesos(ingresos)}</strong></div>
        <div className="tarjeta t-rojo"><span>Gastos</span><strong>{pesos(egresos)}</strong></div>
        <div className="tarjeta t-azul"><span>Balance</span><strong>{pesos(ingresos - egresos)}</strong></div>
      </section>

      <section className="panel">
        <div className="chips">
          {['todos', 'ventas', 'gastos'].map((t) => (
            <button key={t} className={'chip' + (t === tipo ? ' activo' : '')} onClick={() => setTipo(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
          ))}
        </div>
        {confirmando && lista.some((m) => m.id === confirmando && m.clase === 'venta') && (
          <p className="aviso">Al anular una venta, los productos vuelven al inventario.</p>
        )}
        {lista.length === 0 && <p className="vacio">No hay movimientos en este periodo.</p>}
        {lista.map((m) => (
          <div className="movimiento" key={m.id}>
            <span className={'punto ' + m.clase} />
            <div className="detalle">
              <div>{m.clase === 'venta' ? `Venta #${m.numero}` : m.concepto}</div>
              <small>
                {new Date(m.fecha).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })} · {m.metodo}
                {m.clase === 'venta' ? ` · ${m.items.map((i) => `${i.cantidad} ${i.nombre}`).join(', ')}` : ` · ${m.categoria}`}
              </small>
            </div>
            <strong className={m.clase === 'venta' ? 'verde' : 'rojo'}>
              {m.clase === 'venta' ? '+' : '−'}{pesos(m.clase === 'venta' ? m.total : m.monto)}
            </strong>
            {confirmando === m.id ? (
              <span className="confirmar">
                <button className="btn enlace" onClick={() => setConfirmando(null)}>No</button>
                <button
                  className="btn peligro"
                  onClick={() => { (m.clase === 'venta' ? anularVenta : borrarGasto)(m.id); setConfirmando(null) }}
                >{m.clase === 'venta' ? 'Sí, anular' : 'Sí, borrar'}</button>
              </span>
            ) : (
              <button className="btn enlace peligro" onClick={() => setConfirmando(m.id)}>
                {m.clase === 'venta' ? 'Anular' : 'Borrar'}
              </button>
            )}
          </div>
        ))}
      </section>

      {nuevoGasto && <FormGasto cerrar={() => setNuevoGasto(false)} />}
    </>
  )
}

function FormGasto({ cerrar }) {
  const [f, setF] = useState({ concepto: '', categoria: CATEGORIAS_GASTO[0], monto: '', metodo: METODOS_PAGO[0] })
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const enviar = (e) => {
    e.preventDefault()
    registrarGasto({ ...f, monto: Number(f.monto) })
    cerrar()
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
