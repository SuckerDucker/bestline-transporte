# 05 · Motor de asignación (Fase 9)

## Qué se hizo

Se implementó el motor de asignación (CU-13, CU-14; RF-12, RF-13; RNF-02, RNF-03) siguiendo el algoritmo GenerarRol del Código 1 y la Figura 23 de la memoria. El motor quedó como un conjunto de funciones puras, sin acceso a la base de datos: calcula el inicio efectivo y la liberación de cada servicio, los ordena por inicio, asigna cada uno a la unidad factible de menor costo revisando capacidad, empalme (incluido el traslado en vacío y la salida del encierro a la hora de cita) y jornada, y al final reubica o rechaza los servicios que dejarían a una unidad terminando fuera de una zona de término. Un servicio aparte carga los datos con Prisma, revisa que la matriz de tiempos esté completa y guarda en una sola transacción el rol PROPUESTO, sus asignaciones, los servicios no cubiertos con su motivo y el registro en la bitácora. Para que el motor tuviera unidades, se agregaron al operador el vehículo que maneja y su hora de cita (migración nueva), el encierro base del vehículo pasó a validarse como una zona del catálogo y se agregó el parámetro de penalización por carga. Se probó con pruebas unitarias por regla, un verificador independiente sobre 200 escenarios aleatorios, una prueba de rendimiento y pruebas e2e, incluida la de que un error al guardar no deja nada a medias. En el frontend se agregó la pantalla "Generar rol".

## Correspondencia con el pseudocódigo

Archivo: `apps/api/src/motor/algoritmo.ts` (funciones puras) y `apps/api/src/roles/roles.service.ts` (carga y guardado).

| Línea del pseudocódigo (Código 1 / Figura 23) | Dónde se implementa |
|---|---|
| `PARA CADA s: s.inicio ← s.hora − anticipación(s.modalidad)` | `calcularHoras` |
| `s.liberación ← s.hora + tiempo(s.origen, s.destino)` | `calcularHoras` (con `p.tiempo`, que sale de la matriz: `crearTiempo`) |
| `ordenar servicios por s.inicio de menor a mayor` | `generarRol`: `calcularHoras(...).sort((a, b) => a.inicio - b.inicio)` |
| Disponibilidad: la unidad no participa si no está DISPONIBLE o su operador no lo está | `generarRol`: `unidades.filter((u) => u.disponible)`; el valor lo arma `RolesService.cargarDatos` (vehículo DISPONIBLE y operador disponible; sin operador no entra) |
| `factibles ← { u EN unidades \| VerificarRestricciones(u, s) }` | `generarRol` llama a `verificarRestricciones` para cada unidad |
| `VerificarRestricciones`: CAPACIDAD, EMPALME, JORNADA (en ese orden) | `verificarRestricciones`; la posición de la unidad (encierro a la hora de cita, o destino y liberación del servicio anterior) sale de `posicion` |
| `SI factibles está vacío → agregar (s, motivo) a noCubiertos` | `generarRol` + `motivoPorMayoria` (la restricción con más rechazos); `SIN_UNIDAD` si no hay unidades disponibles |
| `SI NO → u ← unidad de factibles con menor Costo(u, s)` | `costo` (espera + vacío + penalización por carga); empate con `porNumeroEconomico` |
| `agregar s al final de la secuencia de u` | `generarRol`: `elegida.secuencia.push(s)` |
| `PARA CADA u: MIENTRAS el último servicio de u termina fuera de zona válida: s ← quitar el último` | `reubicarPorZonaTermino` |
| `SI s no cabe entre dos servicios de otra unidad → (s, ZONA_TERMINO)` | `mejorHueco` (busca el hueco); si no hay, `reubicarPorZonaTermino` lo agrega como ZONA_TERMINO |
| `guardar rol y noCubiertos en una sola transacción` | `RolesService.generar`: `prisma.$transaction` con `rol_diario`, `asignacion`, `servicio_no_cubierto` y bitácora |
| `REGRESAR rol, noCubiertos` | `generarRol` devuelve `{ unidades, noCubiertos }`; el endpoint responde el rol y el resumen |

