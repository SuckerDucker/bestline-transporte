# 05 · Motor de asignación (Fase 9)

## Qué se hizo

Se implementó el motor de asignación (CU-13, CU-14; RF-12, RF-13; RNF-02, RNF-03) siguiendo el algoritmo GenerarRol del Código 1 y la Figura 23 de la memoria. El motor quedó como un conjunto de funciones puras, sin acceso a la base de datos: calcula el inicio efectivo y la liberación de cada servicio, los ordena por inicio, asigna cada uno a la unidad factible de menor costo revisando capacidad, empalme (incluido el traslado en vacío y la salida del encierro a la hora de cita) y jornada, y al final reubica o rechaza los servicios que dejarían a una unidad terminando fuera de una zona de término. Un servicio aparte carga los datos con Prisma, revisa que la matriz de tiempos esté completa y guarda en una sola transacción el rol PROPUESTO, sus asignaciones, los servicios no cubiertos con su motivo y el registro en la bitácora. Para que el motor tuviera unidades, se agregaron al operador el vehículo que maneja y su hora de cita (migración nueva), el encierro base del vehículo pasó a validarse como una zona del catálogo y se agregó el parámetro de penalización por carga. Se probó con pruebas unitarias por regla, un verificador independiente sobre 200 escenarios aleatorios, una prueba de rendimiento y pruebas e2e, incluida la de que un error al guardar no deja nada a medias. En el frontend se agregó la pantalla "Generar rol". Después, en el ajuste fix/turnos-flota, se aplicaron las reglas confirmadas por la empresa (dos bloques de hora de cita de 5 operadores, la flota de 4 Van/Urvan, 5 Sprinter y 1 Autobús, y CAPACIDAD como aviso para contratar una unidad externa) sin cambiar la lógica del motor, y se comparó el resultado antes y después.

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
- **`hora_cita`:** HH:mm, nula. Desde el ajuste `fix/turnos-flota` debe caer dentro del bloque matutino o del vespertino (extremos incluidos; si no, 400) y un operador sin hora de cita no participa en el rol. Antes, si era nula, se usaba `hora_cita.turno_1`.
- **Catálogo de operadores:** recibe `vehiculoId` y `horaCita`. Responde 400 si el vehículo no existe y 409 si ya tiene operador. La pantalla tiene selector de unidad, campo de hora de cita y las columnas "Unidad" y "Hora de cita".
- **Vehículos:** el `encierro_base` debe ser el nombre de una zona del catálogo; si no, responde 400. En la pantalla se elige de una lista.
- **Parámetro nuevo:** `motor.penalizacion_carga_min`, con valor de ejemplo 15 y editable en Parámetros (0 a 120 min).
- **Seed (después del ajuste `fix/turnos-flota`):**
  - Flota confirmada: BL-01 a BL-04 Van (14), BL-05 a BL-09 Sprinter (20) y BL-10 Autobús (45), todas disponibles.
  - El operador *n* maneja el vehículo BL-*n*; los 10 operadores están disponibles.
  - Horas de cita: operadores 1 a 5 a las 04:00, 04:15, 04:30, 04:45 y 05:00; operadores 6 a 10 a las 12:00, 12:15, 12:30, 12:45 y 13:00. Así, el único autobús (BL-10) queda en el bloque vespertino.
  - Encierro "Centro Cancún" para todas las unidades.
  - Los 60 servicios del 10/11 no cambiaron (se comprobó con una huella md5 antes y después del seed).

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

En la bitácora queda `CREAR: 2026-11-10: 23 asignados, 37 no cubiertos, 114 ms`, o `ACTUALIZAR: …` si se reemplazó un rol PROPUESTO.

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

## Reglas confirmadas con la empresa

En el código y en CLAUDE.md están marcadas como "REGLA CONFIRMADA CON LA EMPRESA".

| # | Regla | Dónde está |
|---|---|---|
| 1 | Los 10 operadores se dividen en **dos bloques**: 5 con cita entre 04:00 y 05:00 y 5 entre 12:00 y 13:00. Jornada máxima 9.5 h para todos | Parámetros `hora_cita.bloque_matutino` = "04:00-05:00" y `hora_cita.bloque_vespertino` = "12:00-13:00" (HH:mm-HH:mm, validados en `validarParametro`); la hora de cita del operador debe caer en uno de ellos (`OperadoresService.revisarHoraCita`); seed |
| 2 | **Flota:** 4 Van/Urvan (14), 5 Sprinter (20) y 1 Autobús (45) | Seed (`VEHICULOS`) y prueba de 200 escenarios |
| 3 | Un grupo que no cabe en ninguna unidad disponible se reporta como no cubierto por **CAPACIDAD** para que Monitoreo contrate una unidad externa (es el comportamiento esperado) | Motor sin cambios; la pantalla Generar rol muestra "Requiere unidad externa (Monitoreo)" bajo el motivo |

