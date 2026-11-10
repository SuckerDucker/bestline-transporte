-- Migración de datos (sin cambios de esquema): regla confirmada por la empresa.
-- Los turnos hora_cita.turno_1 y hora_cita.turno_2 se reemplazan por dos
-- bloques de hora de cita en formato HH:mm-HH:mm. Si la clave nueva ya existe
-- (por ejemplo, porque el seed ya corrió) no se toca nada.
UPDATE "parametro_operacion"
SET "clave" = 'hora_cita.bloque_matutino',
    "valor" = '04:00-05:00',
    "descripcion" = 'Bloque matutino de horas de cita (HH:mm-HH:mm, America/Cancun)'
WHERE "clave" = 'hora_cita.turno_1'
  AND NOT EXISTS (SELECT 1 FROM "parametro_operacion" WHERE "clave" = 'hora_cita.bloque_matutino');

UPDATE "parametro_operacion"
SET "clave" = 'hora_cita.bloque_vespertino',
    "valor" = '12:00-13:00',
    "descripcion" = 'Bloque vespertino de horas de cita (HH:mm-HH:mm, America/Cancun)'
WHERE "clave" = 'hora_cita.turno_2'
  AND NOT EXISTS (SELECT 1 FROM "parametro_operacion" WHERE "clave" = 'hora_cita.bloque_vespertino');

-- Si quedaron los turnos viejos (porque los bloques ya existían), se eliminan.
DELETE FROM "parametro_operacion" WHERE "clave" IN ('hora_cita.turno_1', 'hora_cita.turno_2');
