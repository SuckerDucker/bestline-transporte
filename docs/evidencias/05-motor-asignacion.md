# 05 · Motor de asignación (Fase 9 y mejora de reinserción)

## Qué se hizo

Se implementó el motor de asignación (CU-13, CU-14; RF-12, RF-13; RNF-02, RNF-03) siguiendo el algoritmo GenerarRol del Código 1 y la Figura 23 de la memoria. El motor quedó como un conjunto de funciones puras, sin acceso a la base de datos: calcula el inicio efectivo y la liberación de cada servicio, los ordena por inicio, asigna cada uno a la unidad factible de menor costo revisando capacidad, empalme (incluido el traslado en vacío y la salida del encierro a la hora de cita) y jornada, y al final reubica o rechaza los servicios que dejarían a una unidad terminando fuera de una zona de término. Un servicio aparte carga los datos con Prisma, revisa que la matriz de tiempos esté completa y guarda en una sola transacción el rol PROPUESTO, sus asignaciones, los servicios no cubiertos con su motivo y el registro en la bitácora. Para que el motor tuviera unidades, se agregaron al operador el vehículo que maneja y su hora de cita (migración nueva), el encierro base del vehículo pasó a validarse como una zona del catálogo y se agregó el parámetro de penalización por carga. Se probó con pruebas unitarias por regla, un verificador independiente sobre 200 escenarios aleatorios, una prueba de rendimiento y pruebas e2e, incluida la de que un error al guardar no deja nada a medias. En el frontend se agregó la pantalla "Generar rol". Después, en el ajuste fix/turnos-flota, se aplicaron las reglas confirmadas por la empresa (dos bloques de hora de cita de 5 operadores, la flota de 4 Van/Urvan, 5 Sprinter y 1 Autobús, y CAPACIDAD como aviso para contratar una unidad externa) sin cambiar la lógica del motor, y se comparó el resultado antes y después. Por último, en el ajuste fix/seed-distribucion, los 60 servicios de ejemplo del 10/11 se repartieron según la distribución diaria confirmada por la empresa (Lic. Magalis Casanova) y se documentó que el autobús trabaja en el bloque vespertino. Finalmente, en la rama feat/motor-reinsercion, se agregó al algoritmo una etapa de reinserción que vuelve a intentar los no cubiertos en cualquier posición de cualquier unidad sin relajar ninguna regla, se aplicó la regla confirmada de zona de término con regreso al encierro, y el seed se ajustó a dos reglas confirmadas más (primer servicio a partir de las 04:45 y solo 2 grupos de más de 20 pasajeros). Con todo junto, el rol del 10/11 pasó de 23 a 41 de 60 servicios asignados y el del 05/11 de 33 a 46 de 58.

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
| `PARA CADA u: MIENTRAS NO CierreVálido(u): s ← quitar el último` | `reubicarPorZonaTermino`, con `cierreValido` |
| `CierreVálido(u)`: el último servicio termina en zona de término, o `liberación + tiempo(destino, encierro) − cita <= jornada máxima` | `cierreValido` (regla confirmada con la empresa); el verificador la revisa por su cuenta |
| `SI s no cabe entre dos servicios de otra unidad → (s, ZONA_TERMINO)` | `mejorHueco` (busca el hueco); si no hay, `reubicarPorZonaTermino` lo agrega como ZONA_TERMINO |
| `REPETIR … HASTA que en una pasada no se inserte ninguno` (reinserción) | `reinsertar` |
| `PARA CADA (s, motivo) EN noCubiertos, por s.inicio` | `reinsertar`: ordena los pendientes por `inicio` |
| `opciones ← posiciones (u, i) donde la secuencia completa cumple VerificarRestricciones en cada servicio y CierreVálido(u)` | `mejorInsercion` recorre todas las unidades y posiciones (incluidas las vacías y la final); `secuenciaValida` reutiliza `verificarRestricciones` sin cambiarla, servicio por servicio contra los anteriores, y luego `cierreValido` |
| `insertar s en la opción de menor costo incremental` | `costoInsercion` (espera + vacío añadido + penalización); empate: menor número económico y luego la posición más temprana |
| `guardar rol y noCubiertos en una sola transacción` | `RolesService.generar`: `prisma.$transaction` con `rol_diario`, `asignacion`, `servicio_no_cubierto` y bitácora |
| `REGRESAR rol, noCubiertos` | `generarRol` devuelve `{ unidades, noCubiertos }`; el endpoint responde el rol y el resumen. `generarRolBase` es el algoritmo sin la reinserción (etapa voraz y de zona de término), para comparar |

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
  - Los 60 servicios del 10/11 no cambiaron en ese ajuste (se comprobó con una huella md5 antes y después del seed).