La migración `20261109234556_bloques_hora_cita` solo cambia datos: convierte `hora_cita.turno_1` y `hora_cita.turno_2` en los dos bloques, sin tocar el esquema.

## Supuestos por confirmar con la empresa

| # | Supuesto | Dónde se cambia |
|---|---|---|
| 1 | El **encierro base** es una zona del catálogo y todas las unidades salen de **Centro Cancún** | Seed (`ENCIERRO_BASE`) y catálogo de vehículos |
| 2 | La **hora exacta** de cada operador dentro de su bloque y qué vehículo maneja cada uno son de ejemplo (por eso el autobús quedó en el bloque vespertino) | Catálogo de operadores |
| 3 | La **penalización por carga** de 15 min es de ejemplo | Parámetros (`motor.penalizacion_carga_min`) |
| 4 | Los extremos de cada bloque son válidos (05:00 y 13:00 entran) | `OperadoresService.revisarHoraCita` |

## Resultados reales

Generados desde la pantalla con la base de desarrollo, **después** del ajuste (bloques y flota confirmados). No se cambió ningún dato ni parámetro para mejorar el resultado.

| Día | Servicios | Asignados | No cubiertos | Por motivo | Unidades usadas | Tiempo |
|---|---|---|---|---|---|---|
| 10/11/2026 (seed) | 60 | 23 | 37 | EMPALME 21, ZONA_TERMINO 11, CAPACIDAD 5, JORNADA 0 | 9 de 10 | 114 ms la primera vez; 11 ms al regenerar |
| 05/11/2026 (archivo de ejemplo importado) | 58 | 33 | 25 | ZONA_TERMINO 13, EMPALME 11, JORNADA 1, CAPACIDAD 0 | 9 de 10 | 14 ms |

Por franja horaria (hora del servicio en Cancún: mañana antes de las 12:00, mediodía de 12:00 a 14:59, tarde de 15:00 a 18:59 y noche desde las 19:00), asignados sobre servicios y no cubiertos por motivo:

| Día | Mañana | Mediodía | Tarde | Noche |
|---|---|---|---|---|
| 10/11 | 15 de 31 (EMPALME 10, CAPACIDAD 3, ZONA 3) | 1 de 9 (EMPALME 5, ZONA 2, CAPACIDAD 1) | 7 de 15 (ZONA 6, CAPACIDAD 1, EMPALME 1) | 0 de 5 (EMPALME 5) |
| 05/11 | 13 de 23 (EMPALME 5, ZONA 5) | 4 de 7 (ZONA 3) | 13 de 20 (EMPALME 5, ZONA 2) | 3 de 8 (ZONA 3, EMPALME 1, JORNADA 1) |

Servicios por unidad:
- 10/11: BL-01 3, BL-02 2, BL-03 3, BL-04 5, BL-05 2, BL-06 2, BL-07 2, BL-08 1, BL-09 0 y BL-10 3.
- 05/11: BL-01 0, BL-02 3, BL-03 3, BL-04 4, BL-05 3, BL-06 5, BL-07 5, BL-08 4, BL-09 4 y BL-10 2.

Los dos roles guardados se revisaron después con el verificador independiente, leyendo las filas de la base: **0 violaciones**, y cada servicio del día aparece una sola vez.

Lectura de los números (sin cambiar datos):
- **JORNADA casi desaparece** (16 → 0 y 29 → 1): el bloque vespertino cubre la tarde.
- **La mañana del 10/11 baja de 22 a 15 asignados**: antes había 9 unidades con cita temprana y ahora solo 5. Los servicios de la mañana que esas 5 no alcanzan salen por EMPALME, porque las unidades del bloque vespertino no empiezan hasta las 12:00.
- **CAPACIDAD (5 el 10/11)**: son grupos de más de 20 pasajeros. El único autobús está en el bloque vespertino, así que los grupos de la mañana no tienen unidad; por la regla confirmada 3 se reportan para una unidad externa.
- **ZONA_TERMINO** sigue alto: la regla quita el último servicio de una unidad que termina fuera de CUN o de la Zona Hotelera, y solo lo reubica entre dos servicios de otra unidad.
- **La noche del 10/11 (0 de 5)** sale por EMPALME: a esa hora las unidades vespertinas ya están ocupadas o lejos del origen.

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
| **Antes del ajuste**, con un solo bloque de cita de 04:00 a 05:00 para todos los operadores y una flota de 5 Van, 3 Sprinter y 2 Autobús (uno en mantenimiento), el motor cubría solo 22 de 60 (10/11) y 23 de 58 (05/11) servicios: **ningún servicio de la tarde ni de la noche** quedaba asignado, por JORNADA (16 y 29) | **Después del ajuste** (`fix/turnos-flota`), con los datos confirmados por la empresa (dos bloques de 5 operadores; 4 Van/Urvan, 5 Sprinter y 1 Autobús) y sin cambiar la lógica del motor: 23 de 60 y 33 de 58. JORNADA baja a 0 y 1, y la tarde pasa de 0 a 7 (10/11) y de 0 a 13 (05/11) asignados. Ver la tabla siguiente |
| `prisma migrate dev` no sirve para una migración solo de datos | Se escribió el SQL a mano (`UPDATE` de las claves, protegido para no chocar con el índice único) y se aplicó con `prisma migrate deploy` |

