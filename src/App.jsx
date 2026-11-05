import { useState } from 'react'
import { ShoppingBag, ArrowLeftRight, BarChart3, Package, Store, LogOut, Settings, Wallet, Users } from 'lucide-react'
import { useDatos, cambiarNegocio, cerrarSesion, MODO_NUBE, esCobertizo } from './store'
import Inicio from './views/Inicio'
import Caja from './views/Caja'
import Movimientos from './views/Movimientos'
import Inventario from './views/Inventario'
import Login from './views/Login'
import FormNegocio from './views/FormNegocio'
import Negocio from './views/Negocio'
import Cierre from './views/Cierre'
import Nomina from './views/Nomina'

// soloDueno: el cajero no ve esa sección. soloCobertizo: solo aparece en el negocio El Cobertizo
const VISTAS = [
  { id: 'vender', nombre: 'Vender', Icono: ShoppingBag, Componente: Caja },
  { id: 'movimientos', nombre: 'Movimientos', Icono: ArrowLeftRight, Componente: Movimientos },
  { id: 'cierre', nombre: 'Cierre', Icono: Wallet, Componente: Cierre },
  { id: 'resumen', nombre: 'Resumen', Icono: BarChart3, Componente: Inicio, soloDueno: true },
  { id: 'nomina', nombre: 'Nómina', Icono: Users, Componente: Nomina, soloDueno: true, soloCobertizo: true },
  { id: 'inventario', nombre: 'Inventario', Icono: Package, Componente: Inventario },
  { id: 'negocio', nombre: 'Negocio', Icono: Settings, Componente: Negocio, soloDueno: true },
]

const NOMBRE_ROL = { dueno: 'Dueño', cajero: 'Cajero' }

export default function App() {
  const datos = useDatos()
  const [vista, setVista] = useState('vender')
  const [nuevoNegocio, setNuevoNegocio] = useState(false)

  if (!datos.listo) return <div className="pantalla-centro"><p className="sub">Cargando…</p></div>
  if (MODO_NUBE && !datos.usuario) return <Login />
  if (datos.negocios.length === 0) return <FormNegocio />

  const esDueno = datos.rol === 'dueno'
  const negocio = datos.negocios.find((n) => n.id === datos.negocioActivo)
  const vistas = VISTAS.filter((v) => (esDueno || !v.soloDueno) && (!v.soloCobertizo || esCobertizo(negocio)))
  const { Componente } = vistas.find((v) => v.id === vista) ?? vistas[0]

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
              onChange={(e) => (e.target.value === '+' ? setNuevoNegocio(true) : cambiarNegocio(e.target.value))}
              aria-label="Negocio"
            >
              {datos.negocios.map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
              <option value="+">+ Agregar negocio</option>
            </select>
            <small>{NOMBRE_ROL[datos.rol]}</small>
          </span>
        </label>
        <nav>
          {vistas.map((v) => (
            <button key={v.id} className={v.id === vista ? 'activo' : ''} onClick={() => setVista(v.id)}>
              <v.Icono size={19} strokeWidth={2} />
              <span>{v.nombre}</span>
            </button>
          ))}
        </nav>
        {MODO_NUBE && (
          <div className="menu-pie">
            <small title={datos.usuario.email}>{datos.usuario.email}</small>
            <button className="btn enlace" onClick={cerrarSesion}><LogOut size={16} /> Cerrar sesión</button>
          </div>
        )}
      </aside>
      <main className="contenido">
        {datos.error && <p className="aviso error">{datos.error}</p>}
        {negocio && <Componente key={negocio.id} datos={datos} negocio={negocio} irA={setVista} esDueno={esDueno} />}
      </main>
      {nuevoNegocio && <FormNegocio cerrar={() => setNuevoNegocio(false)} />}
    </div>
  )
}
