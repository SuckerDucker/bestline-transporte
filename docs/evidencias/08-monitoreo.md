# 08 · Monitoreo del día e incidencias (Fase 13)

## Caso de uso y requerimientos

| Clave | Caso de uso | Qué cubre en esta fase |
|---|---|---|
| **CU por confirmar** | Monitorear los servicios del día | Tablero del rol AUTORIZADO con totales por estado, filtros, servicios retrasados y cambio de estado |
| **CU por confirmar** | Registrar una incidencia | Incidencia sobre un servicio (retraso, falla mecánica, pasajero no se presentó, cambio de hora u otro) |
| **CU por confirmar** | Consultar y actualizar mi rol (operador) | Servicios del operador del día con "Iniciar", "Pasajeros a bordo" y "Completar" |

Las claves de caso de uso y de requerimiento no están en el repositorio; hay que tomarlas de la memoria.

## Qué se hizo

Se implementó el monitoreo de la operación del día. Cuando el rol está AUTORIZADO, la pantalla *Monitoreo* muestra cada servicio asignado con su unidad, operador, hora, origen → destino, pasajeros y estado, y los totales por estado. Se puede filtrar por estado o por unidad, y los servicios cuya hora ya pasó y siguen PROGRAMADO se resaltan como retrasados. El supervisor, el coordinador y el administrador cambian el estado de cada servicio según una tabla de transiciones y registran incidencias en un diálogo; la pantalla se actualiza sola cada 30 s. El operador entra a *Mi rol* desde el celular, ve sus servicios en orden y los avanza con "Iniciar", "Pasajeros a bordo" y "Completar". La API guarda la hora real de inicio y de término y registra cada cambio en la bitácora.

## Tabla de transiciones (para la memoria)

| Desde | Hacia | Quién | Efecto |
|---|---|---|---|
| PROGRAMADO | EN_RUTA (va hacia la recogida) | ADMINISTRADOR, COORDINADOR, SUPERVISOR y OPERADOR (solo en sus servicios) | Guarda `inicio_real` |
| EN_RUTA | EN_SERVICIO (pasajeros a bordo) | ADMINISTRADOR, COORDINADOR, SUPERVISOR y OPERADOR (solo en sus servicios) | — |
| EN_SERVICIO | COMPLETADO | ADMINISTRADOR, COORDINADOR, SUPERVISOR y OPERADOR (solo en sus servicios) | Guarda `termino_real` |
| PROGRAMADO, EN_RUTA o EN_SERVICIO | CANCELADO | ADMINISTRADOR, COORDINADOR, SUPERVISOR | — |
| PROGRAMADO, EN_RUTA o EN_SERVICIO | NO_SHOW (el pasajero no se presentó) | ADMINISTRADOR, COORDINADOR, SUPERVISOR | — |
| COMPLETADO, CANCELADO, NO_SHOW | — | Nadie | Estados finales |

- Cualquier otra transición responde **400** con el mensaje "No se puede pasar de X a Y".
- El OPERADOR que pide CANCELADO o NO_SHOW, o que actúa sobre un servicio que no es suyo, recibe **403**.
- **INCIDENCIA no se usa como estado.** La incidencia es un registro en la tabla `incidencia` y el servicio conserva su estado.
- PENDIENTE pasa a PROGRAMADO solo al autorizar el rol (Fase 11).

## Cómo se hizo

- **Migración** `20261119230000_monitoreo_estados_horas_usuario_operador`, aprobada por el alumno:
  - valor `NO_SHOW` en el enum `EstadoServicio`;
  - `servicio.inicio_real` y `servicio.termino_real` (timestamptz, nulas);
  - `operador.usuario_id` (FK a `usuario`, nula y única), que liga al operador con su usuario para *Mi rol*.
- **La base de desarrollo no se reinició.**
  - La migración se aplicó con `npx prisma migrate deploy`.
  - El script `apps/api/prisma/actualizaciones/2026-11-20-usuario-operador.sql` ligó `operador@bestline.local` (id 6) con el operador 01, José Hernández (BL-01), con un UPDATE por id.
  - El seed hace lo mismo.
- **Tabla de transiciones como función pura** (`monitoreo/transiciones.ts`): `validarTransicion(desde, hacia, rol)` revisa primero el permiso del rol (403) y después la tabla (400), y `horasReales` dice qué hora se guarda. La web usa una copia de la tabla solo para mostrar las acciones posibles; la API decide.
- **Cambio de estado** (`monitoreo.service.ts`):
  - 404 si el servicio no existe y 400 si no está en un rol AUTORIZADO.
  - Si el usuario es OPERADOR, primero se revisa que el servicio sea suyo; así no se le revela el estado de un servicio ajeno.
  - La actualización es condicional al estado leído (`updateMany` con `estado` en el `where`). Si otro usuario lo cambió entre la lectura y la escritura, responde **409** y no pisa el cambio.
  - El cambio y la bitácora van en la misma transacción. Ejemplo: `CAMBIAR_ESTADO: NEX-0012: PROGRAMADO → EN_RUTA · nota`, recortado a 255 caracteres.