Comparación por franja horaria (asignados sobre servicios del día):

| Día | Franja | Antes del ajuste | Después del ajuste |
|---|---|---|---|
| 10/11 | Mañana | 22 de 31 | 15 de 31 |
| 10/11 | Mediodía | 0 de 9 | 1 de 9 |
| 10/11 | Tarde | 0 de 15 | 7 de 15 |
| 10/11 | Noche | 0 de 5 | 0 de 5 |
| 10/11 | **Total** | **22 de 60** (CAPACIDAD 8, EMPALME 6, JORNADA 16, ZONA 8) | **23 de 60** (CAPACIDAD 5, EMPALME 21, JORNADA 0, ZONA 11) |
| 05/11 | Mañana | 20 de 23 | 13 de 23 |
| 05/11 | Mediodía | 3 de 7 | 4 de 7 |
| 05/11 | Tarde | 0 de 20 | 13 de 20 |
| 05/11 | Noche | 0 de 8 | 3 de 8 |
| 05/11 | **Total** | **23 de 58** (JORNADA 29, ZONA 6) | **33 de 58** (EMPALME 11, JORNADA 1, ZONA 13) |

Las cifras "antes" se midieron con el código y el seed de `main` antes de este ajuste (coinciden con las de la Fase 9).

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

- **API, unitarias** (`npm run test:cov`): 19 suites y 249 pruebas aprobadas (233 al cerrar la Fase 9; antes de la fase, 183).
  - Ajuste de turnos: bloques HH:mm-HH:mm en `validarParametro` (válidos, una sola hora, inicio igual o posterior al fin, horas inválidas), hora de cita del operador dentro de un bloque (04:00, 05:00, 12:00 y 13:00 válidas; 03:59, 05:01, 08:00, 11:59 y 13:01 rechazadas), operador sin hora de cita que no participa y bloques faltantes.
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
- **Verificador independiente con 200 escenarios aleatorios** (semilla fija; 60 a 75 servicios y 10 unidades por escenario, con la flota confirmada y los dos bloques de hora de cita): 13 559 servicios y **0 violaciones**.
  - 3 688 servicios asignados.
  - No cubiertos: 3 998 EMPALME, 3 361 CAPACIDAD, 1 954 ZONA_TERMINO, 558 JORNADA y 0 SIN_UNIDAD. Así, todas las reglas se ponen a prueba.
  - Antes del ajuste (un solo bloque de 04:00 a 05:00): 3 098 asignados y 4 005 JORNADA.
- **Rendimiento (RNF-02):**
  - Solo el motor, con 75 servicios y 10 unidades: **0.87 ms**.
  - En la API, con la carga de datos: 114 ms la primera vez y 11–14 ms después.
  - Todo muy por debajo del límite de 1 minuto.
- **Cobertura API:**
  - Total: **81.58 % de sentencias, 69.25 % de ramas, 75.56 % de funciones y 81.52 % de líneas** (81.25 % al cerrar la Fase 9; antes de la fase, 78.2 %).
  - `reglas.ts` al 100 % y `operadores.service.ts` al 98 % de líneas.
  - Módulo `motor`: **96.24 % de sentencias y 97.34 % de líneas**, con `algoritmo.ts` al 100 %. `roles.service.ts` al 100 % de líneas.
- **API, e2e** (`npm run test:e2e`): 12 suites y 86 pruebas aprobadas (85 al cerrar la Fase 9; antes de la fase, 70). Incluye un operador sin hora de cita que no participa en el rol, la hora fuera de bloque (400) y el extremo 13:00 válido.
  - Roles:
    - generar (201): 5 servicios, 3 asignados, 2 no cubiertos (CAPACIDAD y JORNADA) y los servicios siguen PENDIENTE;
    - lo guardado pasa el verificador independiente;
    - consulta agrupada por unidad y no cubiertos;
    - regenerar un PROPUESTO sin duplicar;
    - si falla el guardado no queda nada a medias: se fuerza un error en la bitácora, al reemplazar y al crear, y la base queda igual;
    - 400 sin servicios y por fecha inválida, 404, 403 para SUPERVISOR y OPERADOR, 401 y 409 con un rol AUTORIZADO.
  - Operadores: 201 con vehículo y hora, 409, 400 (vehículo inexistente, hora mal escrita o fuera de bloque) y quitar el vehículo con null.
  - Vehículos: 400 por encierro inválido.
