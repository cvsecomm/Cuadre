import { useState } from 'react'
import { pesos, guardarEmpleado, registrarTurno, borrarTurno, pagarNomina, METODOS_PAGO } from '../store'

const hoyISO = () => new Date().toLocaleDateString('en-CA') // aaaa-mm-dd

// Quincenas: del 1 al 15 y del 16 al último día del mes.
function rango(periodo) {
  const h = new Date(); const a = h.getFullYear(); const m = h.getMonth()
  const iso = (d) => d.toLocaleDateString('en-CA')
  if (periodo === 'mes') return [iso(new Date(a, m, 1)), iso(new Date(a, m + 1, 0))]
  const primera = h.getDate() <= 15
  if (periodo === 'quincena') return primera ? [iso(new Date(a, m, 1)), iso(new Date(a, m, 15))] : [iso(new Date(a, m, 16)), iso(new Date(a, m + 1, 0))]
  // quincena pasada
  return primera ? [iso(new Date(a, m - 1, 16)), iso(new Date(a, m, 0))] : [iso(new Date(a, m, 1)), iso(new Date(a, m, 15))]
}
const PERIODOS = { quincena: 'Esta quincena', pasada: 'Quincena pasada', mes: 'Este mes' }

// Horas entre dos horas 'HH:MM' (si la salida es menor, pasó la medianoche).
function horasEntre(entrada, salida) {
  if (!entrada || !salida) return 0
  const min = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  let d = min(salida) - min(entrada)
  if (d <= 0) d += 24 * 60
  return Math.round((d / 60) * 100) / 100
}
const fechaCorta = (iso) => new Date(iso + 'T12:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })

export default function Nomina({ datos, negocio }) {
  const empleados = datos.empleados.filter((e) => e.negocioId === negocio.id)
  const activos = empleados.filter((e) => e.activo)
  const [periodo, setPeriodo] = useState('quincena')
  const [desde, hasta] = rango(periodo)
  const turnos = datos.turnos.filter((t) => t.negocioId === negocio.id && t.fecha >= desde && t.fecha <= hasta)

  const [editando, setEditando] = useState(null) // empleado en el formulario
  const [pagando, setPagando] = useState(null) // { empleado, turnos, total }
  const [borrar, setBorrar] = useState(null)

  // Formulario de horas
  const [f, setF] = useState({ empleadoId: '', fecha: hoyISO(), entrada: '', salida: '', horas: '', nota: '' })
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const calculadas = horasEntre(f.entrada, f.salida)
  const horas = calculadas || Number(f.horas) || 0
  const empleadoForm = activos.find((e) => e.id === f.empleadoId) ?? activos[0]
  const [guardando, setGuardando] = useState(false)
  const guardarHoras = async (e) => {
    e.preventDefault()
    if (!empleadoForm || horas <= 0) return
    setGuardando(true)
    try {
      await registrarTurno({ empleadoId: empleadoForm.id, fecha: f.fecha, entrada: f.entrada, salida: f.salida, horas, valorHora: empleadoForm.valorHora, nota: f.nota.trim() })
      setF({ ...f, entrada: '', salida: '', horas: '', nota: '' })
    } catch { /* el error se muestra arriba */ }
    setGuardando(false)
  }

  const resumen = empleados.map((emp) => {
    const suyos = turnos.filter((t) => t.empleadoId === emp.id)
    const pendientes = suyos.filter((t) => !t.pagado)
    return {
      emp, suyos, pendientes,
      horas: suyos.reduce((s, t) => s + t.horas, 0),
      porPagar: pendientes.reduce((s, t) => s + t.horas * t.valorHora, 0),
      pagado: suyos.filter((t) => t.pagado).reduce((s, t) => s + t.horas * t.valorHora, 0),
    }
  }).filter((r) => r.emp.activo || r.suyos.length > 0)
  const totalPorPagar = resumen.reduce((s, r) => s + r.porPagar, 0)
  const totalHoras = resumen.reduce((s, r) => s + r.horas, 0)
  const nombre = (id) => empleados.find((e) => e.id === id)?.nombre ?? '—'

  return (
    <>
      <header className="titulo">
        <div>
          <h1>Nómina</h1>
          <p className="sub">Horas trabajadas y pagos del equipo</p>
        </div>
        <button className="btn primario" onClick={() => setEditando({ nombre: '', cargo: '', valorHora: '', activo: true })}>Nuevo empleado</button>
      </header>

      <div className="chips">
        {Object.entries(PERIODOS).map(([k, n]) => (
          <button key={k} className={'chip' + (k === periodo ? ' activo' : '')} onClick={() => setPeriodo(k)}>{n}</button>
        ))}
      </div>
      <p className="sub">Del {fechaCorta(desde)} al {fechaCorta(hasta)}</p>

      <section className="tarjetas">
        <div className="tarjeta t-azul"><span>Horas trabajadas</span><strong>{totalHoras.toLocaleString('es-CO')}</strong><small>{activos.length} empleados activos</small></div>
        <div className="tarjeta t-rojo"><span>Por pagar</span><strong>{pesos(totalPorPagar)}</strong><small>horas sin pagar del periodo</small></div>
      </section>

      <div className="dos-columnas">
        <form className="panel" onSubmit={guardarHoras}>
          <h2>Registrar horas</h2>
          {activos.length === 0 ? (
            <p className="vacio">Primero agrega un empleado con el botón “Nuevo empleado”.</p>
          ) : (
            <>
              <label className="etiqueta-campo" htmlFor="emp">Empleado</label>
              <select id="emp" className="campo" value={empleadoForm?.id ?? ''} onChange={cambiar('empleadoId')}>
                {activos.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
              <label className="etiqueta-campo" htmlFor="fecha-turno">Fecha</label>
              <input id="fecha-turno" className="campo" type="date" required max={hoyISO()} value={f.fecha} onChange={cambiar('fecha')} />
              <div className="dos-campos">
                <div>
                  <label className="etiqueta-campo" htmlFor="entrada">Entrada</label>
                  <input id="entrada" className="campo" type="time" value={f.entrada} onChange={cambiar('entrada')} />
                </div>
                <div>
                  <label className="etiqueta-campo" htmlFor="salida">Salida</label>
                  <input id="salida" className="campo" type="time" value={f.salida} onChange={cambiar('salida')} />
                </div>
              </div>
              {calculadas > 0
                ? <p className="aviso">{calculadas} horas · {pesos(calculadas * (empleadoForm?.valorHora || 0))}</p>
                : (
                  <>
                    <label className="etiqueta-campo" htmlFor="horas">O escribe las horas directamente</label>
                    <input id="horas" className="campo" type="number" min="0.25" max="24" step="0.25" inputMode="decimal" value={f.horas} onChange={cambiar('horas')} />
                  </>
                )}
              <label className="etiqueta-campo" htmlFor="nota-turno">Nota (opcional)</label>
              <input id="nota-turno" className="campo" placeholder="Ej: turno de noche" value={f.nota} onChange={cambiar('nota')} />
              <button className="btn primario grande" disabled={guardando || horas <= 0}>{guardando ? 'Guardando…' : 'Guardar horas'}</button>
            </>
          )}
        </form>

        <section className="panel">
          <h2>Resumen por empleado</h2>
          {resumen.length === 0 && <p className="vacio">Todavía no hay empleados.</p>}
          {resumen.map((r) => (
            <div className="nomina-empleado" key={r.emp.id}>
              <div className="nomina-cabeza">
                <div>
                  <strong>{r.emp.nombre}</strong>
                  <small>{r.emp.cargo ? `${r.emp.cargo} · ` : ''}{pesos(r.emp.valorHora)} la hora{!r.emp.activo && ' · inactivo'}</small>
                </div>
                <button className="btn enlace" onClick={() => setEditando({ ...r.emp })}>Editar</button>
              </div>
              <div className="fila"><span>Horas en el periodo</span><span>{r.horas.toLocaleString('es-CO')}</span></div>
              {r.pagado > 0 && <div className="fila"><span>Ya pagado</span><span>{pesos(r.pagado)}</span></div>}
              <div className="fila"><span>Por pagar</span><strong>{pesos(r.porPagar)}</strong></div>
              {r.porPagar > 0 && (
                <button className="btn" onClick={() => setPagando({ empleado: r.emp, turnos: r.pendientes, total: r.porPagar, metodo: METODOS_PAGO[0] })}>
                  Pagar {pesos(r.porPagar)}
                </button>
              )}
            </div>
          ))}
        </section>
      </div>

      <section className="panel cierres-lista">
        <h2>Horas registradas en el periodo</h2>
        {turnos.length === 0 && <p className="vacio">No hay horas registradas en este periodo.</p>}
        {turnos.map((t) => (
          <div className="fila cierre-fila" key={t.id}>
            <div>
              <strong>{nombre(t.empleadoId)} · {fechaCorta(t.fecha)}</strong>
              <small>{t.entrada && t.salida ? `${t.entrada} a ${t.salida} · ` : ''}{t.horas} h · {pesos(t.horas * t.valorHora)}{t.nota && ` · ${t.nota}`}</small>
            </div>
            <span className={'etiqueta' + (t.pagado ? '' : ' alerta')}>{t.pagado ? 'Pagado' : 'Pendiente'}</span>
            {!t.pagado && (borrar === t.id
              ? <button className="btn enlace rojo" onClick={() => { borrarTurno(t.id).catch(() => {}); setBorrar(null) }}>¿Borrar? Sí</button>
              : <button className="btn enlace" onClick={() => setBorrar(t.id)}>Borrar</button>)}
          </div>
        ))}
      </section>

      {editando && <FormEmpleado inicial={editando} cerrar={() => setEditando(null)} />}

      {pagando && (
        <div className="modal-fondo" onClick={() => setPagando(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Pagar a {pagando.empleado.nombre}</h2>
            <p className="sub">{pagando.turnos.reduce((s, t) => s + t.horas, 0)} horas pendientes de este periodo. Se guarda como gasto de <strong>Nómina</strong>.</p>
            <div className="total-pagar"><small>Total a pagar</small><strong>{pesos(pagando.total)}</strong></div>
            <label className="etiqueta-campo">Pagado con</label>
            <select className="campo" value={pagando.metodo} onChange={(e) => setPagando({ ...pagando, metodo: e.target.value })}>
              {METODOS_PAGO.map((m) => <option key={m}>{m}</option>)}
            </select>
            <div className="acciones">
              <button className="btn" onClick={() => setPagando(null)}>Cancelar</button>
              <button className="btn primario" onClick={async () => {
                try { await pagarNomina(pagando.empleado.id, pagando.turnos.map((t) => t.id), pagando.metodo); setPagando(null) } catch { /* error arriba */ }
              }}>Confirmar pago</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function FormEmpleado({ inicial, cerrar }) {
  const [e, setE] = useState(inicial)
  const cambiar = (k) => (ev) => setE({ ...e, [k]: ev.target.value })
  const enviar = async (ev) => {
    ev.preventDefault()
    try { await guardarEmpleado({ ...e, nombre: e.nombre.trim(), cargo: e.cargo.trim(), valorHora: Number(e.valorHora) || 0 }); cerrar() } catch { /* error arriba */ }
  }
  return (
    <div className="modal-fondo" onClick={cerrar}>
      <form className="modal" onClick={(ev) => ev.stopPropagation()} onSubmit={enviar}>
        <h2>{inicial.id ? 'Editar empleado' : 'Nuevo empleado'}</h2>
        <label className="etiqueta-campo">Nombre</label>
        <input className="campo" required autoFocus value={e.nombre} onChange={cambiar('nombre')} />
        <label className="etiqueta-campo">Cargo (opcional)</label>
        <input className="campo" placeholder="Ej: cocinero, mesero" value={e.cargo} onChange={cambiar('cargo')} />
        <label className="etiqueta-campo">Valor de la hora</label>
        <input className="campo" required type="number" min="0" inputMode="numeric" value={e.valorHora} onChange={cambiar('valorHora')} />
        {inicial.id && (
          <label className="casilla">
            <input type="checkbox" checked={e.activo} onChange={(ev) => setE({ ...e, activo: ev.target.checked })} /> Sigue trabajando aquí
          </label>
        )}
        <div className="acciones">
          <button type="button" className="btn" onClick={cerrar}>Cancelar</button>
          <button className="btn primario">Guardar</button>
        </div>
      </form>
    </div>
  )
}
