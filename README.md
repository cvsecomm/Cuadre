# Cuadre

App para llevar ventas, gastos e inventario de dos negocios (restaurante y tienda online), con caja POS.
Funciona en el navegador y se instala en el celular como app.

## Probarla en tu computador

```bash
npm install
npm run dev
```

## Estado

Caja POS (Vender), Movimientos, Resumen e Inventario con fotos.

- **Sin configurar Supabase:** la app funciona en modo local con datos de ejemplo guardados en el navegador.
- **Con Supabase:** cada persona inicia sesión; los datos se comparten entre el equipo y los permisos
  (dueño / cajero) los controla la base de datos.

## Conectar Supabase

1. En Supabase → SQL Editor, ejecutar `supabase/esquema.sql`.
2. Crear los usuarios en Authentication → Users.
3. Copiar `.env.example` como `.env` y llenar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. En Vercel, importar el repositorio y poner esas mismas dos variables.

La primera persona que entra crea su negocio y queda como dueña.
