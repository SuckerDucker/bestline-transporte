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
cp .env.example .env          # usa el mismo usuario y contraseña de la BD que en el .env de la raíz
npm install
npx prisma migrate dev        # aplica las migraciones (en Prisma 7 no corre el seed)
npx prisma db seed            # carga los datos DE EJEMPLO y el usuario administrador
npm run start:dev
```

- Salud: http://localhost:3000/api/health → `{ "status": "ok" }`
- Swagger: http://localhost:3000/api/docs
- Ver las tablas: `npx prisma studio --port 5555` y abrir http://localhost:5555
- Pruebas (Jest): `npm test` (unitarias) y `npm run test:e2e` (Supertest)

## 3. Web (React) en http://localhost:5173

```bash
cd apps/web
npm install
npm run dev
```

Por ahora solo muestra la pantalla de inicio de sesión (validación del formulario, sin conexión a la API).
