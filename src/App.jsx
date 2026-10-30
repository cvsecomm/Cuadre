import { useState } from 'react'
import { ShoppingBag, ArrowLeftRight, BarChart3, Package, Store } from 'lucide-react'
import { useDatos, cambiarNegocio } from './store'
import Inicio from './views/Inicio'
import Caja from './views/Caja'
import Movimientos from './views/Movimientos'
import Inventario from './views/Inventario'

const VISTAS = [
  { id: 'vender', nombre: 'Vender', Icono: ShoppingBag, Componente: Caja },
  { id: 'movimientos', nombre: 'Movimientos', Icono: ArrowLeftRight, Componente: Movimientos },
  { id: 'resumen', nombre: 'Resumen', Icono: BarChart3, Componente: Inicio },
  { id: 'inventario', nombre: 'Inventario', Icono: Package, Componente: Inventario },
]

export default function App() {
  const datos = useDatos()
  const [vista, setVista] = useState('vender')
  const { Componente } = VISTAS.find((v) => v.id === vista)
  const negocio = datos.negocios.find((n) => n.id === datos.negocioActivo)

  return (
    <div className="app">
      <aside className="menu">
        <div className="marca">Cuadre</div>
        <label className="tarjeta-negocio">
          <span className="avatar"><Store size={18} /></span>
          <span className="negocio-texto">
            <select
              className="selector-negocio"
              value={datos.negocioActivo}
              onChange={(e) => cambiarNegocio(e.target.value)}
              aria-label="Negocio"
            >
              {datos.negocios.map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
            </select>
            <small>Dueño</small>
          </span>
        </label>
        <nav>
          {VISTAS.map((v) => (
            <button key={v.id} className={v.id === vista ? 'activo' : ''} onClick={() => setVista(v.id)}>
              <v.Icono size={19} strokeWidth={2} />
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
