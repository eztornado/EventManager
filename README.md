# EventManager

Plataforma de inscripciones para eventos deportivos: tienda pública para participantes y backoffice para organizaciones. Reúne en una sola aplicación la venta de dorsales, la gestión de modalidades y tarifas, los cupones, los regalos y el seguimiento de pedidos.

## Tecnologías

- **Backend:** Rust + [Larust](https://larust.dev) 0.14 (Axum 0.7), SQLx y SQLite por defecto.
- **Frontend:** React 19 + Vite + TypeScript + Mantine 8 + TanStack Query.
- **Autenticación:** JWT con roles `superadmin`, `admin` y `organizer`.
- **Correo:** bandeja de salida interna (no se envía correo real).
- **Pagos:** pasarela simulada, sin cargos reales.

## Requisitos

- Rust estable y Cargo.
- Node.js 20 o superior.
- SQLite (incluido en el sistema o mediante el driver de SQLx).

## Puesta en marcha

```bash
# 1. Dependencias del frontend
cd frontend
npm install
cd ..

# 2. Crear la base de datos y cargar los datos de demostración
cargo run -- migrate:fresh --seed

# 3. Compilar el frontend (se sirve desde el backend)
cd frontend
npm run build
cd ..

# 4. Arrancar la aplicación
APP_PORT=8099 cargo run
```

La aplicación queda disponible en <http://localhost:8099>. El repositorio incluye `.env.example` con la configuración local; cópialo a `.env` (`cp .env.example .env`) para que `cargo run` use el puerto 8099 sin variables adicionales.

### Desarrollo del frontend

Con el backend en el puerto 8099:

```bash
cd frontend
npm run dev
```

Vite sirve el frontend en <http://localhost:5173> y redirige `/api` al backend.

### Comandos útiles

```bash
cargo run -- migrate            # aplica migraciones pendientes
cargo run -- migrate:fresh      # recrea el esquema
cargo run -- migrate:fresh --seed
cargo run -- db:seed            # vuelve a cargar los datos demo
cargo run -- route:list         # lista las rutas registradas
cd frontend && npm run build    # comprobación TypeScript + build de producción
```

## Cuentas de demostración

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Superadministrador | `elena@eventmanager.test` | `admin1234` |
| Administrador | `marta@eventmanager.test` | `admin1234` |
| Organizador | `javier@horizonte.test` | `organizer123` |

Los datos demo incluyen tres organizadores, doce clubes, ocho eventos con fechas de 2027, modalidades, tramos de precio, cupones, regalos y alrededor de un centenar de inscripciones y pedidos. Todos los nombres y correos son inventados.

## Funcionalidad

### Tienda pública

- Listado de eventos con búsqueda por nombre o ciudad y filtro por provincia.
- Detalle del evento con modalidades, precios vigentes, plazas y plazo de inscripción.
- Inscripción en varios pasos con campos dinámicos por modalidad, club, cupón y pago simulado.
- Recibo imprimible en HTML.
- Consulta de inscripción por localizador, modificación de datos, cancelación y recuperación por correo.
- Listado público de participantes (nombre, club y modalidad).
- Compra de una inscripción como regalo y canje posterior con código.
- Página de canje de regalos.

### Backoffice

- Panel con métricas, gráficos, últimas inscripciones y ocupación por evento.
- Eventos: creación, edición, publicación y eliminación en cascada.
- Modalidades: distancia, horario, plazas, precio base, orden y campos personalizados en JSON.
- Tramos de precio por modalidad.
- Cupones por porcentaje, importe fijo o regalo, con vigencia, usos máximos y generación por lotes.
- Inscripciones: filtros, edición, cambio de estado, recibos, exportación CSV y borrado.
- Pedidos y regalos: seguimiento, reenvío de correo y cancelación/borrado.
- Clubes y organizadores con sus cuentas de acceso.
- Administradores (solo superadministrador).
- Bandeja de correos de salida.
- Perfil y cambio de contraseña.

Los organizadores solo ven los eventos, inscripciones, pedidos, regalos y cupones de su propia organización.

## Estructura del proyecto

```text
app/
  Http/Controllers/     controladores públicos y de backoffice
  Models/               entidades SQLx serializadas en camelCase
  Services/             autenticación JWT, utilidades y plantillas de correo
config/                 configuración de Larust
database/
  migrations/           esquema SQLite
  seeders/              datos de demostración
frontend/
  src/
    api/                cliente HTTP y descarga de CSV
    auth/               contexto de sesión y rutas protegidas
    components/         componentes compartidos
    layouts/            layouts público y de administración
    pages/public/       tienda y flujos de participante
    pages/admin/        backoffice
routes/
  api.rs                rutas de la API bajo /api
src/
  lib.rs                arranque, base de datos y servido del SPA
  main.rs               comandos de consola y entrada del servidor
```

## Notas de implementación

- La base de datos por defecto es `database/database.sqlite`; puede cambiarse con `DB_CONNECTION` y `DB_DATABASE`.
- Los campos dinámicos de una modalidad se guardan como un array JSON con la forma:

  ```json
  [
    {
      "key": "talla",
      "label": "Talla de camiseta",
      "type": "select",
      "required": true,
      "options": ["S", "M", "L", "XL"]
    }
  ]
  ```

  Tipos admitidos: `text`, `number`, `date`, `select`, `textarea` y `checkbox`.

- Los correos de confirmación, recuperación, regalos y canjes se guardan en `email_outbox` y pueden consultarse en **Correos**.
- Los pagos son simulados: cualquier pedido puede completarse desde la pasarela demo; no se contacta con ningún proveedor real.
- Las rutas del SPA se sirven con fallback a `frontend/dist/index.html`, de modo que recargar `/admin/eventos` funciona igual que navegar desde la raíz.
- Para desarrollo sin compilar el frontend, se puede usar `npm run dev`; el backend sigue exponiendo `/api`.