## Cambio al modelo (autorizado)

Migración `20261109214005_operador_vehiculo_hora_cita`:

```sql
ALTER TABLE "operador" ADD COLUMN "hora_cita" VARCHAR(5), ADD COLUMN "vehiculo_id" INTEGER;
CREATE UNIQUE INDEX "operador_vehiculo_id_key" ON "operador"("vehiculo_id");
ALTER TABLE "operador" ADD CONSTRAINT "operador_vehiculo_id_fkey" FOREIGN KEY ("vehiculo_id") REFERENCES "vehiculo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- **`vehiculo_id`:** nula y única, porque un vehículo solo puede tener un operador. Un operador sin vehículo no participa en el rol.
- **`hora_cita`:** HH:mm, nula. Si es nula se usa el parámetro `hora_cita.turno_1`.
- **Catálogo de operadores:** recibe `vehiculoId` y `horaCita`. Responde 400 si el vehículo no existe y 409 si ya tiene operador. La pantalla tiene selector de unidad, campo de hora de cita y las columnas "Unidad" y "Hora de cita".
- **Vehículos:** el `encierro_base` debe ser el nombre de una zona del catálogo; si no, responde 400. En la pantalla se elige de una lista.
- **Parámetro nuevo:** `motor.penalizacion_carga_min`, con valor de ejemplo 15 y editable en Parámetros (0 a 120 min).
- **Seed:**
  - El operador *n* maneja el vehículo BL-*n*.
  - Horas de cita: 04:00, 04:00, 04:15, 04:15, 04:30, 04:30, 04:45, 04:45, 05:00 y 05:00.
  - Encierro "Centro Cancún" para todas las unidades.
  - BL-10 (en mantenimiento) y su operador (no disponible) no participan, así que el rol usa 9 unidades.

## Endpoints

Todas las rutas llevan el prefijo `/api` y exigen `Authorization: Bearer <token>`.

| Método | Ruta | Quién | Descripción | Respuestas |
|---|---|---|---|---|
| POST | `/roles/generar` | ADMINISTRADOR, COORDINADOR | `{ fecha }`. Genera el rol con los servicios PENDIENTE del día y lo guarda en una transacción. Reemplaza un PROPUESTO; los servicios siguen en PENDIENTE | 201, 400, 401, 403, 409 |
| GET | `/roles/:fecha` | ADMINISTRADOR, COORDINADOR, SUPERVISOR | Rol con sus asignaciones agrupadas por unidad (vehículo y operador), en orden, con inicio efectivo y liberación | 200, 400, 401, 403, 404 |
| GET | `/roles/:fecha/no-cubiertos` | ADMINISTRADOR, COORDINADOR, SUPERVISOR | No cubiertos con su motivo (CU-14), ordenados por hora | 200, 400, 401, 403, 404 |
| PATCH | `/operadores/:id` y POST `/operadores` | ADMINISTRADOR | Ahora con `vehiculoId` y `horaCita` | 400 y 409 nuevos |

`POST /roles/generar` responde 400 en estos casos:
- sin servicios PENDIENTE en la fecha;
- falta un parámetro;
- el encierro de una unidad no es una zona;
- la matriz de tiempos no tiene algún par entre las zonas del día (encierros, orígenes y destinos). En este caso la respuesta trae la lista `faltantes`.

En la bitácora queda `CREAR: 2026-11-10: 22 asignados, 38 no cubiertos, 197 ms`, o `ACTUALIZAR: …` si se reemplazó un rol PROPUESTO.

## Decisiones

| Decisión | Por qué |
|---|---|
| Empate en el motivo del no cubierto: gana la que va primero en el orden de verificación (CAPACIDAD, EMPALME, JORNADA) | **Confirmado por el alumno** antes de programar |
| Si un servicio cabe en varios huecos al reubicarlo, se elige el de menor costo (mismo `Costo(u, s)` visto desde el servicio anterior del hueco); empate por número económico y luego el hueco más temprano | **Confirmado por el alumno** |
| La etapa de zona de término recorre las unidades por número económico y solo inserta en unidades que ya terminan en zona válida | **Confirmado por el alumno**; así se cumple "sin dejar a esa unidad terminando fuera de zona válida" |
| Si falta un tiempo en la matriz, 400 antes de generar, con los pares faltantes | **Confirmado por el alumno** |
| Las horas se manejan en minutos desde las 00:00 de Cancún del día del rol | Las funciones puras quedan simples y fáciles de probar a mano; `roles/conversion.ts` convierte a fechas UTC al cargar y al guardar |
| Servicios con el mismo inicio conservan el orden en que llegan (hora y luego id) | El pseudocódigo solo dice "ordenar por inicio"; el ordenamiento de JavaScript es estable, así que el resultado es reproducible sin agregar una regla |
| Desempate por número económico con comparación numérica (`BL-2` antes que `BL-12`) | Comparar texto pondría `BL-12` antes que `BL-2` |
| El tiempo de generación mide la carga de datos y el motor (no el guardado) | Se registra dentro de la misma transacción, así que debe conocerse antes de guardar |
| Un solo registro de bitácora por generación, con los números | Igual que la importación: el detalle está en las tablas del rol |
| Al reemplazar un PROPUESTO se borran sus asignaciones y no cubiertos y se actualiza el mismo `rol_diario` | `rol_diario.fecha` es única; todo ocurre en la misma transacción |
| El verificador independiente (`motor/verificador.ts`) no importa nada de `algoritmo.ts` | Recalcula las horas desde la matriz y revisa cada regla por su cuenta; si compartiera código, un error del motor pasaría también por el verificador |

## Supuestos por confirmar con la empresa

| # | Supuesto | Dónde se cambia |
|---|---|---|
| 1 | El **encierro base** es una zona del catálogo y todas las unidades salen de **Centro Cancún** | Seed (`ENCIERRO_BASE`) y catálogo de vehículos |
| 2 | Las **horas de cita** por operador (04:00 a 05:00) son de ejemplo | Catálogo de operadores |
| 3 | La **penalización por carga** de 15 min es de ejemplo | Parámetros (`motor.penalizacion_carga_min`) |
| 4 | Cada operador tiene **un solo turno al día**: la jornada de 9.5 h desde una cita de 04:00 a 05:00 termina entre las 13:30 y las 14:30, así que ningún servicio que libere después puede asignarse (ver los resultados reales). Si la empresa tiene un segundo turno por la tarde o asigna los turnos por día, hay que confirmarlo; CLAUDE.md ya lo marca como pendiente | Regla de jornada y datos de operadores |

## Resultados reales

Generados desde la pantalla con la base de desarrollo:

| Día | Servicios | Asignados | No cubiertos | Por motivo | Unidades usadas | Tiempo |
|---|---|---|---|---|---|---|
| 10/11/2026 (seed) | 60 | 22 | 38 | JORNADA 16, CAPACIDAD 8, ZONA_TERMINO 8, EMPALME 6 | 9 de 9 | 197 ms la primera vez; 12 ms al regenerar |
| 05/11/2026 (archivo de ejemplo importado) | 58 | 23 | 35 | JORNADA 29, ZONA_TERMINO 6 | 8 de 9 | 13 ms |

Los dos roles guardados se revisaron después con el verificador independiente, leyendo las filas de la base: **0 violaciones**, y cada servicio del día aparece una sola vez.

Por qué hay tantos no cubiertos:
- **JORNADA:** la causa principal es el supuesto 4. En el archivo de ejemplo, 29 de 35 son JORNADA porque la mayoría de sus servicios son por la tarde.
- **ZONA_TERMINO:** cuando la tarde no se puede cubrir, varias unidades se quedan con un último servicio de la mañana que termina fuera de CUN o de la Zona Hotelera, y la regla lo quita.
- **CAPACIDAD:** los grupos de más de 20 pasajeros solo caben en el autobús BL-09; cuando está ocupado, las otras 8 unidades los rechazan por capacidad, y por mayoría ese es el motivo que se registra.

El motor cumple exactamente las reglas; los números cambiarán con los datos reales de turnos y encierros.

## Problemas que surgieron y cómo se resolvieron

| Problema | Solución |
|---|---|
| `prisma migrate dev` se negó a crear la migración en modo no interactivo | Se generó el SQL con `prisma migrate diff --from-config-datasource --to-schema`, se revisó y se aplicó con `prisma migrate deploy` |
| Con la regla nueva, `validarParametro` (fragmento de la Fase 7) pasaba de 20 líneas | La condición de minutos se movió a `esMinutos`; la función queda en 19 líneas y se actualizó su copia en `03-parametros-usuarios.md` |
| Al escribir algunos archivos desde scripts se perdían las `\` de las expresiones regulares | Se corrigieron y se comprobó con `git diff` que la del teléfono quedó igual; desde entonces esos archivos se escriben directo |
| Varias expectativas de mis pruebas estaban mal calculadas (unidad de menor costo, horas UTC) | Se recalcularon a mano; los comentarios de las pruebas dejan la cuenta |
| En los 200 escenarios puse una condición inventada ("se asigna más de la mitad") que falló | No es una regla del sistema: se quitó y en su lugar la prueba imprime el desglose por motivo |
| La prueba de la pantalla de vehículos dejaba en espera "la última petición", que ahora era la de zonas | La API simulada responde por ruta |
| En la revisión en el navegador el puerto 3000 estaba ocupado por otra API (sin el módulo de roles) | No se detuvo; la revisión usó la API en el puerto 3001 y Vite con `VITE_API_URL` |
| El catálogo de operadores no tenía pruebas en el frontend | Se agregaron pruebas de Vitest del formulario (unidad y hora de cita) |

## Función destacada

`apps/api/src/motor/algoritmo.ts`

```ts
export function verificarRestricciones(
  u: UnidadEnRol,
  s: ServicioCalculado,
  p: ParametrosMotor,
): Restriccion | null {
  if (s.pasajeros > u.capacidad) return 'CAPACIDAD';
  // Primer servicio: sale del encierro a la hora de cita del operador.
  const { zona, libre } = posicion(u);
  if (libre + p.tiempo(zona, s.origen) > s.inicio) return 'EMPALME';
  if (s.liberacion - u.cita > p.jornadaMaxima) return 'JORNADA';
  return null;
}
```

Revisa si la unidad `u` puede tomar el servicio `s` y devuelve la primera restricción que falla, en el orden del pseudocódigo: CAPACIDAD, EMPALME y JORNADA.
Para EMPALME toma dónde y desde cuándo está libre la unidad (el destino y la liberación de su último servicio, o su encierro a la hora de cita) y le suma el traslado en vacío hasta el origen de `s`.
Si nada falla devuelve null y la unidad es factible; el motivo del no cubierto se elige después por mayoría entre todas las unidades.

## Resultado de las pruebas

- **API, unitarias** (`npm run test:cov`): 19 suites y 233 pruebas aprobadas (antes 16 y 183).
  - Motor, un caso por regla:
    - cálculo de horas y orden por inicio, no por hora;
    - CAPACIDAD;
    - primer servicio desde el encierro a la hora de cita;
    - EMPALME con traslado en vacío;
    - JORNADA;
    - costo;
    - unidad no disponible;
    - SIN_UNIDAD;
    - motivo por mayoría y su empate;
    - elección por menor costo;
    - penalización de carga (con 0 la misma unidad hace los dos servicios; con 100 se reparten);
    - desempate BL-2 antes que BL-12;
    - zona de término: reubicada, no cubierta, varios servicios quitados, no insertar en unidades que terminan fuera y hueco de menor costo;
    - matriz incompleta.
  - Verificador: detecta servicios repetidos o faltantes, CAPACIDAD, EMPALME, JORNADA, ZONA_TERMINO, unidad no disponible y horas guardadas distintas.
  - `RolesService`: guardado en una transacción, reemplazo de un PROPUESTO, 409, 400 (sin servicios, matriz incompleta con su lista, parámetro faltante, encierro inválido), hora de cita propia y vehículo sin operador, consultas y 404.
  - Catálogos: operadores con vehículo (400, 409, quitarlo con null) y encierro como zona.
- **Verificador independiente con 200 escenarios aleatorios** (semilla fija; 60 a 75 servicios y 10 unidades por escenario): 13 559 servicios y **0 violaciones**.
  - 3 098 servicios asignados.
  - No cubiertos: 4 005 JORNADA, 3 543 CAPACIDAD, 1 754 ZONA_TERMINO, 1 159 EMPALME y 0 SIN_UNIDAD. Así, todas las reglas se ponen a prueba.
- **Rendimiento (RNF-02):**
  - Solo el motor, con 75 servicios y 10 unidades: **0.77 ms**.
  - En la API, con la carga de datos: 197 ms la primera vez y 12–13 ms después.
  - Todo muy por debajo del límite de 1 minuto.
- **Cobertura API:**
  - Total: **81.25 % de sentencias, 68.51 % de ramas, 74.91 % de funciones y 81.25 % de líneas** (antes 78.2 / 65.31 / 68.58 / 78.29).
  - Módulo `motor`: **96.24 % de sentencias y 97.34 % de líneas**, con `algoritmo.ts` al 100 %. `roles.service.ts` al 100 % de líneas.
- **API, e2e** (`npm run test:e2e`): 12 suites y 85 pruebas aprobadas (antes 10 y 70).
  - Roles:
    - generar (201): 5 servicios, 3 asignados, 2 no cubiertos (CAPACIDAD y JORNADA) y los servicios siguen PENDIENTE;
    - lo guardado pasa el verificador independiente;
    - consulta agrupada por unidad y no cubiertos;
    - regenerar un PROPUESTO sin duplicar;
    - si falla el guardado no queda nada a medias: se fuerza un error en la bitácora, al reemplazar y al crear, y la base queda igual;
    - 400 sin servicios y por fecha inválida, 404, 403 para SUPERVISOR y OPERADOR, 401 y 409 con un rol AUTORIZADO.
  - Operadores: 201 con vehículo y hora, 409, 400 y quitar el vehículo con null.
  - Vehículos: 400 por encierro inválido.
- **Web** (`npm run test:cov`, Vitest): 12 archivos y 74 pruebas aprobadas (antes 10 y 63).
  - Generar rol: resumen y no cubiertos con su motivo, aviso y confirmación al reemplazar, AUTORIZADO bloqueado y error de la API.
  - Formulario de operador: unidad y hora de cita.
  - Vehículo: encierro elegido entre las zonas.
  - Menú: "Generar rol" solo para ADMINISTRADOR y COORDINADOR.
- **Web, cobertura**: **45.47 % de sentencias y 46.54 % de líneas** (antes 40.98 / 41.99); `GenerarRolPage.tsx` al 97 %.
- **Build y lint**: sin errores ni avisos en la API y en la web.
- **Revisión en el navegador** (Playwright, escritorio y móvil):
  - generar los dos días;
  - aviso y confirmación al regenerar;
  - SUPERVISOR sin acceso a "Generar rol";
  - móvil sin desborde horizontal;
  - sin errores de React en la consola (solo los 404 esperados de "todavía no hay rol").
- **Base de desarrollo:** al terminar se restauró al estado del seed. Se borraron los roles generados y los registros de bitácora del recorrido; la importación del 05/11 que hizo el alumno se conservó.

## Capturas que se deben tomar

Antes de empezar:

1. En la raíz, `docker compose up -d`.
2. En `apps/api`, `npx prisma migrate deploy` (aplica `operador_vehiculo_hora_cita`), `npx prisma db seed` y `npm run start:dev`. Si ya tenías la API corriendo de antes, deténla y arráncala otra vez para que cargue el módulo de roles.
3. En `apps/web`, `npm run dev`.
4. Entra como `coordinador@bestline.local`.
5. Para la captura 4 hace falta haber importado `docs/ejemplos/Layout_Servicios_Nexus.xlsx` con Nexus Tours (Fase 8).

**Pantallas (http://localhost:5173)**

1. **Operadores con unidad.** Entra a Catálogos → Operadores. Deben verse las columnas "Unidad" (BL-01 · Van · 14 pax…) y "Hora de cita" (04:00 a 05:00); Operador Ejemplo 10 aparece como "No disponible".
2. **Rol del 10/11.** Entra a Operación → Generar rol, elige el 10/11/2026 y pulsa "Generar rol". Deben verse:
   - el aviso verde "Rol generado";
   - las tarjetas: 60 servicios del día, 22 asignados, 38 no cubiertos, 9 de 9 unidades usadas y el tiempo en ms;
   - la tabla de no cubiertos con su Badge de motivo y el conteo por motivo arriba a la derecha.
3. **Reemplazo de un rol PROPUESTO.** Cambia a otra fecha y regresa al 10/11. Debe verse el aviso ámbar "Ya existe un rol PROPUESTO de este día…". Pulsa "Generar rol" y captura el diálogo "¿Reemplazar el rol PROPUESTO?".
4. **Rol del día del archivo de ejemplo.** Elige el 05/11/2026 y genera. Deben verse 58 servicios del día, 23 asignados y 35 no cubiertos, la mayoría por Jornada.

**API en Swagger (http://localhost:3000/api/docs, con el token del coordinador en Authorize)**

5. **Generar.** En `POST /api/roles/generar` elige el ejemplo "Día del seed" y "Execute". Debe verse el 201 con `reemplazado: true` y el `resumen` (60 / 22 / 38, `porMotivo` y `tiempoMs`).
6. **No cubiertos.** En `GET /api/roles/{fecha}/no-cubiertos` con `2026-11-10`, "Execute". Debe verse el 200 con cada servicio y su `motivo`.
7. **Sin servicios (400).** En `POST /api/roles/generar` escribe `{ "fecha": "2026-12-25" }`. Debe verse el 400 "No hay servicios PENDIENTE el 2026-12-25".

**Pruebas (terminal, en `apps/api` y `apps/web`)**

8. **Verificador y rendimiento.** En `apps/api`, `npm test -- motor`. Deben verse "Tests: 27 passed" y las líneas impresas "200 escenarios: 13559 servicios, 3098 asignados, no cubiertos {…}" y "Rendimiento: 75 servicios y 10 unidades en … ms".
9. **API con cobertura.** En `apps/api`, `npm run test:cov`. Deben verse "Tests: 233 passed", la fila "All files" (81.25 %) y la fila `src/motor` (96.24 %).
10. **Web con cobertura.** En `apps/web`, `npm run test:cov`. Deben verse "Tests 74 passed (74)" y la fila "All files" (45.47 %), con `GenerarRolPage.tsx`.

Al terminar, para regresar la base al estado del seed (cambia `<usuario_bd>` por el de tu `.env`):

```bash
docker compose exec db psql -U <usuario_bd> -d bestline -c "DELETE FROM asignacion; DELETE FROM servicio_no_cubierto; DELETE FROM rol_diario;"
```
