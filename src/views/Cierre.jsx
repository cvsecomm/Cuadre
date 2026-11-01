import { useState } from 'react'
import { Printer } from 'lucide-react'
import { pesos, registrarCierre, borrarCierre } from '../store'

const fechaHora = (iso) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })

// Cierre de caja: suma lo vendido desde el último cierre (o desde hoy a las 00:00 si nunca se ha cerrado)
// y compara el efectivo que debería haber con el que se contó.
export default function Cierre({ datos, negocio, esDueno }) {
  const cierres = datos.cierres.filter((c) => c.negocioId === negocio.id)
  const ultimo = cierres[0]
  const inicioHoy = new Date(); inicioHoy.setHours(0, 0, 0, 0)
  const desde = ultimo ? new Date(ultimo.fecha) : inicioHoy

  const ventas = datos.ventas.filter((v) => v.negocioId === negocio.id && new Date(v.fecha) > desde)
  const gastos = datos.gastos.filter((g) => g.negocioId === negocio.id && new Date(g.fecha) > desde)
  const porMetodo = {}
  ventas.forEach((v) => { porMetodo[v.metodo] = (porMetodo[v.metodo] || 0) + v.total })
  const totalVentas = ventas.reduce((s, v) => s + v.total, 0)
  const gastosEfectivo = gastos.filter((g) => g.metodo === 'Efectivo').reduce((s, g) => s + g.monto, 0)
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0)

  const [base, setBase] = useState('')
  const [contado, setContado] = useState('')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [imprimir, setImprimir] = useState(null) // cierre que se muestra para imprimir
  const [borrar, setBorrar] = useState(null)

  const esperado = (Number(base) || 0) + (porMetodo.Efectivo || 0) - gastosEfectivo
  const diferencia = (Number(contado) || 0) - esperado

  const cerrar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    const cierre = {
      desde: desde.toISOString(), base: Number(base) || 0, ventas: totalVentas, gastos: totalGastos,
      esperado, contado: Number(contado) || 0, porMetodo, numVentas: ventas.length, nota: nota.trim(),
    }
    try {
      await registrarCierre(cierre)
      setImprimir({ ...cierre, fecha: new Date().toISOString() })
      setBase(''); setContado(''); setNota('')
    } catch { /* el error se muestra arriba */ }
    setGuardando(false)
  }

  return (
    <>
      <header className="titulo">
        <div>
          <h1>Cierre de caja</h1>
          <p className="sub">Ventas desde {ultimo ? `el último cierre (${fechaHora(ultimo.fecha)})` : 'hoy a las 12:00 a. m.'}</p>
        </div>
      </header>

      <section className="tarjetas">
        <div className="tarjeta t-verde"><span>Vendido</span><strong>{pesos(totalVentas)}</strong><small>{ventas.length} ventas</small></div>
        <div className="tarjeta t-rojo"><span>Gastos</span><strong>{pesos(totalGastos)}</strong><small>{pesos(gastosEfectivo)} en efectivo</small></div>
      </section>

      <div className="dos-columnas">
        <section className="panel">
          <h2>Dinero por método de pago</h2>
          {Object.keys(porMetodo).length === 0
            ? <p className="vacio">No hay ventas desde el último cierre.</p>
            : Object.entries(porMetodo).map(([m, t]) => (
              <div className="fila" key={m}><span>{m}</span><strong>{pesos(t)}</strong></div>
            ))}
        </section>

        <form className="panel cierre-form" onSubmit={cerrar}>
          <h2>Cuadrar el efectivo</h2>
          <label className="etiqueta-campo" htmlFor="base">Base con la que abrió la caja</label>
          <input id="base" className="campo" type="number" min="0" inputMode="numeric" placeholder="0" value={base} onChange={(e) => setBase(e.target.value)} />
          <div className="fila"><span>+ Ventas en efectivo</span><span>{pesos(porMetodo.Efectivo || 0)}</span></div>
          <div className="fila"><span>− Gastos pagados en efectivo</span><span>{pesos(gastosEfectivo)}</span></div>
          <div className="fila total"><span>Debe haber en caja</span><strong>{pesos(esperado)}</strong></div>
          <label className="etiqueta-campo" htmlFor="contado">¿Cuánto efectivo contaste?</label>
          <input id="contado" className="campo" type="number" min="0" inputMode="numeric" required value={contado} onChange={(e) => setContado(e.target.value)} />
          {contado !== '' && (
            <div className={'cambio' + (diferencia < 0 ? ' falta' : '')}>
              <span>{diferencia === 0 ? 'Cuadra exacto' : diferencia < 0 ? 'Falta' : 'Sobra'}</span><strong>{pesos(Math.abs(diferencia))}</strong>
            </div>
          )}
          <label className="etiqueta-campo" htmlFor="nota">Nota (opcional)</label>
          <input id="nota" className="campo" placeholder="Ej: se pagó un domicilio con la caja" value={nota} onChange={(e) => setNota(e.target.value)} />
          <button className="btn primario grande" disabled={guardando}>{guardando ? 'Guardando…' : 'Cerrar caja'}</button>
        </form>
      </div>

      <section className="panel cierres-lista">
        <h2>Cierres anteriores</h2>
        {cierres.length === 0 && <p className="vacio">Todavía no has hecho ningún cierre.</p>}
        {cierres.map((c) => {
          const dif = c.contado - c.esperado
          return (
            <div className="fila cierre-fila" key={c.id}>
              <div>
                <strong>{fechaHora(c.fecha)}</strong>
                <small>{c.numVentas} ventas · {pesos(c.ventas)}</small>
              </div>
              <span className={'etiqueta' + (dif < 0 ? ' alerta' : '')}>{dif === 0 ? 'Cuadró' : `${dif < 0 ? 'Faltó' : 'Sobró'} ${pesos(Math.abs(dif))}`}</span>
              <span className="cierre-acciones">
                <button className="btn enlace" onClick={() => setImprimir(c)}>Ver</button>
                {esDueno && (borrar === c.id
                  ? <button className="btn enlace rojo" onClick={() => { borrarCierre(c.id).catch(() => {}); setBorrar(null) }}>¿Borrar? Sí</button>
                  : <button className="btn enlace" onClick={() => setBorrar(c.id)}>Borrar</button>)}
              </span>
            </div>
          )
        })}
      </section>

      {imprimir && (
        <div className="modal-fondo" onClick={() => setImprimir(null)}>
          <div className="modal recibo" onClick={(e) => e.stopPropagation()}>
            <div className="recibo-negocio">
              <strong>{negocio.nombre}</strong>
              <span>CIERRE DE CAJA</span>
              <span>{fechaHora(imprimir.desde)} a {fechaHora(imprimir.fecha)}</span>
            </div>
            <hr />
            {Object.entries(imprimir.porMetodo).map(([m, t]) => (
              <div className="fila" key={m}><span>{m}</span><span>{pesos(t)}</span></div>
            ))}
            <div className="fila total"><span>Total vendido</span><strong>{pesos(imprimir.ventas)}</strong></div>
            <div className="fila"><span>Ventas</span><span>{imprimir.numVentas}</span></div>
            <div className="fila"><span>Gastos</span><span>{pesos(imprimir.gastos)}</span></div>
            <hr />
            <div className="fila"><span>Base</span><span>{pesos(imprimir.base)}</span></div>
            <div className="fila"><span>Efectivo esperado</span><span>{pesos(imprimir.esperado)}</span></div>
            <div className="fila"><span>Efectivo contado</span><span>{pesos(imprimir.contado)}</span></div>
            <div className="fila total">
              <span>{imprimir.contado - imprimir.esperado < 0 ? 'Faltante' : 'Sobrante'}</span>
              <strong>{pesos(Math.abs(imprimir.contado - imprimir.esperado))}</strong>
            </div>
            {imprimir.nota && <p className="recibo-cliente">Nota: {imprimir.nota}</p>}
            <div className="acciones no-imprimir">
              <button className="btn" onClick={() => window.print()}><Printer size={16} /> Imprimir</button>
              <button className="btn primario" onClick={() => setImprimir(null)}>Listo</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