- **Seed (después del ajuste `fix/seed-distribucion`):** los 60 servicios del 10/11 se regeneraron con el mismo generador de semilla fija y la misma composición (24 llegadas, 24 salidas y 12 traslados; 26 PRIVADO, 23 COMPARTIDO y 11 GRUPO), repartidos según la distribución confirmada:
  - mañana (04:00-11:59): 16 servicios (10 salidas, 3 llegadas y 3 traslados), solo PRIVADO o COMPARTIDO (máximo 12 pasajeros), de 04:10 a 09:50;
  - mediodía y tarde (12:00-18:59): 34 (16 llegadas, 11 salidas y 7 traslados); los 10 grupos de esta franja, a partir de las 13:00;
  - noche (19:00-21:45): 10 (5 llegadas, 3 salidas y 2 traslados), de 19:00 a 21:40;
  - ningún servicio de más de 20 pasajeros antes de las 13:00 (el primero es a las 13:25). El seed lo comprueba al final, junto con que el operador de BL-10 tenga cita en el bloque vespertino (13:00), y se detiene con un error si alguna de las dos reglas no se cumple.
- **Seed (rama `feat/motor-reinsercion`):** misma semilla, misma distribución (16 / 34 / 10) y misma composición por tipo y modalidad, con dos reglas confirmadas más:
  - **primer servicio a partir de las 04:45**: la franja de la mañana va de 04:45 a 11:55 (el primero quedó a las 04:55);
  - **solo 2 grupos de más de 20 pasajeros**, los dos llegadas después de las 13:00 (NEX-0031 a las 15:40 con 30 y TUI-0030 a las 18:20 con 21);
  - los demás servicios llevan de 2 a 12 pasajeros: PRIVADO 2 a 6, COMPARTIDO 4 a 12 y GRUPO 2 a 12;
  - los otros 9 servicios de modalidad GRUPO se quedan como GRUPO, porque la modalidad define la anticipación (30 min). En el archivo de la empresa del 05/11, los 7 servicios GRUPO llevan de 2 a 10 pasajeros;
  - el seed también comprueba que no haya servicios antes de las 04:45, que haya exactamente 2 de más de 20 pasajeros y que los demás estén entre 2 y 12.

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
- la matriz de tiempos no tiene algún par entre las zonas del día (encierros, orígenes y destinos). Esto incluye el tiempo del destino de cada servicio al encierro, que necesita la regla de zona de término. En este caso la respuesta trae la lista `faltantes`.

En la bitácora queda `CREAR: 2026-11-10: 41 asignados, 19 no cubiertos, 120 ms`, o `ACTUALIZAR: …` si se reemplazó un rol PROPUESTO.

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
| La etapa voraz **no** revisa la zona de término; la regla se aplica al revisar cómo cierra cada unidad (etapa de zona de término, reinserción y verificador) | **Confirmado por el alumno**. Así se respeta el Código 1 y `verificarRestricciones` no cambia; además, una unidad todavía puede tomar después un servicio que termine en Zona Hotelera o en el aeropuerto |
| Costo incremental de la reinserción = espera antes de s + vacío añadido (anterior → s → siguiente, menos anterior → siguiente) + penalización × servicios de la unidad | En la última posición es exactamente el `Costo(u, s)` de la etapa voraz. Contar "espera + vacío totales" no sirve: en cualquier hueco intermedio la diferencia siempre es −duración(s) y no distinguiría entre posiciones |
| La reinserción incluye los no cubiertos por CAPACIDAD y por SIN_UNIDAD | Lo pide la mejora (por si el autobús tiene un hueco en otra posición); `secuenciaValida` rechaza solo lo que no cabe |
| La validez de una inserción se revisa con la secuencia completa: cada servicio contra el prefijo que lo antecede con `verificarRestricciones`, y después `cierreValido` | Reutiliza la función del Código 1 sin cambiarla y cubre el empalme con el anterior (o con el encierro y la cita) y con el siguiente |
| Los que siguen sin cubrir conservan su motivo original | Lo pide la mejora: el motivo explica por qué la etapa voraz o la de zona de término no pudo asignarlos |
| El verificador independiente (`motor/verificador.ts`) no importa nada de `algoritmo.ts` | Recalcula las horas desde la matriz y revisa cada regla por su cuenta; si compartiera código, un error del motor pasaría también por el verificador |

## Reglas confirmadas con la empresa

En el código y en CLAUDE.md están marcadas como "REGLA CONFIRMADA CON LA EMPRESA".

