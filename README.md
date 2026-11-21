# EventManager

| [English](#-english) | [Español](#-español) | [日本語](#-日本語) |

---

## 🇬🇧 English

**EventManager** is an event and registration platform: a public store for attendees and a backoffice for organizers. It brings together ticket sales, format and pricing management, coupons, gifts, and order tracking in a single application. It supports sports events, conferences, concerts, cultural activities, and workshops.

### Technologies

- **Backend:** Rust + [Larust](https://larust.dev) 0.14 (Axum 0.7), SQLx, and SQLite by default.
- **Frontend:** React 19 + Vite + TypeScript + Mantine 8 + TanStack Query.
- **Authentication:** JWT with roles `superadmin`, `admin`, and `organizer`.
- **Email:** internal outbox (no real emails are sent).
- **Payments:** simulated gateway for development or Stripe Checkout with real charges.
- **Deployment:** multi-stage Docker image ready for Coolify, with persistent SQLite and automatic migrations.

### Requirements

- Stable Rust and Cargo.
- Node.js 20 or later.
- SQLite (included in the system or via the SQLx driver).

### Getting Started

```bash
# 1. Frontend dependencies
cd frontend
npm install
cd ..

# 2. Create the database and load demo data
cargo run -- migrate:fresh --seed

# 3. Build the frontend (served by the backend)
cd frontend
npm run build
cd ..

# 4. Start the application
APP_PORT=8099 cargo run
```

The application is available at <http://localhost:8099>. The repository includes `.env.example` with the local configuration; copy it to `.env` (`cp .env.example .env`) so that `cargo run` uses port 8099 without additional variables.

#### Frontend Development

With the backend running on port 8099:

```bash
cd frontend
npm run dev
```

Vite serves the frontend at <http://localhost:5173> and proxies `/api` to the backend.

#### Useful Commands

```bash
cargo run -- migrate            # apply pending migrations
cargo run -- migrate:fresh      # recreate the schema
cargo run -- migrate:fresh --seed
cargo run -- db:seed            # reload demo data
cargo run -- admin:create       # create a superadmin from ADMIN_NAME/EMAIL/PASSWORD
cargo run -- route:list         # list registered routes
cd frontend && npm run build    # TypeScript check + production build
```

### Docker and Coolify Deployment

The repository includes a multi-stage `Dockerfile` that builds the frontend and backend, serves the SPA from the binary, and runs as an unprivileged user. A `docker-compose.yml` is included for local testing.

#### Local Docker

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

Open <http://localhost:8080>. The entrypoint applies migrations and, when `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set, creates the first superadmin. If the email already exists, its password is left unchanged.

With Compose:

```bash
ADMIN_EMAIL=admin@example.test \
ADMIN_PASSWORD=una-clave-segura \
docker compose up -d --build
```

The compose file does not publish a host port (Coolify's proxy routes to the container over the internal Docker network). To browse it locally, expose port 8080 with an override file:

```bash
printf 'services:\n  eventmanager:\n    ports: ["8080:8080"]\n' > docker-compose.override.yml
docker compose up -d --build
```

For Coolify, deploy the repository's compose file as-is and set the public URLs as environment variables.

#### Coolify

1. Create a resource from the repository and choose **Dockerfile** as the build pack (not Compose). Exposed port: `8080`.
2. Add persistent storage mounted at **`/app/storage`**. Do not mount `/app` or `/app/database`: the binary, SPA, and migrations live there.
3. Configure the environment:

   ```env
   APP_ENV=production
   APP_DEBUG=false
   APP_HOST=0.0.0.0
   APP_PORT=8080
   APP_URL=https://your-domain.example
   FRONTEND_URL=https://your-domain.example
   SESSION_SECURE_COOKIE=true
   DB_CONNECTION=sqlite
   DB_DATABASE=storage/database.sqlite
   LOG_CHANNEL=stdout
   JWT_SECRET=a-random-32-character-string
   PAYMENT_PROVIDER=demo
   ADMIN_NAME=Administrator
   ADMIN_EMAIL=admin@your-domain.example
   ADMIN_PASSWORD=a-secure-password
   ```

   To load demo data on a fresh installation, add `SEED_DEMO_DATA=true` for the first deployment. The seeder skips databases that already have users, so you can leave it in place or remove it afterwards.

4. Deploy. The logs show migrations, admin creation, and startup on `0.0.0.0:8080`. The image healthcheck calls `/api/health`.
5. In Stripe, configure the webhook at `https://your-domain.example/api/stripe/webhook`.

The SQLite database is stored at `/app/storage/database.sqlite` inside the volume. To back it up, copy that file or the whole volume; for a consistent copy while SQLite is in WAL mode, stop the container or run `sqlite3 database.sqlite ".backup backup.sqlite"`. Keep a single container replica: SQLite is not designed for multiple processes writing to the same volume.

#### Production Variables

| Variable | Recommended value |
| --- | --- |
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `APP_HOST` / `APP_PORT` | `0.0.0.0` / `8080` (or the platform-injected `PORT`) |
| `APP_URL` / `FRONTEND_URL` | Public URL with `https://` |
| `SESSION_SECURE_COOKIE` | `true` with HTTPS |
| `DB_DATABASE` | `storage/database.sqlite` |
| `LOG_CHANNEL` | `stdout` |
| `JWT_SECRET` | Random string of 32+ characters |
| `ADMIN_*` | First deployment only, to create the superadmin |
| `SEED_DEMO_DATA` | `false` in production |
| `PAYMENT_PROVIDER` | `demo` or `stripe` |

The container starts as root only to fix volume permissions, then runs the application as the `eventmanager` user (UID 10001).

### Demo Accounts

| Role | Email | Password |
| --- | --- | --- |
| Superadmin | `elena@eventmanager.test` | `admin1234` |
| Admin | `marta@eventmanager.test` | `admin1234` |
| Organizer | `javier@horizonte.test` | `organizer123` |
| Cultural Organizer | `nuria@aulaabierta.test` | `organizer123` |

The demo data includes four organizers, twelve clubs, and eleven events with 2027 dates: sports competitions, a congress, a concert, and a workshop. It also includes formats, price tiers, coupons, gifts, and over a hundred registrations and orders. All names and emails are fictional.

### Features

#### Public Store

- Event listing with search and filters by province and category (sport, conference, concert, culture, training, and others).
- Event detail with tickets, current prices, availability, and sales period.
- Multi-step checkout with dynamic fields per ticket, club (sports events only), coupon, and payment via Stripe or demo gateway.
- Printable HTML receipt.
- Registration lookup by locator, data modification, cancellation, and email recovery.
- Public attendee list (name, club, and ticket).
- Purchase a ticket as a gift and later redeem it with a code.
- Gift redemption page.

#### Backoffice

- Dashboard with metrics, charts, latest registrations, and occupancy per event.
- Events: creation, editing, publishing, and cascade deletion, with category (sport, conference, concert, culture, training, or other).
- Formats and tickets: optional distance, schedule, capacity, base price, order, and custom JSON fields.
- Price tiers per format.
- Coupons by percentage, fixed amount, or free gift, with validity, max uses, and batch generation.
- Registrations: filters, editing, status change, receipts, CSV export, and deletion.
- Orders and gifts: tracking, email resend, and cancellation/deletion.
- Clubs and organizers with their access accounts.
- Administrators (superadmin only).
- Email outbox.
- Profile and password change.

Organizers can only see the events, registrations, orders, gifts, and coupons of their own organization.

### Project Structure

```text
app/
  Http/Controllers/     public and backoffice controllers
  Models/               SQLx entities serialized in camelCase
  Services/             JWT authentication, payments, utilities, and email templates
config/                 Larust configuration
database/
  migrations/           SQLite schema
  seeders/              demo data
docker/
  entrypoint.sh         migrations, initial admin, and startup
frontend/
  src/
    api/                HTTP client and CSV download
    auth/               session context and protected routes
    components/         shared components
    layouts/            public and admin layouts
    pages/public/       store and participant flows
    pages/admin/        backoffice
routes/
  api.rs                API routes under /api
src/
  lib.rs                startup, database, and SPA serving
  main.rs               console commands and server entry
Dockerfile              multi-stage frontend + backend build
docker-compose.yml      local deployment with persistent volume
```

### Implementation Notes

- The default database is `database/database.sqlite`; it can be changed with `DB_CONNECTION` and `DB_DATABASE`. Docker uses `storage/database.sqlite` so the persistent volume does not hide the migrations.
- Dynamic fields of a format are stored as a JSON array with the following shape:

  ```json
  [
    {
      "key": "size",
      "label": "T-shirt size",
      "type": "select",
      "required": true,
      "options": ["S", "M", "L", "XL"]
    }
  ]
  ```

  Supported types: `text`, `number`, `date`, `select`, `textarea`, and `checkbox`.

- Confirmation, recovery, gift, and redemption emails are saved in `email_outbox` and can be viewed in **Emails**.
- The demo gateway completes any order without contacting external providers. With `PAYMENT_PROVIDER=stripe`, a Stripe Checkout session is created, the customer is redirected, and the payment is confirmed by querying the session on the server. It also accepts the `checkout.session.completed` webhook at `POST /api/stripe/webhook`.
- SPA routes are served with a fallback to `frontend/dist/index.html`, so reloading `/admin/events` works the same as navigating from the root.
- For development without compiling the frontend, you can use `npm run dev`; the backend still exposes `/api`.

### Stripe Configuration

By default, the application uses the demo gateway. To charge with Stripe Checkout:

```bash
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CURRENCY=eur
FRONTEND_URL=http://localhost:8099
```

- `STRIPE_SECRET_KEY` is required to create payment sessions; it is never exposed to the frontend.
- `FRONTEND_URL` is used to build success and cancellation URLs (`/payment/confirmation` and the registration lookup). In development with Vite, use `http://localhost:5173`.
- `STRIPE_WEBHOOK_SECRET` enables webhook signature verification. Configure in Stripe the endpoint `https://your-domain/api/stripe/webhook` for `checkout.session.completed`; locally you can forward events with the Stripe CLI.
- After returning from Stripe, the confirmation page verifies the session against the API before marking the order as paid, so the webhook is optional in development but recommended in production.
- `STRIPE_API_BASE` is only needed for testing with a mock server; by default it points to `https://api.stripe.com/v1`.

---

## 🇪🇸 Español

**EventManager** es una plataforma de eventos e inscripciones: tienda pública para asistentes y backoffice para organizaciones. Reúne en una sola aplicación la venta de entradas, la gestión de modalidades y tarifas, los cupones, los regalos y el seguimiento de pedidos. Admite eventos deportivos, conferencias, conciertos, actividades culturales y talleres.

### Tecnologías

- **Backend:** Rust + [Larust](https://larust.dev) 0.14 (Axum 0.7), SQLx y SQLite por defecto.
- **Frontend:** React 19 + Vite + TypeScript + Mantine 8 + TanStack Query.
- **Autenticación:** JWT con roles `superadmin`, `admin` y `organizer`.
- **Correo:** bandeja de salida interna (no se envía correo real).
- **Pagos:** pasarela simulada para desarrollo o Stripe Checkout con cargos reales.
- **Despliegue:** imagen Docker multi-stage lista para Coolify, con SQLite persistente y migraciones automáticas.

### Requisitos

- Rust estable y Cargo.
- Node.js 20 o superior.
- SQLite (incluido en el sistema o mediante el driver de SQLx).

### Puesta en marcha

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

#### Desarrollo del frontend

Con el backend en el puerto 8099:

```bash
cd frontend
npm run dev
```

Vite sirve el frontend en <http://localhost:5173> y redirige `/api` al backend.

#### Comandos útiles

```bash
cargo run -- migrate            # aplica migraciones pendientes
cargo run -- migrate:fresh      # recrea el esquema
cargo run -- migrate:fresh --seed
cargo run -- db:seed            # vuelve a cargar los datos demo
cargo run -- admin:create       # crea un superadmin con ADMIN_NAME/EMAIL/PASSWORD
cargo run -- route:list         # lista las rutas registradas
cd frontend && npm run build    # comprobación TypeScript + build de producción
```

### Despliegue con Docker y Coolify

El repositorio incluye un `Dockerfile` multi-stage que compila el frontend y el backend, sirve el SPA desde el propio binario y arranca como usuario sin privilegios. También incluye `docker-compose.yml` para pruebas locales.

#### Docker local

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

El compose no publica puerto en el host (el proxy de Coolify enruta al contenedor por la red interna de Docker). Para verlo en local, expón el 8080 con un fichero de override:

```bash
printf 'services:\n  eventmanager:\n    ports: ["8080:8080"]\n' > docker-compose.override.yml
docker compose up -d --build
```

Para Coolify despliega el compose del repositorio tal cual y define las URLs públicas como variables de entorno.

#### Coolify

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

#### Variables relevantes en producción

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

### Cuentas de demostración

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Superadministrador | `elena@eventmanager.test` | `admin1234` |
| Administrador | `marta@eventmanager.test` | `admin1234` |
| Organizador | `javier@horizonte.test` | `organizer123` |
| Organizadora cultural | `nuria@aulaabierta.test` | `organizer123` |

Los datos demo incluyen cuatro organizadores, doce clubes y once eventos con fechas de 2027: pruebas deportivas, un congreso, un concierto y un taller. También hay modalidades, tramos de precio, cupones, regalos y más de un centenar de inscripciones y pedidos. Todos los nombres y correos son inventados.

### Funcionalidad

#### Tienda pública

- Listado de eventos con búsqueda y filtros por provincia y categoría (deporte, conferencia, concierto, cultura, formación y otros).
- Detalle del evento con entradas, precios vigentes, plazas y plazo de venta.
- Compra en varios pasos con campos dinámicos por entrada, club (solo en eventos deportivos), cupón y pago con Stripe o pasarela demo.
- Recibo imprimible en HTML.
- Consulta de inscripción por localizador, modificación de datos, cancelación y recuperación por correo.
- Listado público de asistentes (nombre, club y entrada).
- Compra de una entrada como regalo y canje posterior con código.
- Página de canje de regalos.

#### Backoffice

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

### Estructura del proyecto

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

### Notas de implementación

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

### Configuración de Stripe

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

---

## 🇯🇵 日本語

**EventManager**は、イベントと登録のプラットフォームです。参加者向けの公開ストアと、主催者向けのバックオフィスを提供します。チケット販売、フォーマットと価格管理、クーポン、ギフト、注文追跡を1つのアプリケーションに統合しています。スポーツイベント、カンファレンス、コンサート、文化活動、ワークショップに対応しています。

### テクノロジー

- **バックエンド:** Rust + [Larust](https://larust.dev) 0.14（Axum 0.7）、SQLx、デフォルトでSQLite。
- **フロントエンド:** React 19 + Vite + TypeScript + Mantine 8 + TanStack Query。
- **認証:** `superadmin`、`admin`、`organizer`のロールを持つJWT。
- **メール:** 内部アウトボックス（実際のメールは送信されません）。
- **決済:** 開発用のシミュレーションゲートウェイ、またはStripe Checkoutによる本番課金。
- **デプロイ:** Coolify対応のマルチステージDockerイメージ。永続SQLiteと自動マイグレーションを含みます。

### 要件

- Stable Rust と Cargo。
- Node.js 20 以上。
- SQLite（システムに同梱されているか、SQLxドライバー経由）。

### スタートガイド

```bash
# 1. フロントエンドの依存関係
cd frontend
npm install
cd ..

# 2. データベースの作成とデモデータの読み込み
cargo run -- migrate:fresh --seed

# 3. フロントエンドのビルド（バックエンドで配信）
cd frontend
npm run build
cd ..

# 4. アプリケーションの起動
APP_PORT=8099 cargo run
```

アプリケーションは <http://localhost:8099> で利用可能です。リポジトリにはローカル設定を含む `.env.example` が含まれています。`.env` にコピー（`cp .env.example .env`）すると、追加の変数なしで `cargo run` がポート 8099 を使用します。

#### フロントエンドの開発

バックエンドがポート 8099 で稼働している場合：

```bash
cd frontend
npm run dev
```

Vite はフロントエンドを <http://localhost:5173> で配信し、`/api` をバックエンドにプロキシします。

#### 便利なコマンド

```bash
cargo run -- migrate            # 保留中のマイグレーションを適用
cargo run -- migrate:fresh      # スキーマを再作成
cargo run -- migrate:fresh --seed
cargo run -- db:seed            # デモデータを再読み込み
cargo run -- admin:create       # ADMIN_NAME/EMAIL/PASSWORDからスーパー管理者を作成
cargo run -- route:list         # 登録されたルートをリスト表示
cd frontend && npm run build    # TypeScript チェック + 本番ビルド
```

### Docker と Coolify へのデプロイ

リポジトリには、フロントエンドとバックエンドをビルドし、SPAをバイナリから配信し、非特権ユーザーで実行するマルチステージ `Dockerfile` が含まれています。ローカルテスト用の `docker-compose.yml` もあります。

#### ローカル Docker

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

<http://localhost:8080> を開いてください。エントリポイントはマイグレーションを適用し、`ADMIN_EMAIL` と `ADMIN_PASSWORD` が設定されている場合は最初のスーパー管理者を作成します。メールアドレスが既に存在する場合、パスワードは変更されません。

Compose の場合:

```bash
ADMIN_EMAIL=admin@example.test \
ADMIN_PASSWORD=una-clave-segura \
docker compose up -d --build
```

Composeファイルはホストポートを公開しません（CoolifyのプロキシはDocker内部ネットワーク経由でコンテナに到達します）。ローカルで確認するには、オーバーライドファイルでポート8080を公開してください：

```bash
printf 'services:\n  eventmanager:\n    ports: ["8080:8080"]\n' > docker-compose.override.yml
docker compose up -d --build
```

CoolifyではリポジトリのComposeファイルをそのままデプロイし、公開URLを環境変数で設定してください。

#### Coolify

1. リポジトリからリソースを作成し、ビルドパックとして **Dockerfile**（Composeではない）を選択します。公開ポート: `8080`。
2. 永続ストレージを **`/app/storage`** にマウントします。`/app` や `/app/database` はマウントしないでください。バイナリ、SPA、マイグレーションがそこにあります。
3. 環境変数を設定します:

   ```env
   APP_ENV=production
   APP_DEBUG=false
   APP_HOST=0.0.0.0
   APP_PORT=8080
   APP_URL=https://your-domain.example
   FRONTEND_URL=https://your-domain.example
   SESSION_SECURE_COOKIE=true
   DB_CONNECTION=sqlite
   DB_DATABASE=storage/database.sqlite
   LOG_CHANNEL=stdout
   JWT_SECRET=a-random-32-character-string
   PAYMENT_PROVIDER=demo
   ADMIN_NAME=Administrator
   ADMIN_EMAIL=admin@your-domain.example
   ADMIN_PASSWORD=a-secure-password
   ```

   新しいインストールでデモデータを読み込むには、最初のデプロイ時に `SEED_DEMO_DATA=true` を追加します。シーダーは既にユーザーが存在するデータベースをスキップするため、その後も残すか削除するかを選べます。

4. デプロイします。ログにマイグレーション、管理者作成、`0.0.0.0:8080` での起動が表示されます。イメージのヘルスチェックは `/api/health` を呼び出します。
5. Stripeでは、`https://your-domain.example/api/stripe/webhook` にWebhookを設定します。

SQLiteデータベースはボリューム内の `/app/storage/database.sqlite` に保存されます。バックアップするには、そのファイルまたはボリューム全体をコピーします。WALモードで一貫したコピーを取るには、コンテナを停止するか、`sqlite3 database.sqlite ".backup backup.sqlite"` を実行します。SQLiteは同じボリュームに複数のプロセスが書き込む用途には向いていないため、コンテナのレプリカは1つにしてください。

#### 本番環境の変数

| 変数 | 推奨値 |
| --- | --- |
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `APP_HOST` / `APP_PORT` | `0.0.0.0` / `8080`（またはプラットフォームが注入する `PORT`） |
| `APP_URL` / `FRONTEND_URL` | `https://` を含む公開URL |
| `SESSION_SECURE_COOKIE` | HTTPSでは `true` |
| `DB_DATABASE` | `storage/database.sqlite` |
| `LOG_CHANNEL` | `stdout` |
| `JWT_SECRET` | 32文字以上のランダムな文字列 |
| `ADMIN_*` | 最初のデプロイ時のみ、スーパー管理者作成用 |
| `SEED_DEMO_DATA` | 本番では `false` |
| `PAYMENT_PROVIDER` | `demo` または `stripe` |

コンテナはボリュームの権限を修正するためだけにrootで起動し、その後 `eventmanager` ユーザー（UID 10001）でアプリケーションを実行します。

### デモアカウント

| ロール | メール | パスワード |
| --- | --- | --- |
| スーパー管理者 | `elena@eventmanager.test` | `admin1234` |
| 管理者 | `marta@eventmanager.test` | `admin1234` |
| 主催者 | `javier@horizonte.test` | `organizer123` |
| 文化主催者 | `nuria@aulaabierta.test` | `organizer123` |

デモデータには、4つの主催者、12つのクラブ、2027年の日程を持つ11のイベント（スポーツ競技、会議、コンサート、ワークショップ）が含まれています。また、フォーマット、価格帯、クーポン、ギフト、100件以上の登録と注文も含まれています。すべての名前とメールアドレスは架空のものです。

### 機能

#### 公開ストア

- 都道府県とカテゴリ（スポーツ、カンファレンス、コンサート、文化、トレーニング、その他）で検索・フィルタリング可能なイベント一覧。
- チケット、現在の価格、空き枠、販売期間を含むイベント詳細。
- チケットごとの動的フィールド、クラブ（スポーツイベントのみ）、クーポン、Stripeまたはデモゲートウェイによる決済を含むマルチステップチェックアウト。
- 印刷可能なHTMLレシート。
- ロケータによる登録検索、データ変更、キャンセル、メール回復。
- 公開参加者一覧（名前、クラブ、チケット）。
- ギフトとしてチケットを購入し、後でコードで交換。
- ギフト交換ページ。

#### バックオフィス

- メトリクス、チャート、最新の登録、イベント別の占有率を含むダッシュボード。
- イベント：作成、編集、公開、カスケード削除、カテゴリ（スポーツ、カンファレンス、コンサート、文化、トレーニング、その他）。
- フォーマットとチケット：オプションの距離、スケジュール、定員、基本価格、順序、カスタムJSONフィールド。
- フォーマット別の価格帯。
- パーセント、固定金額、または無料ギフトのクーポン。有効期間、最大使用回数、バッチ生成。
- 登録：フィルタ、編集、ステータス変更、レシート、CSVエクスポート、削除。
- 注文とギフト：追跡、メール再送信、キャンセル/削除。
- アクセスアカウントを持つクラブと主催者。
- 管理者（スーパー管理者のみ）。
- メールアウトボックス。
- プロフィールとパスワード変更。

主催者は、自分の組織のイベント、登録、注文、ギフト、クーポンのみを表示できます。

### プロジェクト構造

```text
app/
  Http/Controllers/     公開およびバックオフィスのコントローラー
  Models/               camelCaseでシリアライズされたSQLxエンティティ
  Services/             JWT認証、決済、ユーティリティ、メールテンプレート
config/                 Larustの設定
database/
  migrations/           SQLiteスキーマ
  seeders/              デモデータ
docker/
  entrypoint.sh         マイグレーション、初期管理者、起動
frontend/
  src/
    api/                HTTPクライアントとCSVダウンロード
    auth/               セッションコンテキストと保護されたルート
    components/         共有コンポーネント
    layouts/            公開および管理のレイアウト
    pages/public/       ストアと参加者のフロー
    pages/admin/        バックオフィス
routes/
  api.rs                /api 下のAPIルート
src/
  lib.rs                スタートアップ、データベース、SPAの配信
  main.rs               コンソールコマンドとサーバーのエントリ
Dockerfile              フロントエンド + バックエンドのマルチステージビルド
docker-compose.yml      永続ボリューム付きのローカルデプロイ
```

### 実装ノート

- デフォルトのデータベースは `database/database.sqlite` です。`DB_CONNECTION` と `DB_DATABASE` で変更できます。Dockerでは永続ボリュームがマイグレーションを隠さないよう `storage/database.sqlite` を使用します。
- フォーマットの動的フィールドは、以下の形状のJSON配列として保存されます：

  ```json
  [
    {
      "key": "size",
      "label": "Tシャツのサイズ",
      "type": "select",
      "required": true,
      "options": ["S", "M", "L", "XL"]
    }
  ]
  ```

  対応タイプ：`text`、`number`、`date`、`select`、`textarea`、`checkbox`。

- 確認、回復、ギフト、交換のメールは `email_outbox` に保存され、**メール**で確認できます。
- デモゲートウェイは外部プロバイダーに連絡せずに注文を完了します。`PAYMENT_PROVIDER=stripe` で、Stripe Checkoutセッションが作成され、顧客がリダイレクトされ、サーバーでセッションを照会して決済が確認されます。また、`POST /api/stripe/webhook` で `checkout.session.completed` ウェブフックを受け付けます。
- SPAルートは `frontend/dist/index.html` にフォールバックして配信されるため、`/admin/events` の再読み込みはルートからのナビゲーションと同じように動作します。
- フロントエンドをコンパイルせずに開発するには、`npm run dev` を使用できます。バックエンドは引き続き `/api` を公開します。

### Stripeの設定

デフォルトでは、アプリケーションはデモゲートウェイを使用します。Stripe Checkoutで課金するには：

```bash
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CURRENCY=eur
FRONTEND_URL=http://localhost:8099
```

- `STRIPE_SECRET_KEY` は決済セッションの作成に必要です。フロントエンドには公開されません。
- `FRONTEND_URL` は成功URLとキャンセルURL（`/payment/confirmation` と登録検索）の構築に使用されます。Viteでの開発では、`http://localhost:5173` を使用します。
- `STRIPE_WEBHOOK_SECRET` はウェブフックの署名検証を有効にします。Stripeで `checkout.session.completed` 用のエンドポイント `https://your-domain/api/stripe/webhook` を設定します。ローカルではStripe CLIでイベントを転送できます。
- Stripeから戻った後、確認ページは注文を支払い済みとしてマークする前にAPIに対してセッションを検証するため、ウェブフックは開発ではオプションですが、本番では推奨されます。
- `STRIPE_API_BASE` はモックサーバーでのテストにのみ必要です。デフォルトでは `https://api.stripe.com/v1` を指します。
