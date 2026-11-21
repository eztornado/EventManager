# EventManager

Plataforma de eventos e inscripciones: tienda pública para asistentes y backoffice para organizaciones. Reúne en una sola aplicación la venta de entradas, la gestión de modalidades y tarifas, los cupones, los regalos y el seguimiento de pedidos. Admite eventos deportivos, conferencias, conciertos, actividades culturales y talleres.

## Tecnologías

- **Backend:** Rust + [Larust](https://larust.dev) 0.14 (Axum 0.7), SQLx y SQLite por defecto.
- **Frontend:** React 19 + Vite + TypeScript + Mantine 8 + TanStack Query.
- **Autenticación:** JWT con roles `superadmin`, `admin` y `organizer`.
- **Correo:** bandeja de salida interna (no se envía correo real).
- **Pagos:** pasarela simulada para desarrollo o Stripe Checkout con cargos reales.
- **Despliegue:** imagen Docker multi-stage lista para Coolify, con SQLite persistente y migraciones automáticas.

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
cargo run -- admin:create       # crea un superadmin con ADMIN_NAME/EMAIL/PASSWORD
cargo run -- route:list         # lista las rutas registradas
cd frontend && npm run build    # comprobación TypeScript + build de producción
```

## Despliegue con Docker y Coolify

El repositorio incluye un `Dockerfile` multi-stage que compila el frontend y el backend, sirve el SPA desde el propio binario y arranca como usuario sin privilegios. También incluye `docker-compose.yml` para pruebas locales.

### Docker local

```bash
docker build -t eventmanager .

docker run -d --name eventmanager \
  -p 8080:8080 \
  -e APP_URL=http://localhost:8080 \
  -e FRONTEND_URL=http://localhost:8080 \
  -e ADMIN_NAME=Administrador \
  -e ADMIN_EMAIL=admin@example.test \
  -e ADMIN_PASSWORD=una-clave-segura \
  -e JWT_SECRET=una-cadena-aleatoria-de-32-caracteres \
  -v eventmanager-storage:/app/storage \
  eventmanager
```

Abre <http://localhost:8080>. El entrypoint aplica las migraciones y, si `ADMIN_EMAIL` y `ADMIN_PASSWORD` están definidos, crea el primer superadmin. Si el correo ya existe, no modifica su contraseña.

Con Compose:

```bash
ADMIN_EMAIL=admin@example.test \
ADMIN_PASSWORD=una-clave-segura \
docker compose up -d --build
```

El compose está pensado para pruebas locales (URLs `http://localhost`, volumen y puerto 8080). Para Coolify usa el `Dockerfile` y define las URLs públicas como variables de entorno.

### Coolify

1. Crea un recurso desde el repositorio y elige **Dockerfile** como build pack (no Compose). Puerto expuesto: `8080`.
2. Añade un volumen persistente para la base de datos: monta **`/app/storage`**. No montes `/app` ni `/app/database`: ahí viven el binario, el SPA y las migraciones.
3. Configura las variables de entorno:

   ```env
   APP_ENV=production
   APP_DEBUG=false
   APP_HOST=0.0.0.0
   APP_PORT=8080
   APP_URL=https://tu-dominio.example
   FRONTEND_URL=https://tu-dominio.example
   SESSION_SECURE_COOKIE=true
   DB_CONNECTION=sqlite
   DB_DATABASE=storage/database.sqlite
   LOG_CHANNEL=stdout
   JWT_SECRET=una-cadena-aleatoria-de-32-caracteres
   PAYMENT_PROVIDER=demo
   ADMIN_NAME=Administrador
   ADMIN_EMAIL=admin@tu-dominio.example
   ADMIN_PASSWORD=una-clave-segura
   ```

   Para cargar los datos de demostración en una instalación nueva, añade `SEED_DEMO_DATA=true` en el primer despliegue. El seeder se salta bases de datos que ya tienen usuarios, así que puedes dejarlo o quitarlo después.

4. Despliega. En los logs verás las migraciones, la creación del administrador y el arranque en `0.0.0.0:8080`. El healthcheck de la imagen consulta `/api/health`.
5. En Stripe, configura el webhook en `https://tu-dominio.example/api/stripe/webhook`.

La base de datos SQLite queda en `/app/storage/database.sqlite` dentro del volumen. Para copias de seguridad, copia ese archivo o el volumen completo; para una copia consistente con SQLite en modo WAL, detén el contenedor o usa `sqlite3 database.sqlite ".backup copia.sqlite"`. Mantén una sola réplica del contenedor: SQLite no está pensado para varios procesos escribiendo sobre el mismo volumen.

### Variables relevantes en producción

| Variable | Valor recomendado |
| --- | --- |
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `APP_HOST` / `APP_PORT` | `0.0.0.0` / `8080` (o el `PORT` que inyecte la plataforma) |
| `APP_URL` / `FRONTEND_URL` | URL pública con `https://` |
| `SESSION_SECURE_COOKIE` | `true` con HTTPS |
| `DB_DATABASE` | `storage/database.sqlite` |
| `LOG_CHANNEL` | `stdout` |
| `JWT_SECRET` | Cadena aleatoria de 32+ caracteres |
| `ADMIN_*` | Solo en el primer despliegue, para crear el superadmin |
| `SEED_DEMO_DATA` | `false` en producción |
| `PAYMENT_PROVIDER` | `demo` o `stripe` |

El contenedor arranca como root únicamente para ajustar los permisos del volumen y después ejecuta la aplicación como el usuario `eventmanager` (UID 10001).

## Cuentas de demostración

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Superadministrador | `elena@eventmanager.test` | `admin1234` |
| Administrador | `marta@eventmanager.test` | `admin1234` |
| Organizador | `javier@horizonte.test` | `organizer123` |
| Organizadora cultural | `nuria@aulaabierta.test` | `organizer123` |

Los datos demo incluyen cuatro organizadores, doce clubes y once eventos con fechas de 2027: pruebas deportivas, un congreso, un concierto y un taller. También hay modalidades, tramos de precio, cupones, regalos y más de un centenar de inscripciones y pedidos. Todos los nombres y correos son inventados.

## Funcionalidad

### Tienda pública

- Listado de eventos con búsqueda y filtros por provincia y categoría (deporte, conferencia, concierto, cultura, formación y otros).
- Detalle del evento con entradas, precios vigentes, plazas y plazo de venta.
- Compra en varios pasos con campos dinámicos por entrada, club (solo en eventos deportivos), cupón y pago con Stripe o pasarela demo.
- Recibo imprimible en HTML.
- Consulta de inscripción por localizador, modificación de datos, cancelación y recuperación por correo.
- Listado público de asistentes (nombre, club y entrada).
- Compra de una entrada como regalo y canje posterior con código.
- Página de canje de regalos.

### Backoffice

- Panel con métricas, gráficos, últimas inscripciones y ocupación por evento.
- Eventos: creación, edición, publicación y eliminación en cascada, con categoría (deportivo, conferencia, concierto, cultura, formación u otro).
- Modalidades y entradas: distancia opcional, horario, plazas, precio base, orden y campos personalizados en JSON.
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
  Services/             autenticación JWT, pagos, utilidades y plantillas de correo
config/                 configuración de Larust
database/
  migrations/           esquema SQLite
  seeders/              datos de demostración
docker/
  entrypoint.sh         migraciones, administrador inicial y arranque
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
Dockerfile              build multi-stage de frontend + backend
docker-compose.yml      despliegue local con volumen persistente
```

## Notas de implementación

- La base de datos por defecto es `database/database.sqlite`; puede cambiarse con `DB_CONNECTION` y `DB_DATABASE`. En Docker se usa `storage/database.sqlite` para que el volumen persistente no oculte las migraciones.
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
- La pasarela demo completa cualquier pedido sin contacto con proveedores externos. Con `PAYMENT_PROVIDER=stripe` se crea una sesión de Stripe Checkout, se redirige al cliente y se confirma el pago consultando la sesión en el servidor. También se acepta el webhook `checkout.session.completed` en `POST /api/stripe/webhook`.
- Las rutas del SPA se sirven con fallback a `frontend/dist/index.html`, de modo que recargar `/admin/eventos` funciona igual que navegar desde la raíz.
- Para desarrollo sin compilar el frontend, se puede usar `npm run dev`; el backend sigue exponiendo `/api`.

## Configuración de Stripe

Por defecto la aplicación usa la pasarela de demostración. Para cobrar con Stripe Checkout:

```bash
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CURRENCY=eur
FRONTEND_URL=http://localhost:8099
```

- `STRIPE_SECRET_KEY` es obligatorio para crear sesiones de pago; nunca se expone al frontend.
- `FRONTEND_URL` se usa para construir las URLs de éxito y cancelación (`/pago/confirmacion` y la consulta de la inscripción). En desarrollo con Vite, usa `http://localhost:5173`.
- `STRIPE_WEBHOOK_SECRET` activa la verificación de firma del webhook. Configura en Stripe el endpoint `https://tu-dominio/api/stripe/webhook` para `checkout.session.completed`; en local puedes reenviar eventos con la CLI de Stripe.
- Tras volver de Stripe, la página de confirmación verifica la sesión contra la API antes de marcar el pedido como pagado, por lo que el webhook es opcional en desarrollo pero recomendable en producción.
- `STRIPE_API_BASE` solo es necesario para pruebas con un servidor simulado; por defecto apunta a `https://api.stripe.com/v1`.