- **Retrasado:** la hora del servicio ya pasó y sigue PROGRAMADO. Se calcula en la API con la hora del servidor.
- **Incidencias:** `incidencia.tipo` sigue siendo texto; los 5 tipos se validan en el DTO y la descripción se recorta. Se registran en la bitácora con `CREAR` y entidad `incidencia`.
- **Web:**
  - *Monitoreo* (`/monitoreo/:fecha`): tarjetas por estado que también filtran, tabla en escritorio y tarjetas en celular, badge de color por estado (EN_SERVICIO tiene un tono violeta nuevo), fila resaltada si va retrasado y menú con solo las transiciones válidas.
  - CANCELADO y NO_SHOW piden confirmación. El diálogo "Registrar incidencia" usa React Hook Form + Zod.
  - TanStack Query vuelve a pedir el tablero y las incidencias cada 30 s (`refetchInterval`) y después de cada cambio.
  - *Mi rol* (`/mi-rol/:fecha`, solo OPERADOR): pensada primero para celular, con un botón grande para el siguiente paso de cada servicio.
- **Pruebas e2e más estables:** `testTimeout` de 30 s, que también aplica al `beforeAll`, y `SET LOCAL lock_timeout = '10s'` al limpiar la base (ver *Problemas y soluciones*).

## Archivos principales

| Archivo | Qué tiene |
|---|---|
| `apps/api/prisma/migrations/20261119230000_…/migration.sql` | NO_SHOW, horas reales y `operador.usuario_id` |
| `apps/api/src/monitoreo/transiciones.ts` | Tabla de transiciones, `validarTransicion` y `horasReales` |
| `apps/api/src/monitoreo/monitoreo.service.ts` | Tablero, mis servicios, cambio de estado (409), incidencias y bitácora |
| `apps/api/src/monitoreo/monitoreo.controller.ts` | Endpoints, permisos y Swagger |
| `apps/api/src/monitoreo/dto/*.ts` | `CambiarEstadoDto` e `IncidenciaDto` (5 tipos) |
| `apps/web/src/features/monitoreo/MonitoreoPage.tsx` | Tablero, filtros, acciones e incidencias del día |
| `apps/web/src/features/monitoreo/MiRolPage.tsx` | Mi rol del operador |
| `apps/web/src/features/monitoreo/DialogoIncidencia.tsx`, `esquema.ts` | Diálogo con React Hook Form + Zod |
| `apps/web/src/features/monitoreo/useAplicarEstado.tsx`, `transiciones.ts` | Cambio de estado con confirmación y acciones posibles |

## Endpoints

Todas las rutas llevan el prefijo `/api` y piden token.

| Método | Ruta | Quién | Respuestas |
|---|---|---|---|
| GET | `/monitoreo/:fecha` | ADMIN, COORD, SUPERVISOR | 200, 400 (fecha), 401, 403, 404 (sin rol autorizado) |
| GET | `/monitoreo/:fecha/mis-servicios` | OPERADOR | 200, 400, 401, 403, 404 (sin rol autorizado o usuario sin operador) |
| GET | `/monitoreo/:fecha/incidencias` | ADMIN, COORD, SUPERVISOR | 200, 400, 401, 403, 404 |
| PATCH | `/monitoreo/servicios/:id/estado` `{estado, nota?}` | ADMIN, COORD, SUPERVISOR; OPERADOR en sus servicios (EN_RUTA, EN_SERVICIO, COMPLETADO) | 200, 400 (transición inválida o rol no autorizado), 401, 403, 404, 409 |
| POST | `/monitoreo/servicios/:id/incidencias` `{tipo, descripcion}` | ADMIN, COORD, SUPERVISOR | 201, 400, 401, 403, 404 |

## Decisiones

