# 01 · Base del proyecto (Sprint 1)

## Qué se hizo

Se creó desde cero la base del sistema en un monorepo con dos aplicaciones: una API en NestJS con TypeScript estricto, configurada con prefijo global `/api`, validación global de datos, CORS restringido al frontend de desarrollo, documentación Swagger y un endpoint de salud; y un frontend en React 18 con Vite y TailwindCSS que muestra la pantalla de inicio de sesión con validación de formulario. Se definió el modelo de datos inicial de 15 tablas con Prisma 7 sobre PostgreSQL 16 en un contenedor de Docker, se aplicó la migración `esquema_inicial` y se cargó un seed con datos de ejemplo y un usuario administrador con contraseña cifrada con bcrypt. Las pruebas de la API se configuraron con Jest y Supertest. La autenticación real, los catálogos, la importación y el motor de asignación quedaron fuera de este paso.

## Cómo se hizo

- **API.** Se generó con `npx @nestjs/cli new api --package-manager npm --skip-git --strict`. La configuración común (prefijo, `ValidationPipe` con `whitelist`, `forbidNonWhitelisted` y `transform`, CORS y Swagger) se centralizó en `configurarApp()`, que usan tanto `main.ts` como las pruebas e2e, para que la API se pruebe igual que como se ejecuta.
- **Web.** Se generó con Vite (plantilla `react-ts`), se fijó React 18 y se integró TailwindCSS 4 con su plugin de Vite. El formulario de login usa React Hook Form con un esquema de Zod (correo válido y contraseña obligatoria). Todavía no llama a la API.
- **Base de datos.** `docker-compose.yml` levanta solo `postgres:16` con un volumen nombrado (`bestline_pgdata`), con credenciales tomadas del `.env` de la raíz y con *healthcheck*.
- **Modelo de datos.** En `schema.prisma`, los modelos van en PascalCase y en singular, y las tablas y columnas en snake_case con `@@map` y `@map`. Las fechas con hora usan `timestamptz`, las coordenadas `Decimal(9,6)` y hay 7 enums.
- **Prisma 7.** La URL de conexión y el comando del seed van en `prisma.config.ts`. El cliente se genera en `src/generated/prisma` y se conecta con el adaptador `@prisma/adapter-pg`.
- **Seed.** Todos los datos son de ejemplo y están marcados así en el código. El seed usa `upsert`, así que puede ejecutarse varias veces sin duplicar registros.
- **Pruebas.** Nest 12 genera el proyecto con Vitest. Se cambió a **Jest + ts-jest + Supertest** en modo ESM (la API es un módulo ES). Un resolver propio (`jest.resolver.cjs`) traduce los imports `.js` del código a los archivos `.ts`, sin tocar las dependencias.

## Decisiones de diseño

- **Separación de tipo y modalidad del servicio.** El enum original `TipoServicio` mezclaba dos ideas: el *sentido* del servicio (llegada o salida) y la *forma* en que se presta (privado, compartido o grupo). Con un solo campo, una llegada privada o una salida en grupo no se podía representar. Se separó en dos columnas de `servicio`:
  - `tipo`: `TipoServicio` {LLEGADA, SALIDA, TRASLADO}. Indica el sentido y es lo que usan las anticipaciones (`anticipacion.<TIPO>.<ZONA>`).
  - `modalidad`: `ModalidadServicio` {PRIVADO, COMPARTIDO, GRUPO}. Indica la forma del servicio y se relaciona con el número de pasajeros.

  Es la única columna agregada al modelo de 15 tablas, y se autorizó explícitamente.
- **Fechas en `timestamptz`.** Se guarda el instante exacto y la conversión a America/Cancun se hace al mostrar. Durante la carga del seed se detectó que el adaptador `@prisma/adapter-pg` envía las fechas como texto en UTC sin zona. El servidor del contenedor está en America/Cancun y las interpretaba con 5 horas de desfase. Se corrigió forzando la sesión de Prisma a UTC (`options: '-c timezone=UTC'`) y se verificó leyendo los datos de vuelta.
- **Coordenadas en `Decimal(9,6)`.** Seis decimales dan una precisión de unos 10 cm, de sobra para ubicar zonas y hoteles.

## Datos de ejemplo cargados (seed)