| # | Regla | Dónde está |
|---|---|---|
| 1 | Los 10 operadores se dividen en **dos bloques**: 5 con cita entre 04:00 y 05:00 y 5 entre 12:00 y 13:00. Jornada máxima 9.5 h para todos | Parámetros `hora_cita.bloque_matutino` = "04:00-05:00" y `hora_cita.bloque_vespertino` = "12:00-13:00" (HH:mm-HH:mm, validados en `validarParametro`); la hora de cita del operador debe caer en uno de ellos (`OperadoresService.revisarHoraCita`); seed |
| 2 | **Flota:** 4 Van/Urvan (14), 5 Sprinter (20) y 1 Autobús (45) | Seed (`VEHICULOS`) y prueba de 200 escenarios |
| 3 | Un grupo que no cabe en ninguna unidad disponible se reporta como no cubierto por **CAPACIDAD** para que Monitoreo contrate una unidad externa (es el comportamiento esperado) | Motor sin cambios; la pantalla Generar rol muestra "Requiere unidad externa (Monitoreo)" bajo el motivo |
| 4 | El **autobús** (BL-10, 45 pasajeros) siempre trabaja en el **bloque vespertino** (cita entre 12:00 y 13:00) | Seed: su operador tiene cita a las 13:00 y el seed se detiene si no está en ese bloque |
| 5 | **Distribución diaria** de los ~60 servicios: mañana (04:00-11:59) 15 a 18, principalmente salidas de familias que caben en Van o Sprinter; mediodía y tarde (12:00-18:59) 30 a 35, el pico; noche (19:00-21:45) 8 a 10. Los grupos de más de 20 pasajeros llegan a partir de las 13:00 | Seed (16 / 34 / 10, comprobación de los grupos) y generador de los 200 escenarios |
| 6 | **Zona de término:** si el último servicio de una unidad termina en Zona Hotelera o Aeropuerto CUN, es válido. Si termina en otra zona, también es válido siempre que la unidad pueda regresar en vacío a la zona de su encierro sin exceder la jornada: liberación del último servicio + tiempo(destino, zona del encierro) − hora de cita <= jornada máxima. Si no le alcanza, el motivo es ZONA_TERMINO | `cierreValido` (etapa de zona de término y reinserción), `verificarRol` (verificador independiente). Si falta el tiempo destino → encierro, 400 antes de generar (`RolesService.cargarDatos`) |
| 7 | **Primer servicio del día:** el operador tarda mínimo 30 a 40 minutos del encierro al primer hotel; los primeros servicios reales son a partir de las 04:45 | Seed: ningún servicio antes de las 04:45 (lo comprueba al final) |
| 8 | **Grupos:** en un día normal hay 1 o 2 grupos de más de 20 pasajeros como máximo (los toma el autobús en la tarde); el resto de los servicios son de 2 a 12 pasajeros | Seed del 10/11: exactamente 2 grupos de más de 20 pasajeros, después de las 13:00, y los demás de 2 a 12 (lo comprueba al final) |

Las reglas 4 a 8 las confirmó la Lic. Magalis Casanova.

La migración `20261109234556_bloques_hora_cita` solo cambia datos: convierte `hora_cita.turno_1` y `hora_cita.turno_2` en los dos bloques, sin tocar el esquema.

## Supuestos por confirmar con la empresa

| # | Supuesto | Dónde se cambia |
|---|---|---|
| 1 | El **encierro base** es una zona del catálogo y todas las unidades salen de **Centro Cancún** | Seed (`ENCIERRO_BASE`) y catálogo de vehículos |
| 2 | La **hora exacta** de cada operador dentro de su bloque y qué vehículo maneja cada uno son de ejemplo (por eso el autobús quedó en el bloque vespertino) | Catálogo de operadores |
| 3 | La **penalización por carga** de 15 min es de ejemplo | Parámetros (`motor.penalizacion_carga_min`) |
| 4 | Los extremos de cada bloque son válidos (05:00 y 13:00 entran) | `OperadoresService.revisarHoraCita` |

## Mejora: etapa de reinserción

### Justificación

Con los datos de operación, el Código 1 dejaba 37 de 60 servicios sin cubrir en el 10/11 (ver "Por qué la cobertura del 10/11 era baja"), mientras **2 unidades (BL-01 y BL-07) terminaban el día sin servicios**. La etapa de zona de término no reubicaba ninguno.

La causa es de estructura:
- la etapa voraz rechaza servicios porque la unidad que los habría tomado está ocupada;
- después, la etapa de zona de término quita servicios de esas mismas unidades;
- los rechazados nunca se vuelven a evaluar;
- la reubicación solo permite poner un servicio entre dos servicios de otra unidad, nunca al final ni en una unidad vacía.

La reinserción corrige eso **sin relajar ninguna regla**:
- cada inserción se acepta solo si la secuencia completa sigue cumpliendo capacidad, empalme (con el anterior o con el encierro y la cita, y con el siguiente), jornada y zona de término;
- solo agrega servicios, nunca quita uno asignado, así que la cobertura no puede bajar. Se comprobó en los 200 escenarios.

### Cómo funciona

Corre después de la etapa de zona de término (función pura `reinsertar` en `algoritmo.ts`):

1. Toma los no cubiertos en orden de inicio efectivo, incluidos los de CAPACIDAD (por si el autobús tiene un hueco en otra posición).
2. Para cada uno, `mejorInsercion` prueba **todas las posiciones de todas las unidades disponibles**, incluidas las vacías y la posición final. `secuenciaValida` revisa la secuencia resultante: cada servicio contra los que lo anteceden con `verificarRestricciones` (sin cambiarla) y después `cierreValido`.
3. Entre las posiciones válidas elige la de menor costo incremental (`costoInsercion`): espera antes del servicio + vacío añadido + penalización de carga. En empate gana el menor número económico y luego la posición más temprana.
4. Repite pasadas completas hasta que en una pasada no se inserte ninguno.
5. Los que siguen sin cubrir conservan su motivo original.

### Pseudocódigo final (Código 1 con la mejora)

