# 01 · Base del proyecto (Sprint 1)

## Qué se hizo

Se creó desde cero la base del sistema en un monorepo con dos aplicaciones: una API en NestJS con TypeScript estricto, configurada con prefijo global `/api`, validación global de datos, CORS restringido al frontend de desarrollo, documentación Swagger y un endpoint de salud; y un frontend en React 18 con Vite y TailwindCSS que muestra la pantalla de inicio de sesión con validación de formulario. Se definió el modelo de datos inicial de 15 tablas con Prisma 7 sobre PostgreSQL 16, que corre en un contenedor de Docker, y se preparó un seed con datos de ejemplo y un usuario administrador cuya contraseña se guarda cifrada con bcrypt. La autenticación real, los catálogos, la importación y el motor de asignación quedaron fuera de este paso.

## Cómo se hizo

- **API.** Se generó con `npx @nestjs/cli new api --package-manager npm --skip-git --strict`. La configuración común (prefijo, `ValidationPipe` con `whitelist`, `forbidNonWhitelisted` y `transform`, CORS y Swagger) se centralizó en `configurarApp()`, que usan tanto `main.ts` como las pruebas e2e, para que la API se pruebe igual que como se ejecuta.
- **Web.** Se generó con Vite (plantilla `react-ts`), se fijó React 18 y se integró TailwindCSS 4 con su plugin de Vite. El formulario de login usa React Hook Form con un esquema de Zod (correo válido y contraseña obligatoria). Todavía no llama a la API.
- **Base de datos.** `docker-compose.yml` levanta solo `postgres:16` con un volumen nombrado (`bestline_pgdata`) y credenciales tomadas del `.env` de la raíz.
- **Modelo de datos.** En `schema.prisma`, los modelos van en PascalCase y en singular, y las tablas y columnas en snake_case con `@@map` y `@map`. Las fechas con hora usan `timestamptz`, las coordenadas `Decimal(9,6)` y hay 6 enums.
- **Prisma 7.** La URL de conexión y el comando del seed se movieron a `prisma.config.ts`. El cliente se genera en `src/generated/prisma` y se conecta con el adaptador `@prisma/adapter-pg`.
- **Seed.** Todos los datos son de ejemplo y están marcados así en el código: 8 zonas, 8 hoteles genéricos y una matriz de tiempos 8 × 8 distinta por sentido. Los parámetros son `hora_cita`, `jornada_maxima_horas` y 40 anticipaciones `anticipacion.<TIPO>.<ZONA>`. También incluye 2 mayoristas, 10 vehículos, 10 operadores, 60 servicios del 2026-11-10 y el usuario ADMINISTRADOR, cuyos datos salen del `.env`. El seed usa `upsert`, así que puede ejecutarse varias veces sin duplicar registros.

## Archivos principales

| Archivo | Propósito |
|---|---|
| `docker-compose.yml`, `.env.example` | PostgreSQL 16 de desarrollo |
| `apps/api/src/main.ts`, `apps/api/src/configurar-app.ts` | Arranque y configuración global de la API |
| `apps/api/src/health/` | Módulo y controlador de salud |
| `apps/api/prisma/schema.prisma` | Modelo de datos (15 tablas, 6 enums) |
| `apps/api/prisma.config.ts` | Configuración de Prisma 7 |
| `apps/api/prisma/seed.ts` | Datos de ejemplo y usuario administrador |
| `apps/api/.env.example` | Variables de la API (marcadores) |
| `apps/web/src/features/auth/LoginPage.tsx`, `loginSchema.ts` | Pantalla de inicio de sesión y validación |
| `README.md` | Pasos para levantar el proyecto |

## Endpoints

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/api/health` | `{ "status": "ok" }` |
| GET | `/api/docs` | Interfaz de Swagger |
| GET | `/api/docs-json` | Documento OpenAPI |

## Resultado de las pruebas

- `npm test` (API, Vitest): 1 archivo, 1 prueba aprobada (`HealthController` responde `{ status: "ok" }`).
- `npm run test:e2e` (API, Vitest + Supertest): 2 pruebas aprobadas (`GET /api/health` y `GET /api/docs-json`).
- `npm run build` en la API y en la web: compilan sin errores.
- La API respondió en `http://localhost:3000/api/health` y Swagger en `http://localhost:3000/api/docs`. La web respondió en `http://localhost:5173`.
- **Pendiente:** la migración `esquema_inicial` y la carga del seed. No se pudieron ejecutar porque Docker Desktop no arrancaba: faltaba el componente de Windows WSL.