| Tabla | Registros | Contenido |
|---|---|---|
| usuario | 1 | ADMINISTRADOR; correo y contraseña tomados de `.env`, hash bcrypt (`$2b$10$…`, 60 caracteres) |
| zona | 8 | Aeropuerto CUN, Zona Hotelera, Centro Cancún, Costa Mujeres, Puerto Morelos, Playa del Carmen, Tulum, Aeropuerto TQO; zona de término solo en los dos aeropuertos y Zona Hotelera |
| hotel | 8 | Nombres genéricos ("Hotel Ejemplo …") |
| tiempo_traslado | 64 | Matriz 8 × 8 distinta por sentido (por ejemplo, Aeropuerto CUN → Tulum = 100 min y Tulum → Aeropuerto CUN = 105 min) |
| parametro_operacion | 26 | `hora_cita` = 05:00, `jornada_maxima_horas` = 9.5 y 24 anticipaciones (3 tipos × 8 zonas; LLEGADA = 0 min, SALIDA y TRASLADO = 15 min) |
| mayorista | 2 | TUI, Nexus Tours |
| vehiculo | 10 | 5 Van (10 pax), 3 Sprinter (19 pax), 2 Autobús (40 pax); una en MANTENIMIENTO |
| operador | 10 | Nombres genéricos; uno no disponible |
| servicio | 60 | Todos el 2026-11-10, entre 06:00 y 19:50 (America/Cancun), estado PENDIENTE |

Reparto de los 60 servicios por tipo y modalidad:

| Tipo | PRIVADO | COMPARTIDO | GRUPO | Total | Con vuelo |
|---|---|---|---|---|---|
| LLEGADA | 10 | 10 | 4 | 24 | 24 |
| SALIDA | 10 | 10 | 4 | 24 | 24 |
| TRASLADO | 6 | 3 | 3 | 12 | 0 |

Pasajeros por modalidad: privado de 1 a 6, compartido de 4 a 12 y grupo de 15 a 35. Algunos grupos superan la capacidad de una van, lo que servirá para probar la regla de capacidad.

## Archivos principales

| Archivo | Propósito |
|---|---|
| `docker-compose.yml`, `.env.example` | PostgreSQL 16 de desarrollo |
| `apps/api/src/main.ts`, `apps/api/src/configurar-app.ts` | Arranque y configuración global de la API |
| `apps/api/src/health/` | Módulo, controlador y prueba unitaria de salud |
| `apps/api/prisma/schema.prisma` | Modelo de datos (15 tablas, 7 enums) |
| `apps/api/prisma/migrations/…_esquema_inicial/migration.sql` | Migración inicial |
| `apps/api/prisma.config.ts` | Configuración de Prisma 7 |
| `apps/api/prisma/seed.ts` | Datos de ejemplo y usuario administrador |
| `apps/api/jest.config.js`, `apps/api/test/jest-e2e.config.js`, `apps/api/jest.resolver.cjs` | Configuración de Jest (unitarias y e2e) |
| `apps/api/test/app.e2e-spec.ts` | Pruebas e2e con Supertest |
| `apps/web/src/features/auth/LoginPage.tsx`, `loginSchema.ts` | Pantalla de inicio de sesión y validación |
| `README.md` | Pasos para levantar el proyecto |

## Endpoints

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/api/health` | `{ "status": "ok" }` |
| GET | `/api/docs` | Interfaz de Swagger |
| GET | `/api/docs-json` | Documento OpenAPI |

## Resultado de las pruebas y verificación

- `npm test` (Jest): 1 suite, 1 prueba aprobada (`HealthController` responde `{ status: "ok" }`).
- `npm run test:e2e` (Jest + Supertest): 1 suite, 2 pruebas aprobadas (`GET /api/health` y `GET /api/docs-json`).
- `npm run build`: la API y la web compilan sin errores.
- `docker compose ps`: `bestline-db` con `postgres:16`, estado *healthy*, puerto 5432.
- `npx prisma migrate dev --name esquema_inicial`: migración `20261104010252_esquema_inicial` creada y aplicada; 15 tablas en el esquema `public`.
- `npx prisma db seed`: conteos verificados con SQL (1 usuario, 8 zonas, 8 hoteles, 64 tiempos, 26 parámetros, 2 mayoristas, 10 vehículos, 10 operadores, 60 servicios).
- API en `http://localhost:3000`: `/api/health` responde `{"status":"ok"}` y Swagger en `/api/docs` responde 200. La web en `http://localhost:5173` muestra el Login.
- `npm audit fix` (sin `--force`) actualizó `babel-plugin-istanbul` (8.0.0 → 8.0.2). Quedan 26 avisos (6 bajos, 18 moderados y 2 altos), todos en dependencias de desarrollo: Jest, `@nestjs/cli` y `@nestjs/mau`. `npm audit --omit=dev` reporta 0 vulnerabilidades en las dependencias de producción.