```text
GenerarRol(servicios, unidades, parámetros)
 1  PARA CADA s EN servicios
 2    s.inicio ← s.hora − anticipación(s.modalidad)
 3    s.liberación ← s.hora + tiempo(s.origen, s.destino)
 4  ordenar servicios por s.inicio de menor a mayor
 5  unidades ← unidades disponibles (vehículo y operador)
 6  PARA CADA s EN servicios                                  ▷ etapa voraz
 7    factibles ← { u EN unidades | VerificarRestricciones(u, s) }
 8    SI factibles está vacío ENTONCES agregar (s, motivo) a noCubiertos
 9    SI NO u ← unidad de factibles con menor Costo(u, s)
10          agregar s al final de la secuencia de u
11  PARA CADA u EN unidades                                   ▷ zona de término
12    MIENTRAS NO CierreVálido(u)
13      s ← quitar el último servicio de u
14      SI s no cabe entre dos servicios de otra unidad que cierra bien
15        ENTONCES agregar (s, ZONA_TERMINO) a noCubiertos
16  REPETIR                                                   ▷ reinserción
17    insertado ← FALSO
18    PARA CADA (s, motivo) EN noCubiertos, por s.inicio
19      opciones ← { (u, i) | al poner s en la posición i de u, cada servicio
20                   cumple VerificarRestricciones y CierreVálido(u) }
21      SI opciones no está vacío ENTONCES
22        poner s en la opción de menor costo incremental
23        quitar (s, motivo) de noCubiertos; insertado ← VERDADERO
24  HASTA QUE insertado = FALSO
25  guardar rol y noCubiertos en una sola transacción
26  REGRESAR rol, noCubiertos

CierreVálido(u): u no tiene servicios, o su último servicio ú termina en zona
  de término, o ú.liberación + tiempo(ú.destino, u.encierro) − u.cita ≤ jornada máxima
```

Cambios respecto al Código 1 original:
- línea 12: la condición "el último servicio termina fuera de zona válida" se sustituye por `NO CierreVálido(u)`, que aplica la regla confirmada de zona de término con regreso al encierro;
- línea 14: solo se reubica en unidades que cierran bien;
- líneas 16 a 24: la etapa de reinserción es nueva;
- la etapa voraz (líneas 6 a 10) y `VerificarRestricciones` no cambian.

### Cambios que hay que hacer en el diagrama de flujo (Figura 23)

1. **Decisión de zona de término:** el rombo "¿El último servicio termina en zona de término?" pasa a ser "¿Cierre válido?". Su nota: "termina en Zona Hotelera o Aeropuerto CUN, o liberación + tiempo(destino, encierro) − cita ≤ jornada máxima". La salida "No" sigue yendo a "Quitar el último servicio".
2. **Reubicación:** el rombo "¿Cabe entre dos servicios de otra unidad?" agrega "que cierre válido".
3. **Bloque nuevo "Reinserción"**, entre el fin del ciclo de zona de término y "Guardar rol y no cubiertos":
   - proceso "insertado ← falso";
   - ciclo "Para cada no cubierto, por inicio efectivo";
   - proceso "Probar todas las posiciones de todas las unidades (incluidas vacías y final)";
   - rombo "¿Hay posición con secuencia válida? (VerificarRestricciones en cada servicio y Cierre válido)":
     - "Sí": proceso "Insertar en la de menor costo incremental (empate: número económico y posición); quitar de no cubiertos; insertado ← verdadero";
     - "No": el servicio se queda como no cubierto con su motivo original;
   - al terminar el ciclo, rombo "¿insertado?": "Sí" regresa a "insertado ← falso" (otra pasada); "No" continúa a "Guardar rol y no cubiertos (una transacción)".
4. **Validación previa** (si la figura la muestra): la matriz debe incluir el tiempo del destino de cada servicio al encierro; si falta, termina con "Responder 400".

## Resultados reales

Generados con la base de desarrollo al final de la rama `feat/motor-reinsercion`, con todas las reglas confirmadas y sin cambiar datos ni parámetros para mejorar el resultado. Es el resultado final del motor.

| Día | Servicios | Asignados | No cubiertos | Por motivo | Unidades usadas | Tiempo en la API |
|---|---|---|---|---|---|---|
| 10/11/2026 (seed) | 60 | **41** | 19 | EMPALME 14, ZONA_TERMINO 3, CAPACIDAD 2, JORNADA 0 | 10 de 10 | 120 a 210 ms |
| 05/11/2026 (archivo de ejemplo importado, sin cambios) | 58 | **46** | 12 | EMPALME 11, JORNADA 1, ZONA_TERMINO 0, CAPACIDAD 0 | 10 de 10 | 18 ms |

### Antes y después de la reinserción

Medido con las mismas funciones del motor: `generarRolBase` (sin reinserción) contra `generarRol`.