- **Web** (`npm run test:cov`, Vitest): 12 archivos y 74 pruebas aprobadas (antes 10 y 63).
  - Generar rol: resumen y no cubiertos con su motivo (CAPACIDAD con la nota "Requiere unidad externa (Monitoreo)"), aviso y confirmación al reemplazar, AUTORIZADO bloqueado y error de la API.
  - Parámetros: bloques HH:mm-HH:mm con el inicio antes que el fin.
  - Formulario de operador: unidad y hora de cita.
  - Vehículo: encierro elegido entre las zonas.
  - Menú: "Generar rol" solo para ADMINISTRADOR y COORDINADOR.
- **Web, cobertura**: **45.53 % de sentencias y 46.6 % de líneas** (antes de la fase 40.98 / 41.99); `GenerarRolPage.tsx` al 97 %.
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
2. En `apps/api`, `npx prisma migrate deploy` (aplica `operador_vehiculo_hora_cita` y `bloques_hora_cita`), `npx prisma db seed` y `npm run start:dev`. Si ya tenías la API corriendo de antes, deténla y arráncala otra vez para que cargue el módulo de roles.
3. En `apps/web`, `npm run dev`.
4. Entra como `coordinador@bestline.local`.
5. Para la captura 4 hace falta haber importado `docs/ejemplos/Layout_Servicios_Nexus.xlsx` con Nexus Tours (Fase 8).

**Pantallas (http://localhost:5173)**

1. **Operadores con unidad.** Entra a Catálogos → Operadores. Deben verse las columnas "Unidad" (de BL-01 · Van · 14 pax a BL-10 · Autobús · 45 pax) y "Hora de cita": de 04:00 a 05:00 en los operadores 1 a 5 y de 12:00 a 13:00 en los 6 a 10.
2. **Rol del 10/11.** Entra a Operación → Generar rol, elige el 10/11/2026 y pulsa "Generar rol". Deben verse:
   - el aviso verde "Rol generado";
   - las tarjetas: 60 servicios del día, 23 asignados, 37 no cubiertos, 9 de 10 unidades usadas y el tiempo en ms;
   - la tabla de no cubiertos con su Badge de motivo y el conteo por motivo arriba a la derecha; en cada CAPACIDAD, la nota "Requiere unidad externa (Monitoreo)".
3. **Reemplazo de un rol PROPUESTO.** Cambia a otra fecha y regresa al 10/11. Debe verse el aviso ámbar "Ya existe un rol PROPUESTO de este día…". Pulsa "Generar rol" y captura el diálogo "¿Reemplazar el rol PROPUESTO?".
4. **Rol del día del archivo de ejemplo.** Elige el 05/11/2026 y genera. Deben verse 58 servicios del día, 33 asignados y 25 no cubiertos (Zona de término 13, Empalme 11, Jornada 1).

**API en Swagger (http://localhost:3000/api/docs, con el token del coordinador en Authorize)**

5. **Generar.** En `POST /api/roles/generar` elige el ejemplo "Día del seed" y "Execute". Debe verse el 201 con `reemplazado: true` y el `resumen` (60 / 23 / 37, `porMotivo` y `tiempoMs`).
6. **No cubiertos.** En `GET /api/roles/{fecha}/no-cubiertos` con `2026-11-10`, "Execute". Debe verse el 200 con cada servicio y su `motivo`.
7. **Sin servicios (400).** En `POST /api/roles/generar` escribe `{ "fecha": "2026-12-25" }`. Debe verse el 400 "No hay servicios PENDIENTE el 2026-12-25".

**Pruebas (terminal, en `apps/api` y `apps/web`)**

8. **Verificador y rendimiento.** En `apps/api`, `npm test -- motor`. Deben verse "Tests: 27 passed" y las líneas impresas "200 escenarios: 13559 servicios, 3688 asignados, no cubiertos {…}" y "Rendimiento: 75 servicios y 10 unidades en … ms".
9. **API con cobertura.** En `apps/api`, `npm run test:cov`. Deben verse "Tests: 249 passed", la fila "All files" (81.58 %) y la fila `src/motor` (96.24 %).
10. **Web con cobertura.** En `apps/web`, `npm run test:cov`. Deben verse "Tests 74 passed (74)" y la fila "All files" (45.53 %), con `GenerarRolPage.tsx`.

Al terminar, para regresar la base al estado del seed (cambia `<usuario_bd>` por el de tu `.env`):

```bash
docker compose exec db psql -U <usuario_bd> -d bestline -c "DELETE FROM asignacion; DELETE FROM servicio_no_cubierto; DELETE FROM rol_diario;"
```
