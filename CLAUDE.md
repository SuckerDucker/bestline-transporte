# Proyecto: Desarrollo de un sistema web para la asignación asistida y el monitoreo de servicios de transporte turístico para el área de Operaciones de Best Line Travel Agency

Estadía universitaria (UPQROO, Ingeniería en Software) de un solo desarrollador. Sistema interno que importa servicios de mayoristas (CSV/Excel), propone con un motor de asignación qué unidad y operador hace cada servicio sin empalmes, y da seguimiento por estados e incidencias.

## Stack
- Frontend: React 18 + TypeScript + Vite, TailwindCSS, TanStack Query, React Hook Form + Zod, Recharts, Leaflet + OpenStreetMap
- Backend: NestJS + TypeScript, JWT y bcrypt, SheetJS y PapaParse, Swagger (OpenAPI) en /api/docs
- Base de datos: PostgreSQL 16 + Prisma
- Pruebas: Jest, Supertest, Vitest
- Infraestructura: Docker, Docker Compose, Nginx, Git y GitHub Actions

## Estructura
- `apps/api`: backend NestJS (monolito modular)
- `apps/web`: frontend React
- `docs/evidencias`: notas de evidencias por módulo para la memoria

## Estado actual
- La computadora se formateó y el código local se perdió. En el repositorio solo existen .gitignore, .gitattributes y CLAUDE.md; el monorepo, el esquema de Prisma y el Login se deben crear desde cero.
- Docker Desktop está instalado. Para desarrollo, PostgreSQL 16 corre en un contenedor con docker-compose.yml (solo el servicio de base de datos); la API y el frontend corren con Node.js en Windows. El Docker Compose completo (web, api, db y Nginx) se configura al final, en la fase de despliegue.

## Modelo de datos (15 tablas, debe coincidir con el diagrama entidad–relación de la memoria)
usuario, bitacora, vehiculo, operador, zona, hotel, tiempo_traslado, parametro_operacion, mayorista, importacion, servicio, rol_diario, asignacion, servicio_no_cubierto, incidencia.
- Modelos de Prisma en español, singular y PascalCase (Operador, Vehiculo); tablas en snake_case con @@map.
- Roles: ADMINISTRADOR, COORDINADOR, SUPERVISOR, OPERADOR.
- Estados del servicio: PENDIENTE, PROGRAMADO, EN_RUTA, EN_SERVICIO, COMPLETADO, CANCELADO, INCIDENCIA.

## Reglas del motor de asignación
- Inicio efectivo = hora del servicio − anticipación (por tipo de servicio y zona). Liberación = inicio efectivo + tiempo de traslado (matriz por sentido).
- Una unidad toma un servicio solo si: liberación anterior + traslado al nuevo origen <= inicio efectivo; pasajeros <= capacidad; jornada desde la hora de cita <= 9.5 h (parámetro); el último servicio termina en una zona de término válida.
- Heurística constructiva voraz: ordenar por hora y elegir la unidad factible de menor costo (tiempo muerto + recorrido en vacío). Si ninguna es factible, guardar servicio_no_cubierto con su motivo.
- El rol, sus asignaciones y los no cubiertos se guardan en una sola transacción.
- Todas las fechas y horas en zona horaria America/Cancun.

## Reglas de trabajo (importantes)
- El alumno debe poder explicar y defender cada pieza. Antes de cambiar código, explica el plan y el porqué. Haz cambios pequeños y revisables.
- Trabaja solo en el alcance que se pida en cada instrucción; no adelantes módulos.
- No agregues ni quites tablas o columnas sin preguntar.
- Nunca subas a Git archivos `.env`, contraseñas ni llaves. Usa `.env.example` con marcadores.
- Commits con Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`). Ramas `feat/nombre-corto`, con push al terminar cada paso; merge a `main` solo cuando el alumno lo pida.
- No agregues la línea "Co-Authored-By" ni ninguna firma de Claude en los mensajes de commit.
- Código en TypeScript; comentarios, mensajes de commit e interfaz en español.

## Evidencias para la memoria (al terminar cada módulo)
- Crear o actualizar `docs/evidencias/NN-modulo.md` con: qué se hizo (en pasado, un párrafo), cómo se hizo, archivos principales, endpoints y resultado de las pruebas.
- Decir EXACTAMENTE qué capturas tomar: qué abrir, qué comando correr, qué URL y qué debe verse en pantalla (pantalla funcionando con datos de ejemplo, Swagger del módulo, `npm test` en verde, el commit en GitHub).
- Si algo no se puede hacer o falta información de la empresa, avisar en vez de suponer.