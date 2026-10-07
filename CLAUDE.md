# Proyecto: Sistema web para la asignación asistida y el monitoreo de servicios de transporte turístico (Best Line Travel Agency, Cancún)

Estadía universitaria (UPQROO, Ingeniería en Software) de un solo desarrollador. Sistema interno que importa servicios de mayoristas (CSV/Excel), propone con un motor de asignación qué unidad y operador hace cada servicio sin empalmes, y da seguimiento por estados e incidencias.

## Stack
- Frontend: React 18 + TypeScript + Vite, TailwindCSS, TanStack Query, React Hook Form + Zod, Recharts, Leaflet + OpenStreetMap
- Backend: NestJS + TypeScript, JWT y bcrypt, SheetJS y PapaParse
- Base de datos: PostgreSQL 16 + Prisma
- Pruebas: Jest, Supertest, Vitest
- Infraestructura: Docker, Docker Compose, Nginx, Git y GitHub Actions

## Estructura
- `apps/api`: backend NestJS (monolito modular)
- `apps/web`: frontend React

## Reglas de trabajo (importantes)
- El alumno debe poder explicar y defender cada pieza. Antes de cambiar código, explica el plan y el porqué. Haz cambios pequeños y revisables.
- No inventes actividades, cifras, resultados, fuentes ni datos de la empresa.
- No avances más allá del alcance pedido. Alcance actual: Sprint 1 (repositorio, estructura, modelo de datos inicial, login).
- Nunca subas a Git archivos `.env`, contraseñas ni llaves. Usa `.env.example` con marcadores.
- Commits con Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`). Ramas `feat/nombre-corto`, mezcladas a `main`.
- Código en TypeScript; comentarios y mensajes de commit en español.
