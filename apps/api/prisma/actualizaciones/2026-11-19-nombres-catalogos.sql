-- Quita "Ejemplo" de los nombres visibles en una base ya cargada con el seed,
-- sin migrate reset y sin borrar ni recrear registros: UPDATE por id, así la
-- importación del 05/11, los servicios y los roles conservan sus relaciones.
-- Deja la base igual a lo que hoy crea prisma/seed.ts.
--
-- Uso (PowerShell, desde la raíz del repositorio). Se copia al contenedor y se
-- corre con -f: pasarlo por tubería desde PowerShell 5.1 cambia la codificación
-- y los acentos quedan mal guardados.
--   docker cp apps/api/prisma/actualizaciones/2026-11-19-nombres-catalogos.sql bestline-db:/tmp/nombres.sql
--   docker exec bestline-db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f /tmp/nombres.sql'

BEGIN;

-- Usuarios: solo el nombre (correo y contraseña sin cambio).
UPDATE usuario SET nombre = 'Laura Méndez'   WHERE id = 4 AND email = 'coordinador@bestline.local';
UPDATE usuario SET nombre = 'Jorge Ramírez'  WHERE id = 5 AND email = 'supervisor@bestline.local';
UPDATE usuario SET nombre = 'José Hernández' WHERE id = 6 AND email = 'operador@bestline.local';

-- Operadores: nombre y licencia.
UPDATE operador SET nombre = 'José Hernández',  licencia = 'LIC-QROO-01' WHERE id = 1;
UPDATE operador SET nombre = 'Carlos Martínez', licencia = 'LIC-QROO-02' WHERE id = 2;
UPDATE operador SET nombre = 'Luis García',     licencia = 'LIC-QROO-03' WHERE id = 3;
UPDATE operador SET nombre = 'Roberto Sánchez', licencia = 'LIC-QROO-04' WHERE id = 4;
UPDATE operador SET nombre = 'Fernando López',  licencia = 'LIC-QROO-05' WHERE id = 5;
UPDATE operador SET nombre = 'Ricardo Díaz',    licencia = 'LIC-QROO-06' WHERE id = 6;
UPDATE operador SET nombre = 'Alejandro Cruz',  licencia = 'LIC-QROO-07' WHERE id = 7;
UPDATE operador SET nombre = 'Manuel Flores',   licencia = 'LIC-QROO-08' WHERE id = 8;
UPDATE operador SET nombre = 'Javier Morales',  licencia = 'LIC-QROO-09' WHERE id = 9;
UPDATE operador SET nombre = 'Héctor Ramos',    licencia = 'LIC-QROO-10' WHERE id = 10;

-- Hoteles genéricos → hoteles reales de la misma zona (la zona no cambia).
UPDATE hotel SET nombre = 'Hyatt Ziva Cancun',            latitud = 21.1359, longitud = -86.7415 WHERE id = 1;
UPDATE hotel SET nombre = 'Kempinski Hotel Cancun',       latitud = 21.0932, longitud = -86.7682 WHERE id = 2;
UPDATE hotel SET nombre = 'Hotel Plaza Caribe',           latitud = 21.1647, longitud = -86.8270 WHERE id = 3;
UPDATE hotel SET nombre = 'Dreams Playa Mujeres',         latitud = 21.2619, longitud = -86.8149 WHERE id = 4;
UPDATE hotel SET nombre = 'Excellence Riviera Cancun',    latitud = 20.8755, longitud = -86.8664 WHERE id = 5;
UPDATE hotel SET nombre = 'Grand Hyatt Playa del Carmen', latitud = 20.6305, longitud = -87.0671 WHERE id = 6;
UPDATE hotel SET nombre = 'Paradisus Playa del Carmen',   latitud = 20.6472, longitud = -87.0567 WHERE id = 7;
UPDATE hotel SET nombre = 'Azulik Tulum',                 latitud = 20.1790, longitud = -87.4454 WHERE id = 8;

-- Hoteles del layout de ejemplo: mismo nombre (el importador los busca por
-- nombre), solo coordenadas aproximadas del hotel (OpenStreetMap).
UPDATE hotel SET latitud = 21.2902, longitud = -86.8183 WHERE id = 10 AND nombre = 'Planet Hollywood Cancun';
UPDATE hotel SET latitud = 21.2656, longitud = -86.8161 WHERE id = 11 AND nombre = 'TRS Coral Hotel';
UPDATE hotel SET latitud = 20.6739, longitud = -87.0240 WHERE id = 12 AND nombre = 'Grand Velas Riviera Maya';
UPDATE hotel SET latitud = 20.5895, longitud = -87.1101 WHERE id = 13 AND nombre = 'Hotel Xcaret Arte';
UPDATE hotel SET latitud = 20.4907, longitud = -87.2381 WHERE id = 14 AND nombre = 'Barceló Maya Palace';
UPDATE hotel SET latitud = 21.0675, longitud = -86.7784 WHERE id = 15 AND nombre = 'Iberostar Selection Cancun';
UPDATE hotel SET latitud = 21.0894, longitud = -86.7699 WHERE id = 16 AND nombre = 'Hard Rock Hotel Cancun';
UPDATE hotel SET latitud = 20.9883, longitud = -86.8285 WHERE id = 17 AND nombre = 'Moon Palace Sunrise';

COMMIT;