| Día | Reglas | Sin reinserción | Con reinserción | Unidades usadas |
|---|---|---|---|---|
| 10/11 | Zona de término anterior y seed de la distribución real | 23 (EMPALME 17, ZONA 12, CAPACIDAD 7, JORNADA 1) | 28 (EMPALME 13, ZONA 12, CAPACIDAD 6, JORNADA 1) | 8 → 9 de 10 |
| 05/11 | Zona de término anterior | 33 (ZONA 13, EMPALME 11, JORNADA 1) | 35 (ZONA 13, EMPALME 9, JORNADA 1) | 9 → 10 de 10 |
| 10/11 | Reglas finales | 39 (EMPALME 16, ZONA 3, CAPACIDAD 2) | 41 (EMPALME 14, ZONA 3, CAPACIDAD 2) | 10 → 10 de 10 |
| 05/11 | Reglas finales | 45 (EMPALME 11, ZONA 1, JORNADA 1) | 46 (EMPALME 11, JORNADA 1) | 10 → 10 de 10 |

Con la regla de zona de término anterior, la reinserción recuperó 5 servicios del 10/11 y llenó una de las dos unidades que terminaban vacías (BL-07 pasó de 0 a 3 servicios). Con las reglas finales recupera menos (2 y 1), porque la nueva regla de zona de término ya evita la mayoría de las cascadas de servicios quitados.

### Por franja horaria

Asignados sobre servicios y no cubiertos por motivo, hora del servicio en Cancún:

| Día y etapa | Mañana (04:00-11:59) | Mediodía y tarde (12:00-18:59) | Noche (19:00-21:45) |
|---|---|---|---|
| 10/11, distribución real (sin reinserción) | 8 de 16 (EMPALME 4, ZONA 4) | 11 de 34 (EMPALME 10, ZONA 7, CAPACIDAD 6) | 4 de 10 (EMPALME 3, CAPACIDAD 1, JORNADA 1, ZONA 1) |
| 10/11, con reinserción | 9 de 16 (EMPALME 3, ZONA 4) | 15 de 34 (EMPALME 7, ZONA 7, CAPACIDAD 5) | 4 de 10 (EMPALME 3, CAPACIDAD 1, JORNADA 1, ZONA 1) |
| 10/11, reglas finales | **14 de 16** (EMPALME 2) | **22 de 34** (EMPALME 9, CAPACIDAD 2, ZONA 1) | **5 de 10** (EMPALME 3, ZONA 2) |
| 05/11, sin reinserción | 13 de 23 (EMPALME 5, ZONA 5) | 17 de 27 (EMPALME 5, ZONA 5) | 3 de 8 (ZONA 3, EMPALME 1, JORNADA 1) |
| 05/11, con reinserción | 14 de 23 (EMPALME 4, ZONA 5) | 17 de 27 (EMPALME 5, ZONA 5) | 4 de 8 (ZONA 3, JORNADA 1) |
| 05/11, reglas finales | **18 de 23** (EMPALME 5) | **22 de 27** (EMPALME 5) | **6 de 8** (EMPALME 1, JORNADA 1) |

Servicios por unidad con las reglas finales:
- 10/11: BL-01 3, BL-02 5, BL-03 4, BL-04 4, BL-05 3, BL-06 4, BL-07 3, BL-08 5, BL-09 5 y BL-10 5. Seis unidades terminan en Zona Hotelera o en el aeropuerto CUN; BL-04 (Puerto Morelos), BL-06 y BL-10 (Centro Cancún) y BL-07 (Playa del Carmen) terminan fuera, pero les alcanza la jornada para regresar al encierro.
- 05/11: BL-01 4, BL-02 4, BL-03 3, BL-04 5, BL-05 5, BL-06 5, BL-07 5, BL-08 6, BL-09 5 y BL-10 4.

Los roles guardados se revisaron con el verificador independiente, leyendo las filas de la base, en cada etapa (con reinserción y con las reglas finales): **0 violaciones**, y cada servicio del día aparece una sola vez.

### Evolución del rol del 10/11

| Etapa | Asignados | CAPACIDAD | EMPALME | JORNADA | ZONA_TERMINO | Unidades usadas |
|---|---|---|---|---|---|---|
| 1. Antes del ajuste de turnos (un bloque de cita, flota anterior) | 22 de 60 (36.7 %) | 8 | 6 | 16 | 8 | 9 de 9 disponibles |
| 2. Turnos y flota confirmados (`fix/turnos-flota`) | 23 de 60 (38.3 %) | 5 | 21 | 0 | 11 | 9 de 10 |
| 3. Distribución real (`fix/seed-distribucion`) | 23 de 60 (38.3 %) | 7 | 17 | 1 | 12 | 8 de 10 |
| 4. Reinserción | 28 de 60 (46.7 %) | 6 | 13 | 1 | 12 | 9 de 10 |
| 5. Reglas finales (zona de término con regreso, primer servicio 04:45, 2 grupos) | **41 de 60 (68.3 %)** | 2 | 14 | 0 | 3 | **10 de 10** |

En ninguna etapa hubo no cubiertos por SIN_UNIDAD. En las etapas 1 y 2 los servicios eran los del seed anterior. En la 3 y la 4, los de la distribución real. En la 5, el seed con las reglas de primer servicio y grupos. El 05/11 (archivo importado, siempre el mismo) pasó de 23 (etapa 1) a 33 (etapas 2 y 3), 35 (etapa 4) y **46 de 58 (79.3 %)** en la etapa 5.

