// Muestra la foto del producto o, si no tiene, un cuadro de color con su inicial.
const TONOS = ['naranja', 'azul', 'verde', 'morado', 'ambar', 'rosa']

function tono(texto = '') {
  let h = 0
  for (const c of texto) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TONOS[h % TONOS.length]
}

export default function ImagenProducto({ producto, className = '' }) {
  if (producto.imagen) {
    return <img className={'img-producto ' + className} src={producto.imagen} alt="" />
  }
  return (
    <div className={`img-producto sin-foto tono-${tono(producto.categoria)} ${className}`} aria-hidden="true">
      {(producto.nombre || '?').trim().charAt(0).toUpperCase()}
    </div>
  )
}
