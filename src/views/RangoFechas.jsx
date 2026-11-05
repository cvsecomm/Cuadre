import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const iso = (d) => d.toLocaleDateString('en-CA') // aaaa-mm-dd
const deIso = (s) => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d) }
const corta = (s) => deIso(s).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '')

// Selector de rango de fechas con dos meses: primer toque = desde, segundo = hasta.
export default function RangoFechas({ desde, hasta, activo, aplicar }) {
  const [abierto, setAbierto] = useState(false)
  const [mes, setMes] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - 1, 1) })
  const [a, setA] = useState(desde)
  const [b, setB] = useState(hasta)
  const [encima, setEncima] = useState(null)
  const hoy = iso(new Date())

  const abrir = () => {
    setA(desde); setB(hasta); setEncima(null)
    const base = desde ? deIso(desde) : new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
    setMes(new Date(base.getFullYear(), base.getMonth(), 1))
    setAbierto(true)
  }
  const tocar = (d) => {
    if (!a || b) { setA(d); setB(''); return }
    if (d < a) { setA(d); return }
    setB(d)
  }
  const fin = b || (a && encima && encima > a ? encima : '')

  const meses = [mes, new Date(mes.getFullYear(), mes.getMonth() + 1, 1)]
  const texto = desde ? (hasta && hasta !== desde ? `${corta(desde)} – ${corta(hasta)}` : corta(desde)) : 'Elegir fechas'

  return (
    <div className="rango">
      <button type="button" className={'chip chip-fecha' + (activo ? ' activo' : '')} onClick={() => (abierto ? setAbierto(false) : abrir())}>
        <CalendarDays size={15} /> {texto}
      </button>
      {abierto && (
        <>
          <div className="rango-fondo" onClick={() => setAbierto(false)} />
          <div className="rango-panel" role="dialog" aria-label="Elegir rango de fechas">
            <div className="rango-meses">
              {meses.map((m, i) => {
                const primero = (m.getDay() + 6) % 7 // lunes = 0
                const total = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate()
                const celdas = [...Array(primero).fill(null), ...Array.from({ length: total }, (_, k) => iso(new Date(m.getFullYear(), m.getMonth(), k + 1)))]
                return (
                  <div className={'rango-mes' + (i === 1 ? ' segundo' : '')} key={i}>
                    <div className="rango-cabeza">
                      <button type="button" className={'rango-flecha' + (i === 0 ? '' : ' oculta-escritorio')} onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))} aria-label="Mes anterior"><ChevronLeft size={20} /></button>
                      <strong>{(([t]) => t.toUpperCase() + m.toLocaleDateString('es-CO', { month: 'long' }).slice(1))(m.toLocaleDateString('es-CO', { month: 'long' }))} {m.getFullYear()}</strong>
                      <button type="button" className={'rango-flecha' + (i === 1 ? '' : ' oculta-escritorio')} onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))} aria-label="Mes siguiente"><ChevronRight size={20} /></button>
                    </div>
                    <div className="rango-grilla">
                      {DIAS.map((d) => <span className="rango-dia-semana" key={d}>{d}</span>)}
                      {celdas.map((d, k) => {
                        if (!d) return <span key={'v' + k} />
                        const enRango = a && fin && d >= a && d <= fin
                        const extremo = d === a || d === fin
                        const col = k % 7
                        const clase = ['rango-dia',
                          enRango && 'en-rango', extremo && 'extremo',
                          d === a && 'inicio', d === fin && 'fin',
                          (col === 0 || d.endsWith('-01')) && 'borde-izq', (col === 6 || Number(d.slice(8)) === total) && 'borde-der',
                          d === hoy && 'hoy'].filter(Boolean).join(' ')
                        return (
                          <button type="button" key={d} className={clase} onClick={() => tocar(d)} onMouseEnter={() => setEncima(d)}>
                            {Number(d.slice(8))}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="rango-pie">
              <span className="sub">{a ? (b ? `${corta(a)} – ${corta(b)}` : `Desde ${corta(a)} · toca el día final`) : 'Toca el día inicial'}</span>
              <div className="acciones">
                <button type="button" className="btn" onClick={() => setAbierto(false)}>Cancelar</button>
                <button type="button" className="btn primario" disabled={!a} onClick={() => { aplicar(a, b || a); setAbierto(false) }}>Actualizar</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
