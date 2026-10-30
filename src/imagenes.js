// Reduce la foto a 400px y la convierte en texto (JPEG) para guardarla junto al producto.
export function reducirImagen(archivo, lado = 400) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onerror = rechazar
    lector.onload = () => {
      const img = new Image()
      img.onerror = rechazar
      img.onload = () => {
        const escala = Math.min(1, lado / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * escala)
        canvas.height = Math.round(img.height * escala)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolver(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.src = lector.result
    }
    lector.readAsDataURL(archivo)
  })
}
