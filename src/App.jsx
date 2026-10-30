import { useState } from 'react'
import { useDatos, cambiarNegocio } from './store'
import Inicio from './views/Inicio'
import Caja from './views/Caja'
import Movimientos from './views/Movimientos'
import Inventario from './views/Inventario'

const VISTAS = [
  { id: 'inicio', nombre: 'Inicio', icono: '◎', Componente: Inicio },
  { id: 'caja', nombre: 'Caja', icono: '▦', Componente: Caja },
  { id: 'movimientos', nombre: 'Movimientos', icono: '⇅', Componente: Movimientos },
  { id: 'inventario', nombre: 'Inventario', icono: '▤', Componente: Inventario },
]

export default function App() {
  const datos = useDatos()
  const [vista, setVista] = useState('inicio')
  const { Componente } = VISTAS.find((v) => v.id === vista)
  const negocio = datos.negocios.find((n) => n.id === datos.negocioActivo)

  return (
    <div className="app">
      <aside className="menu">
        <div className="marca">Cuadre</div>
        <select
          className="selector-negocio"
          value={datos.negocioActivo}
          onChange={(e) => cambiarNegocio(e.target.value)}
          aria-label="Negocio"
        >
          {datos.negocios.map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
        </select>
        <nav>
          {VISTAS.map((v) => (
            <button key={v.id} className={v.id === vista ? 'activo' : ''} onClick={() => setVista(v.id)}>
              <span className="icono">{v.icono}</span>
              <span>{v.nombre}</span>
            </button>
          ))}
        </nav>
      </aside>
      <main className="contenido">
        <Componente datos={datos} negocio={negocio} irA={setVista} />
      </main>
    </div>
  )
}