| Decisión | Por qué |
|---|---|
| Flujo PROGRAMADO → EN_RUTA → EN_SERVICIO → COMPLETADO; CANCELADO y NO_SHOW desde los tres primeros | Indicado por el alumno al aprobar el plan |
| NO_SHOW como estado y horas reales como columnas (migración) | Aprobado por el alumno; así los indicadores cuentan los no show y las horas se consultan directo |
| `operador.usuario_id` en lugar de buscar al operador por nombre o por correo | Aprobado por el alumno. Un nombre puede repetirse y el operador no tiene correo |
| INCIDENCIA no es un estado | Indicado por el alumno: el servicio conserva su estado y la incidencia es un registro aparte |
| Cambio de estado condicional (409 si cambió mientras tanto) | Varios supervisores y el operador pueden tocar el mismo servicio. Es más sencillo que bloquear la fila, y el tablero se recarga solo |
| Al OPERADOR primero se le revisa que el servicio sea suyo | Así no se le revela el estado de servicios ajenos |
| Solo se muestran los servicios asignados (los no cubiertos ya están en Revisar rol) | El tablero es para dar seguimiento a lo que tiene unidad |
| `/monitoreo` y `/mi-rol` sin fecha abren el día de hoy | Es el día que se monitorea; para los datos de prueba se elige el 10/11 en el selector |

## Problemas y soluciones

| Problema | Solución |
|---|---|
| En una corrida completa de e2e (Fase 12), `revision-rol` falló sus 10 pruebas una vez | Las suites ya corrían en serie (`--runInBand`), todas limpian la base y cierran su app, y no hay escrituras sin `await`. En 3 corridas seguidas (más una con Vitest en paralelo) pasaron 103 de 103. Lo más probable: el `beforeAll` (bcrypt, sesiones y datos) pasó del límite de 5 s de Jest con el equipo cargado; la corrida fallida tardó el doble. Se subió `testTimeout` a 30 s y se puso `lock_timeout` de 10 s al TRUNCATE para que un bloqueo dé un error claro |
| `prisma migrate dev` no corre en una terminal no interactiva | El SQL se generó con `prisma migrate diff` contra la base de desarrollo (al día) y se aplicó con `migrate deploy` |
| En la web, el tipo `Tono` con el nuevo violeta rompía la vista previa de importación | Se agregó el color violeta a sus contadores |
| La prueba del aviso de error no encontraba el toast | La prueba pinta `<Toaster />`, como las de Revisar rol |

## Resultado de las pruebas

| Suite | Resultado | Cobertura |
|---|---|---|
| API unitarias (`npm run test:cov`) | 348 de 348 en 26 suites. Nuevas: `transiciones.spec.ts`, con todas las transiciones válidas e inválidas y los permisos del operador, y `monitoreo.service.spec.ts` | Global 84.4 % de líneas. `transiciones.ts` y `monitoreo.service.ts` al 100 % (el controller se cubre con la e2e) |
| API e2e (`npm run test:e2e`) | 111 de 111 en 15 suites. Nueva: `monitoreo.e2e-spec.ts`, con 8 pruebas: 200, 400 por transición inválida, 403 del operador en un servicio ajeno, 404, 401, flujo completo del operador con horas reales y bitácora, e incidencias | — |
| Web (`npm run test:cov`) | 113 de 113. Nuevas: `MonitoreoPage.test.tsx`, con 10 pruebas de tablero, filtros, menú de transiciones, confirmación, error 400, diálogo con Zod, 404 y Mi rol; y el menú por rol | `features/monitoreo` 92.1 % de líneas |
| Lint y build | API y web sin avisos | — |

## Revisión visual (Playwright, 1440 y 390 px)

Se usó el rol del 10/11, que ya estaba AUTORIZADO, así que no se autorizó ningún rol.
- **Escritorio, como supervisor:**
  - NEX-0029 pasó por Iniciar, Pasajeros a bordo y Completar, y quedó con `inicio_real` y `termino_real`.
  - TUI-0022 quedó en ruta.
  - Se registró una incidencia de retraso en NEX-0017.
  - NEX-0051 quedó como no show, después de la confirmación.
- **Por la API:** EN_RUTA sobre NEX-0029 completado respondió 400 "No se puede pasar de COMPLETADO a EN_RUTA". El operador sobre un servicio ajeno recibió 403 "Solo puedes actualizar tus servicios".
- **Celular:** el tablero y *Mi rol* miden 390 px de ancho, sin desplazamiento horizontal.
- **Operador en /monitoreo:** ve "Tu rol no tiene permiso para ver esta sección".
- No hubo errores de consola.
- **Restauración:** al terminar, la base volvió a la foto previa. Los 41 servicios del rol están en PROGRAMADO sin horas reales, hay 0 incidencias y la bitácora llega otra vez hasta el id 161.

## Capturas (máximo 8, en este orden)

Antes de empezar:
- la API y la web deben estar corriendo;
- el rol del 10/11 debe estar AUTORIZADO, como lo deja la evidencia 06; si no, autorízalo desde *Revisar rol*;
- inicia sesión como SUPERVISOR (`supervisor@bestline.local`).

El 10/11 ya pasó, así que todos sus servicios PROGRAMADO salen como retrasados; es lo esperado.