### Qué queda sin cubrir en el 10/11 y por qué

1. **EMPALME 14.**
   - En la mañana quedan 2. El primero, a las 04:55, sale de Playa del Carmen; ninguna unidad alcanza a llegar desde Centro Cancún (la primera cita es a las 04:00).
   - En la tarde quedan 9. Hay picos de servicios casi a la misma hora: 5 por empalme entre las 15:00 y las 15:40 (más el grupo de las 15:40), y otros a las 12:40 y entre las 17:00 y las 18:35. Las 10 unidades ya están ocupadas en esos minutos o no alcanzan a llegar.
   - En la noche quedan 3 (19:20, 19:45 y 20:00).
2. **CAPACIDAD 2: los dos grupos grandes.**
   - NEX-0031 (15:40, 30 pasajeros) y TUI-0030 (18:20, 21 pasajeros) solo caben en el autobús BL-10. BL-10 sí trabaja en la tarde (cita 13:00, regla 4).
   - La etapa voraz le asignó antes servicios chicos de menor costo (5, 5, 4, 11 y 4 pasajeros), así que a las 15:10 y a las 17:50 está ocupado.
   - La reinserción no puede resolverlo, porque solo inserta y no intercambia servicios. Por la regla confirmada 3, se reportan para que Monitoreo contrate una unidad externa.
   - **Observación para decidir con la empresa o en la memoria (no se cambió):** reservar el autobús para los grupos, por ejemplo agregando al costo la capacidad que sobra.
3. **ZONA_TERMINO 3.** Son servicios tarde que terminan lejos (Zona Hotelera → Tulum a las 17:35, Aeropuerto CUN → Playa del Carmen y Tulum → Aeropuerto TQO a las 21:40). Ninguna unidad alcanza a regresar a Centro Cancún dentro de su jornada.

### Por qué la cobertura del 10/11 era baja (etapa 3, antes de la reinserción)

Se revisó con un diagnóstico (fuera del proyecto) que ejecuta la etapa voraz con las mismas funciones del motor y la compara con el resultado final:

1. **La etapa de zona de término quitaba 12 servicios ya asignados y no reubicaba ninguno.**
   - La etapa voraz asignaba 35 de 60; después de la etapa de zona de término quedaban 23.
   - Con la regla anterior, solo terminar en Aeropuerto CUN o en Zona Hotelera era válido. Las unidades que terminaban fuera perdían servicios en cascada; BL-01 y BL-07 se quedaban con 0.
2. **Servicios rechazados que no se reconsideraban.** La unidad que los habría tomado estaba ocupada con servicios que luego se quitaron. Lo resuelve la reinserción.
3. **Servicios antes de que cualquier unidad pudiera llegar** (04:10, 04:25 y 04:40). Ya no existen con la regla del primer servicio (04:45).
4. **Siete grupos de 23 a 35 pasajeros con un solo autobús.** Con la regla de grupos quedan 2.
5. **El pico de la tarde** con las 5 unidades del bloque vespertino. Sigue siendo la causa principal de EMPALME.

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
| Con la regla nueva de zona de término, varias pruebas de la etapa de zona de término dejaron de tener sentido: la unidad que terminaba en Tulum ya alcanzaba a regresar a su encierro | En ese bloque de pruebas se usa una jornada de 5 h (con la cuenta en el comentario). El caso de dos pasadas y el de `generarRol` se rehicieron a mano para que sigan probando lo que dicen |
| El PR #7 seguía abierto al empezar la rama `feat/motor-reinsercion`, así que `main` no tenía el seed de la distribución real | La rama salió de `fix/seed-distribucion`. Cuando se fusione el #7, el PR de esta rama mostrará solo sus propios commits |
| `npx prettier` en `apps/web` (que no usa Prettier) descargó uno y reformateó un archivo completo con comillas dobles | Se revirtió el archivo y se aplicó solo el cambio de texto |
| El modo watch de la API dejó un proceso huérfano en el puerto 3001 | Se detuvo ese proceso (el del puerto 3000 es del alumno y no se tocó). Las cifras finales se midieron con la API recién compilada (`npm run build` y `node dist/main`) y coinciden con el diagnóstico que llama directo al motor |
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

| Problema | Solución |
|---|---|
| Después del ajuste de turnos, la mañana del seed tenía 31 de 60 servicios y grupos de más de 20 pasajeros desde las 05:30, cosa que no ocurre en la operación real | Ajuste `fix/seed-distribucion`: los 60 servicios se repartieron con la distribución confirmada por la empresa (16 / 34 / 10, sin grupos de más de 20 antes de las 13:00). El total asignado se quedó en 23 de 60, pero cambió dónde están los no cubiertos: la noche pasa de 0 a 4 asignados y la mañana y la tarde quedan limitadas por la etapa de zona de término (ver "Por qué la cobertura del 10/11 era baja"); con la reinserción y las reglas finales llegó a 41 de 60 (ver "Evolución del rol del 10/11") |

