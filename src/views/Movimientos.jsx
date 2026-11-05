import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { pesos, borrarGasto, anularVenta, movimientosEntre, esCobertizo } from '../store'
import FormGasto from './FormGasto'

const PERIODOS = { hoy: 'Hoy', semana: 'Últimos 7 días', mes: 'Este mes', todo: 'Todo' }

function enPeriodo(iso, periodo) {
  const f = new Date(iso), ahora = new Date()
  if (periodo === 'hoy') return f.toDateString() === ahora.toDateString()
  if (periodo === 'semana') return ahora - f <= 7 * 24 * 3600 * 1000
  if (periodo === 'mes') return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear()
  return true
}

export default function Movimientos({ datos, negocio, esDueno }) {
  const [periodo, setPeriodo] = useState('hoy')
  const [tipo, setTipo] = useState('todos')
  const [nuevoGasto, setNuevoGasto] = useState(false)
  const [confirmando, setConfirmando] = useState(null)
  // Calendario: muestra un rango de fechas exacto (se trae de la base de datos, así sea de hace meses).
  const conCalendario = esCobertizo(negocio)
  const [dia, setDia] = useState('') // desde, 'aaaa-mm-dd'
  const [hasta, setHasta] = useState('') // si está vacío, solo el día "desde"
  const [delDia, setDelDia] = useState(null) // { ventas, gastos } o null mientras carga
  const [errorDia, setErrorDia] = useState('')
  useEffect(() => {
    if (periodo !== 'fecha' || !dia) return
    let vigente = true
    const fecha = (iso, extra = 0) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d + extra) }
    const fin = hasta && hasta >= dia ? hasta : dia
    setDelDia(null); setErrorDia('')
    movimientosEntre(fecha(dia), fecha(fin, 1))
      .then((r) => { if (vigente) setDelDia(r) })
      .catch(() => { if (vigente) setErrorDia('No se pudieron cargar los movimientos de ese día.') })
    return () => { vigente = false }
  }, [periodo, dia, hasta, datos.ventas, datos.gastos])

  const porFecha = periodo === 'fecha'
  const ventas = porFecha ? (delDia?.ventas ?? []) : datos.ventas.filter((v) => v.negocioId === negocio.id && enPeriodo(v.fecha, periodo))
  const gastos = porFecha ? (delDia?.gastos ?? []) : datos.gastos.filter((g) => g.negocioId === negocio.id && enPeriodo(g.fecha, periodo))
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
        {conCalendario && (
          <span className={'chip chip-fecha' + (porFecha ? ' activo' : '')}>
            <CalendarDays size={15} />
            <span>Del</span>
            <input type="date" value={dia} aria-label="Desde"
              onChange={(e) => { setDia(e.target.value); if (e.target.value) setPeriodo('fecha') }} />
            <span>al</span>
            <input type="date" value={hasta} min={dia || undefined} aria-label="Hasta"
              onChange={(e) => { setHasta(e.target.value); if (dia) setPeriodo('fecha') }} />
          </span>
        )}
      </div>
      {porFecha && dia && !delDia && !errorDia && <p className="sub">Cargando…</p>}
      {errorDia && <p className="aviso error">{errorDia}</p>}

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
        {lista.length === 0 && <p className="vacio">{porFecha && !dia ? 'Elige las fechas en el calendario.' : 'No hay movimientos en este periodo.'}</p>}
        {lista.map((m) => (
          <div className="movimiento" key={m.id}>
            <span className={'punto ' + m.clase} />
            <div className="detalle">
              <div>{m.clase === 'venta' ? `${m.metodo === 'Consumo interno' ? 'Consumo interno' : 'Venta'} #${m.numero}${m.cliente ? ` · ${m.cliente}` : ''}` : m.concepto}</div>
              <small>
                {new Date(m.fecha).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })} · {m.metodo}
                {m.clase === 'venta' ? ` · ${m.items.map((i) => `${i.cantidad} ${i.nombre}`).join(', ')}` : ` · ${m.categoria}`}
              </small>
            </div>
            {m.clase === 'venta' && m.metodo === 'Consumo interno' ? (
              <strong className="suave">Costo {pesos(m.costo)}</strong>
            ) : (
              <strong className={m.clase === 'venta' ? 'verde' : 'rojo'}>
                {m.clase === 'venta' ? '+' : '−'}{pesos(m.clase === 'venta' ? m.total : m.monto)}
              </strong>
            )}
            {!esDueno ? null : confirmando === m.id ? (
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
