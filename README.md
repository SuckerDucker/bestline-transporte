# Best Line · Operaciones

Sistema web para la asignación asistida y el monitoreo de servicios de transporte turístico para el área de Operaciones de Best Line Travel Agency.

Proyecto de estadía (UPQROO, Ingeniería en Software).

## Estructura

```
.
├── apps/
│   ├── api/          # Backend NestJS + Prisma (monolito modular)
│   └── web/          # Frontend React 18 + Vite + TailwindCSS
├── docs/evidencias/  # Notas de evidencias por módulo
├── docs/ejemplos/    # Layout de servicios de la empresa (anonimizado) en .xlsx y .csv
├── docker-compose.yml  # Solo PostgreSQL 16 (desarrollo)
└── .env.example        # Credenciales de la base de datos (marcadores)
```

## Requisitos

- Node.js 24 y npm 11
- Docker Desktop (en Windows necesita WSL 2: `wsl --install --no-distribution` como administrador y reiniciar)

## 1. Base de datos (PostgreSQL 16 en Docker)

```bash
# En la raíz del repositorio
cp .env.example .env          # y reemplaza los marcadores
docker compose up -d
docker compose ps             # el servicio "db" debe verse "healthy"
```

## 2. API (NestJS) en http://localhost:3000

```bash
cd apps/api
cp .env.example .env          # y reemplaza los marcadores (ver tabla de variables)
npm install
npx prisma migrate dev        # aplica las migraciones (en Prisma 7 no corre el seed)
npx prisma db seed            # carga los valores de operación, los datos de ejemplo y un usuario por rol
npm run start:dev
```

Variables de `apps/api/.env`:

| Variable | Para qué sirve |
|---|---|
| `PORT` | Puerto de la API (3000) |
| `CORS_ORIGIN` | Origen permitido del frontend (http://localhost:5173) |
| `DATABASE_URL` | Conexión a la base de desarrollo (mismo usuario y contraseña que el `.env` de la raíz) |
| `DATABASE_URL_TEST` | Conexión a la base de pruebas e2e (`bestline_test`; se crea y migra sola) |
| `JWT_SECRET` | Secreto para firmar los tokens (cadena larga y aleatoria) |
| `JWT_EXPIRES_IN` | Duración del token (por ejemplo `8h`) |
| `ADMIN_NOMBRE`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Usuario ADMINISTRADOR que crea el seed |
| `SEED_PASSWORD_EJEMPLO` | Contraseña de los usuarios de ejemplo del seed |

Usuarios que crea el seed:

| Correo | Rol | Contraseña |
|---|---|---|
| El de `ADMIN_EMAIL` | ADMINISTRADOR | `ADMIN_PASSWORD` |
| coordinador@bestline.local | COORDINADOR | `SEED_PASSWORD_EJEMPLO` |
| supervisor@bestline.local | SUPERVISOR | `SEED_PASSWORD_EJEMPLO` |
| operador@bestline.local | OPERADOR | `SEED_PASSWORD_EJEMPLO` |

- Salud: http://localhost:3000/api/health → `{ "status": "ok" }`
- Swagger: http://localhost:3000/api/docs (botón **Authorize**: pega el `accessToken` de `POST /api/auth/login`)
- Ver las tablas: `npx prisma studio --port 5555` y abrir http://localhost:5555

Pruebas (Jest + Supertest):

```bash
npm test            # unitarias (sin base de datos; Prisma simulado)
npm run test:cov    # unitarias con reporte de cobertura (carpeta coverage/)
npm run test:e2e    # e2e contra la base bestline_test (requiere la BD arriba)
```

## 3. Web (React) en http://localhost:5173

```bash
cd apps/web
npm install
npm run dev
```

La URL de la API es `http://localhost:3000/api` por defecto; para cambiarla, copia `apps/web/.env.example` como `apps/web/.env` y ajusta `VITE_API_URL`.

Interfaz construida con [shadcn/ui](https://ui.shadcn.com) (componentes en `src/components/ui`, sobre Radix UI y TailwindCSS) e íconos de lucide-react. Para agregar otro componente: `npx shadcn@latest add <componente>`. La versión actual de shadcn/ui asume React 19; con React 18 hay que envolver con `React.forwardRef` los componentes que reciben `ref` (ver los comentarios en `button.tsx`, `input.tsx` y los overlays).

Pantallas:

- Inicio de sesión e inicio con tarjetas de resumen (`GET /api/resumen`).
- **Operación:** generar el rol del día con el motor de asignación (resumen y servicios no cubiertos con su motivo; ADMINISTRADOR y COORDINADOR), importar servicios desde el layout del mayorista (.xlsx o .csv, con vista previa por fila antes de confirmar; ADMINISTRADOR y COORDINADOR), consulta de servicios con filtros e historial de importaciones con su detalle. Para probar, importa `docs/ejemplos/Layout_Servicios_Nexus.xlsx` con el mayorista Nexus Tours.
- **Catálogos:** vehículos, operadores, zonas y hoteles (búsqueda, filtros, paginación, alta y edición en modal, desactivar o eliminar con confirmación y avisos).
- **Configuración:** parámetros de operación, zonas de término y matriz de tiempos de traslado (editable por celda).
- **Administración:** usuarios (alta, edición, cambio de contraseña, desactivar y reactivar) y bitácora con filtros.

En móvil el menú lateral se abre con el botón ☰. El menú depende del rol:

| Rol | Ve | Puede modificar |
|---|---|---|
| ADMINISTRADOR | Todo | Sí |
| COORDINADOR | Inicio, Operación, Catálogos y Configuración | Importa servicios; catálogos y configuración solo en consulta |
| SUPERVISOR | Inicio, Operación (sin importar), Catálogos y Configuración | No (solo consulta) |
| OPERADOR | Inicio | No |

Pruebas (Vitest + React Testing Library):

```bash
npm test            # una vez
npm run test:watch  # se repiten al guardar
npm run test:cov    # con reporte de cobertura (carpeta coverage/)
```
