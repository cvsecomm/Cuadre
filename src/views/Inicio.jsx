import { pesos, esHoy, sumarPorMetodo } from '../store'

export default function Inicio({ datos, negocio, irA }) {
  const ventas = datos.ventas.filter((v) => v.negocioId === negocio.id)
  const gastos = datos.gastos.filter((g) => g.negocioId === negocio.id)
  const productos = datos.productos.filter((p) => p.negocioId === negocio.id)

  const ventasHoy = ventas.filter((v) => esHoy(v.fecha))
  const gastosHoy = gastos.filter((g) => esHoy(g.fecha))
  const ingresos = ventasHoy.reduce((s, v) => s + v.total, 0)
  const egresos = gastosHoy.reduce((s, g) => s + g.monto, 0)
  const costo = ventasHoy.reduce((s, v) => s + v.costo, 0)
  const bajos = productos.filter((p) => p.stock <= p.minimo)

  // Ventas de los últimos 7 días para la gráfica
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i))
    const total = ventas.filter((v) => new Date(v.fecha).toDateString() === d.toDateString()).reduce((s, v) => s + v.total, 0)
    return { etiqueta: d.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', ''), total, hoy: i === 6 }
  })
  const maximo = Math.max(...dias.map((d) => d.total), 1)

  const porMetodo = sumarPorMetodo(ventasHoy)

  return (
    <>
      <header className="titulo">
        <div>
          <h1>Resumen de {negocio.nombre.toLowerCase()}</h1>
          <p className="sub">{new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button className="btn primario ocultar-movil" onClick={() => irA('vender')}>Nueva venta</button>
      </header>

      <section className="tarjetas">
        <div className="tarjeta t-verde"><span>Ventas de hoy</span><strong>{pesos(ingresos)}</strong><small>{ventasHoy.length} ventas</small></div>
        <div className="tarjeta t-rojo"><span>Gastos de hoy</span><strong>{pesos(egresos)}</strong><small>{gastosHoy.length} gastos</small></div>
        <div className="tarjeta t-azul"><span>Balance de hoy</span><strong>{pesos(ingresos - egresos)}</strong><small>ingresos menos gastos</small></div>
        <div className="tarjeta t-ambar"><span>Ganancia en ventas</span><strong>{pesos(ingresos - costo)}</strong><small>precio menos costo</small></div>
      </section>

      <section className="panel">
        <h2>Ventas de los últimos 7 días</h2>
        <div className="grafica" role="img" aria-label="Ventas por día de la última semana">
          {dias.map((d) => (
            <div className="barra-dia" key={d.etiqueta + d.hoy}>
              <span className="valor">{d.total > 0 ? pesos(d.total) : ''}</span>
              <span className={'barra' + (d.hoy ? ' hoy' : '')} style={{ height: `${(d.total / maximo) * 100}%` }} />
              <span className="dia">{d.hoy ? 'Hoy' : d.etiqueta}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="dos-columnas">
        <section className="panel">
          <h2>Dinero por método de pago</h2>
          {Object.keys(porMetodo).length === 0
            ? <p className="vacio">Aún no hay ventas hoy.</p>
            : Object.entries(porMetodo).map(([m, t]) => (
              <div className="fila" key={m}><span>{m}</span><strong>{pesos(t)}</strong></div>
            ))}
        </section>
        <section className="panel">
          <h2>Stock bajo</h2>
          {bajos.length === 0
            ? <p className="vacio">Todo el inventario está bien.</p>
            : bajos.map((p) => (
              <div className="fila" key={p.id}><span>{p.nombre}</span><span className="etiqueta alerta">{p.stock} und</span></div>
            ))}
          {bajos.length > 0 && <button className="btn enlace" onClick={() => irA('inventario')}>Ir al inventario</button>}
        </section>
      </div>
    </>
  )
}