Comparación del rol del 10/11 en las tres etapas, con tres franjas (asignados sobre servicios y no cubiertos por motivo):

| Franja | Antes del ajuste de turnos | Después del ajuste de turnos | Después de la distribución real |
|---|---|---|---|
| Mañana (04:00-11:59) | 22 de 31 (ZONA 6, EMPALME 2, CAPACIDAD 1) | 15 de 31 (EMPALME 10, CAPACIDAD 3, ZONA 3) | 8 de 16 (EMPALME 4, ZONA 4) |
| Mediodía y tarde (12:00-18:59) | 0 de 24 (JORNADA 12, CAPACIDAD 6, EMPALME 4, ZONA 2) | 8 de 24 (ZONA 8, EMPALME 6, CAPACIDAD 2) | 11 de 34 (EMPALME 10, ZONA 7, CAPACIDAD 6) |
| Noche (19:00-21:45) | 0 de 5 (JORNADA 4, CAPACIDAD 1) | 0 de 5 (EMPALME 5) | 4 de 10 (EMPALME 3, CAPACIDAD 1, JORNADA 1, ZONA 1) |
| **Total** | **22 de 60** (36.7 %) | **23 de 60** (38.3 %) | **23 de 60** (38.3 %) |

En las dos primeras columnas los servicios eran los del seed anterior (31 / 24 / 5 por franja); en la tercera son los de la distribución real (16 / 34 / 10). El rol del 05/11 (archivo importado) no cambia con este ajuste: 33 de 58.

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

- **API, unitarias** (`npm run test:cov`): 19 suites y 260 pruebas aprobadas (249 antes de la reinserción, 233 al cerrar la Fase 9 y 183 antes de la fase).
  - Reinserción:
    - inserción en una unidad vacía cuando las demás están ocupadas;
    - inserción en medio respetando el empalme con el servicio siguiente, con su costo incremental calculado a mano (100 de espera + 10 de vacío + 30 de carga = 140);
    - inserción rechazada porque rompería la jornada o la zona de término, y los que no caben conservan su motivo;
    - un caso que requiere dos pasadas (el segundo servicio solo cabe después de insertar el primero);
    - desempate reproducible (BL-2 antes que BL-12, sin importar el orden de entrada);
    - `secuenciaValida` revisa cada servicio contra los anteriores;
    - `generarRol` recupera un servicio que `generarRolBase` dejaba por EMPALME.
  - Zona de término con regreso al encierro:
    - una unidad que termina en Tulum se conserva si le alcanza la jornada para regresar;
    - el límite exacto (810 − 240 = 570 válido; 571 no);
    - Zona Hotelera y aeropuerto sin regreso;
    - unidad vacía;
    - las pruebas de la etapa de zona de término usan una jornada corta para que la unidad no alcance a regresar.
  - Verificador: fuera de zona de término sin violación si alcanza a regresar, y ZONA_TERMINO si no.
  - `RolesService`: 400 si falta en la matriz el tiempo destino → encierro (Zona Hotelera → Centro Cancún), sin abrir la transacción.
  - Lo anterior de la Fase 9 y los ajustes sigue igual:
    - el motor, un caso por regla;
    - los bloques de hora de cita;
    - el verificador (repetidos, faltantes, cada restricción, unidad no disponible y horas guardadas);
    - `RolesService` y los catálogos.
- **Verificador independiente con 200 escenarios aleatorios** (semilla fija; 60 a 75 servicios y 10 unidades por escenario, con la flota confirmada, los dos bloques de hora de cita y la distribución por franja): 13 559 servicios y **0 violaciones**.
  - **Propiedad:** en cada uno de los 200 escenarios la cobertura con reinserción es mayor o igual que sin ella.
  - Con las reglas finales: 5 314 asignados sin reinserción y **5 443 con reinserción**.
  - No cubiertos: 4 341 EMPALME, 2 443 CAPACIDAD, 931 JORNADA, 401 ZONA_TERMINO y 0 SIN_UNIDAD. Así, todas las reglas se ponen a prueba.
  - Con la regla de zona de término anterior, la reinserción subía de 4 197 a 4 944.
  - El generador de escenarios conserva grupos de 15 a 40 pasajeros y servicios desde las 04:00 a propósito: es una prueba de estrés de las reglas, no una copia del día real.
  - Antes: con un solo bloque de 04:00 a 05:00, 3 098 asignados; con los dos bloques y los servicios de 05:00 a 21:00, 3 688.
- **Rendimiento (RNF-02):**
  - Solo el motor, con 75 servicios y 10 unidades y la reinserción: **11 ms** (de 11 a 21 ms según la corrida; antes de la reinserción, 0.99 ms).
  - En la API, con la carga de datos: de 120 a 210 ms en el 10/11 y 18 ms en el 05/11.
  - Todo muy por debajo del límite de 1 minuto.
- **Cobertura API:**
  - Total: **82.22 % de sentencias, 70.06 % de ramas, 76.17 % de funciones y 82.15 % de líneas** (81.58 % antes de la reinserción).
  - Módulo `motor`: **97.12 % de sentencias y 97.98 % de líneas**, con `algoritmo.ts` al 100 % de líneas. `roles.service.ts` al 100 % de líneas.
