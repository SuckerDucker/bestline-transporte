-- Fase 13: liga el usuario operador@bestline.local (id 6) con el operador 01
-- (José Hernández, BL-01) en una base de desarrollo ya cargada, sin migrate
-- reset. Antes se aplica la migración con `npx prisma migrate deploy`.
-- Deja la base igual a lo que hoy crea prisma/seed.ts.
--
-- Uso (PowerShell, desde la raíz del repositorio):
--   docker cp apps/api/prisma/actualizaciones/2026-11-20-usuario-operador.sql bestline-db:/tmp/usuario-operador.sql
--   docker exec bestline-db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f /tmp/usuario-operador.sql'

BEGIN;
UPDATE operador SET usuario_id = 6
 WHERE id = 1
   AND EXISTS (SELECT 1 FROM usuario WHERE id = 6 AND email = 'operador@bestline.local' AND rol = 'OPERADOR');
COMMIT;
