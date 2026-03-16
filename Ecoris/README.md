# Ecoris

## Requisitos
- Node.js 18+
- MySQL 8+

## Configuracion
1. Copia `.env` y ajusta tus credenciales si es necesario.
2. Ejecuta la migracion en `sql/migrations/001_add_empresa_geo_price.sql`.
3. Instala dependencias: `npm install`.
4. Inicia el servidor: `npm start`.

## API
- `GET /api/empresas`: lista empresas con ubicacion y precios.