1. **Tablero.**
   - Abre `http://localhost:5173/monitoreo/2026-11-10`.
   - Deben verse las 7 tarjetas: Programado 41, las demás en 0 y Retrasados 41.
   - También la línea "Actualizado a las … · se actualiza cada 30 s" y la tabla con hora, servicio, unidad, operador, origen → destino, pax, estado y la fila en amarillo con el badge *Retrasado*.
2. **Diálogo de incidencia.**
   - En NEX-0017 (BL-06) abre el menú **⋯** y elige **Registrar incidencia**.
   - Elige *Retraso* y escribe "Vuelo demorado 40 minutos; la unidad espera en CUN".
   - Captura el diálogo lleno antes de guardar; después guarda.
3. **Confirmación de no show.**
   - En NEX-0051 abre **⋯ → Marcar no show**.
   - Captura el diálogo "Marcar no show NEX-0051" y confirma.
4. **Filtro por unidad.**
   - Antes de capturar, en NEX-0029 aplica **⋯ → Iniciar**, luego **Pasajeros a bordo** y luego **Completar**; en TUI-0022 aplica **Iniciar**.
   - En *Unidad* elige **BL-06 · Sprinter**.
   - Deben verse NEX-0029 *Completado* con "inició …", TUI-0022 *En ruta*, NEX-0017 *Retrasado* con "1 incidencia" y NEX-0051 *No se presentó*.
   - Abajo debe verse la incidencia en *Incidencias del día*.
5. **Tablero en celular.**
   - DevTools a 390 px y la misma URL.
   - Deben verse los filtros apilados, las tarjetas en dos columnas y los servicios como tarjetas, sin desplazamiento horizontal.
6. **Mi rol.**
   - Cierra sesión y entra como OPERADOR (`operador@bestline.local`), a 390 px.
   - Abre `http://localhost:5173/mi-rol/2026-11-10`.
   - Deben verse José Hernández, BL-01 · Van, Cita 04:00, "0 de 3 servicios terminados" y TUI-0016, NEX-0003 y TUI-0042 con su botón **Iniciar**.
7. **Mi rol en servicio.**
   - En TUI-0016 pulsa **Iniciar** y luego **Pasajeros a bordo**.
   - La tarjeta debe quedar *En servicio* con el botón **Completar**.
8. **Swagger.**
   - Abre `http://localhost:3000/api/docs#/Monitoreo` y despliega *PATCH /api/monitoreo/servicios/{id}/estado*.
   - Deben verse la descripción de las transiciones y las respuestas 200, 400, 401, 403, 404 y 409 con ejemplo.

### Regresar la base al estado anterior a las capturas

Regresa a PROGRAMADO, sin horas reales, los servicios del rol del 10/11 y borra sus incidencias. No toca el rol, las asignaciones, la importación del 05/11 ni los catálogos. La bitácora se conserva porque es el historial. Todo corre en una sola transacción.

```powershell
@'
BEGIN;
UPDATE servicio SET estado = 'PROGRAMADO', inicio_real = NULL, termino_real = NULL
 WHERE id IN (SELECT a.servicio_id FROM asignacion a JOIN rol_diario r ON r.id = a.rol_id
               WHERE r.fecha = DATE :'fecha' AND r.estado = 'AUTORIZADO');
DELETE FROM incidencia
 WHERE servicio_id IN (SELECT a.servicio_id FROM asignacion a JOIN rol_diario r ON r.id = a.rol_id
                        WHERE r.fecha = DATE :'fecha');
COMMIT;
'@ | docker exec -i bestline-db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v fecha=2026-11-10'
```

Debe responder `UPDATE 41` y `DELETE` con el número de incidencias que se registraron.

## Fragmento de código candidato

`apps/api/src/monitoreo/transiciones.ts` (16 líneas):

```ts
export function validarTransicion(
  desde: EstadoServicio,
  hacia: EstadoServicio,
  rol: RolUsuario,
): ResultadoTransicion {
  if (rol === 'OPERADOR' && !ESTADOS_OPERADOR.includes(hacia)) {
    return rechazo(
      403,
      `El operador no puede marcar un servicio como ${hacia}`,
    );
  }
  if (!(TRANSICIONES[desde] ?? []).includes(hacia)) {
    return rechazo(400, `No se puede pasar de ${desde} a ${hacia}`);
  }
  return { valida: true };
}
```

Primero revisa el permiso del rol: el operador solo puede marcar EN_RUTA, EN_SERVICIO y COMPLETADO (403). Después busca en la tabla `TRANSICIONES` si el estado destino es uno de los permitidos desde el estado actual; si no, responde 400 con un mensaje claro. Es una función pura, por eso se prueba sola con todas las combinaciones.