- **API, e2e** (`npm run test:e2e`): 12 suites y 86 pruebas aprobadas, sin cambios.
  - Roles: generar (201), lo guardado pasa el verificador independiente, consulta, regenerar sin duplicar, falla del guardado sin dejar nada a medias, 400, 404, 403, 401 y 409.
  - Operadores y vehículos como en el ajuste de turnos.
- **Web** (`npm run test:cov`, Vitest): 12 archivos y 74 pruebas aprobadas, con cobertura de **45.53 % de sentencias y 46.6 % de líneas**. Solo cambió el texto que explica el motivo ZONA_TERMINO ("…y sin jornada para regresar a su encierro").
- **Build y lint**: sin errores ni avisos en la API y en la web.
- **Base de desarrollo:** al terminar se restauró al estado del seed nuevo. Se borraron los roles generados y los registros de bitácora de las pruebas; la importación del 05/11 que hizo el alumno se conservó.

## Capturas que se deben tomar

Antes de empezar:

1. En la raíz, `docker compose up -d`.
2. En `apps/api`, `npx prisma migrate deploy` (aplica `operador_vehiculo_hora_cita` y `bloques_hora_cita`), `npx prisma db seed` (regenera los 60 servicios del 10/11 con las reglas nuevas) y `npm run start:dev`. Si ya tenías la API corriendo de antes, deténla y arráncala otra vez para que cargue el motor con la reinserción.
3. En `apps/web`, `npm run dev`.
4. Entra como `coordinador@bestline.local`.
5. Para la captura 4 hace falta haber importado `docs/ejemplos/Layout_Servicios_Nexus.xlsx` con Nexus Tours (Fase 8).

**Pantallas (http://localhost:5173)**

1. **Operadores con unidad.** Entra a Catálogos → Operadores. Deben verse las columnas "Unidad" (de BL-01 · Van · 14 pax a BL-10 · Autobús · 45 pax) y "Hora de cita": de 04:00 a 05:00 en los operadores 1 a 5 y de 12:00 a 13:00 en los 6 a 10.
2. **Rol del 10/11.** Entra a Operación → Generar rol, elige el 10/11/2026 y pulsa "Generar rol". Deben verse:
   - el aviso verde "Rol generado";
   - las tarjetas: 60 servicios del día, 41 asignados, 19 no cubiertos, 10 de 10 unidades usadas y el tiempo en ms;
   - la tabla de no cubiertos con su Badge de motivo y el conteo por motivo arriba a la derecha (Empalme 14, Zona de término 3, Capacidad 2); en los dos grupos por CAPACIDAD, la nota "Requiere unidad externa (Monitoreo)".
3. **Reemplazo de un rol PROPUESTO.** Cambia a otra fecha y regresa al 10/11. Debe verse el aviso ámbar "Ya existe un rol PROPUESTO de este día…". Pulsa "Generar rol" y captura el diálogo "¿Reemplazar el rol PROPUESTO?".
4. **Rol del día del archivo de ejemplo.** Elige el 05/11/2026 y genera. Deben verse 58 servicios del día, 46 asignados y 12 no cubiertos (Empalme 11, Jornada 1).

**API en Swagger (http://localhost:3000/api/docs, con el token del coordinador en Authorize)**

5. **Generar.** En `POST /api/roles/generar` elige el ejemplo "Día del seed" y "Execute". Debe verse el 201 con `reemplazado: true` y el `resumen` (60 / 41 / 19, `porMotivo` y `tiempoMs`).
6. **No cubiertos.** En `GET /api/roles/{fecha}/no-cubiertos` con `2026-11-10`, "Execute". Debe verse el 200 con cada servicio y su `motivo`.
7. **Sin servicios (400).** En `POST /api/roles/generar` escribe `{ "fecha": "2026-12-25" }`. Debe verse el 400 "No hay servicios PENDIENTE el 2026-12-25".

**Pruebas (terminal, en `apps/api` y `apps/web`)**

8. **Verificador y rendimiento.** En `apps/api`, `npm test -- motor`. Deben verse "Tests: 37 passed" y las líneas impresas "200 escenarios: 13559 servicios, 5314 asignados sin reinserción, 5443 con reinserción, no cubiertos {…}" y "Rendimiento: 75 servicios y 10 unidades en … ms".
9. **API con cobertura.** En `apps/api`, `npm run test:cov`. Deben verse "Tests: 260 passed", la fila "All files" (82.22 %) y la fila `src/motor` (97.12 %).
10. **Web con cobertura.** En `apps/web`, `npm run test:cov`. Deben verse "Tests 74 passed (74)" y la fila "All files" (45.53 %), con `GenerarRolPage.tsx`.

Al terminar, para regresar la base al estado del seed (cambia `<usuario_bd>` por el de tu `.env`):

```bash
docker compose exec db psql -U <usuario_bd> -d bestline -c "DELETE FROM asignacion; DELETE FROM servicio_no_cubierto; DELETE FROM rol_diario;"
```
