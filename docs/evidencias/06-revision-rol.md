# 06 · Revisión y autorización del rol (Fase 11)

## Casos de uso y requerimientos

| Clave | Caso de uso | Qué cubre en esta fase |
|---|---|---|
| CU-15 | Revisar y ajustar el rol | Línea de tiempo por unidad, opciones de unidad, mover un servicio y asignar un no cubierto con revalidación |
| CU-16 | Autorizar el rol del día | Verificador independiente, rol AUTORIZADO con usuario y fecha, servicios PROGRAMADO y bloqueo (409) |
| CU-14 | Consultar servicios no cubiertos | No cubiertos agrupados por motivo en la pantalla de revisión (ya existía en Generar rol) |

Requerimientos funcionales: **RF por confirmar** para CU-15, CU-16 y CU-14. La memoria no está en el repositorio y la evidencia 05 cita RF-12 y RF-13 para CU-13 y CU-14 juntos, sin decir cuál corresponde a cada uno. No se inventaron números.

## Qué se hizo

Se implementó la revisión y el ajuste del rol PROPUESTO (CU-15) y su autorización (CU-16), con la consulta de no cubiertos por motivo (CU-14) dentro de la misma pantalla. El coordinador ve el rol del día en una línea de tiempo por unidad, con el traslado en vacío antes de cada servicio y los no cubiertos agrupados por motivo. Puede mover un servicio a otra unidad o asignar un no cubierto, y la API revalida cada cambio con las mismas funciones del motor antes de guardarlo. Al final autoriza el rol: el verificador independiente lo revisa otra vez, los servicios asignados pasan a PROGRAMADO y el rol queda bloqueado (409 para cualquier cambio y para volver a generarlo). El SUPERVISOR solo consulta.

## Cómo se hizo

- **Una sola fuente de verdad.** No hay reglas nuevas. `revisarSecuencia` (en `motor/algoritmo.ts`) aplica `verificarRestricciones` a cada servicio contra los que lo anteceden y después `cierreValido`. Regresa la primera regla que falla y en qué servicio. `secuenciaValida`, que usa la reinserción, quedó como `revisarSecuencia(...) === null`, así que el motor se comporta igual y sus pruebas pasan sin cambios.
- **Revalidación pura** (`roles/revalidacion.ts`). `revisarMovimiento` inserta el servicio en su posición cronológica de la unidad destino (`posicionCronologica`, por inicio efectivo) y revisa la secuencia **completa** del destino. Si el servicio venía de otra unidad, también revisa la secuencia que le queda al origen, porque su nuevo último servicio podría no cerrar bien el día. Con el resultado arma un detalle en español con folio, hora y unidad.
- **Mismos datos que la generación.** `roles/datos-motor.ts` (`cargarDatosMotor`, `aServicioMotor`) se extrajo de `RolesService`. La generación y la revisión cargan las unidades, los parámetros y la matriz de la misma manera, y las horas se recalculan con los parámetros actuales.
- **Transacción y concurrencia.** Mover, asignar y autorizar corren en una transacción que primero bloquea la fila de `rol_diario` con `SELECT … FOR UPDATE` (`roles/bloqueo-rol.ts`) y después lee el rol. Si dos coordinadores cambian el mismo rol a la vez, el segundo espera y revalida con lo que ya guardó el primero. Dentro de la transacción se renumera `orden` (1..n) en las unidades destino y origen y se registra en la bitácora.
- **Autorizar** corre `verificarRol` sobre lo guardado. Si hay violaciones responde 400 con la lista y no cambia nada. Si pasa: rol AUTORIZADO con `autorizado_por` y `autorizado_en`, servicios asignados → PROGRAMADO y bitácora `AUTORIZAR`.
- **Pantalla** (`features/roles`): `RevisionRolPage` en `/roles/:fecha`. `/roles` abre el rol de mañana. La página tiene selector de fecha, badge de estado y totales, y se compone de:
  - `LineaTiempo`: barras en `div` con posición y ancho en minutos del día, a escala fija de 2.5 px por minuto, con folio y hora dentro de cada barra; color por modalidad; vacío tenue; fuera de jornada sombreado. La línea de tiempo se desplaza dentro de su tarjeta y la columna de unidades queda fija a la izquierda.
  - `ListaUnidades`: en celular (< md, hook `useEsMovil`).
  - `PanelNoCubiertos`: agrupados por motivo, con "Asignar a…".
  - `SelectorUnidad`: un `Dialog` que pide `/opciones` y deshabilita las unidades inválidas con su motivo.
  - Autorización con `Confirmacion`.

  Los hooks de `api.ts` invalidan `['roles', fecha]` al terminar, así que rol, no cubiertos y opciones se vuelven a pedir.

## Archivos principales

| Archivo | Qué tiene |
|---|---|
| `apps/api/src/motor/algoritmo.ts` | `revisarSecuencia`, `posicionCronologica` (nuevas) y `secuenciaValida` (ahora usa `revisarSecuencia`) |
| `apps/api/src/roles/revalidacion.ts` | `revisarMovimiento` y el texto del detalle |
| `apps/api/src/roles/revision.service.ts` | `opciones`, `mover`, `asignarNoCubierto`, `autorizar` |
| `apps/api/src/roles/bloqueo-rol.ts` | `bloquearRol` y `bloquearRolPropuesto` (`FOR UPDATE`, 404 y 409) |
| `apps/api/src/roles/datos-motor.ts` | Carga de datos del motor compartida con la generación |
| `apps/api/src/roles/roles.service.ts` | `GET /roles/:fecha` ampliado y 409 al generar un rol AUTORIZADO |
| `apps/api/prisma/migrations/20261111233212_rol_autorizado_en` | Columna nueva |
| `apps/web/src/features/roles/RevisionRolPage.tsx` | Pantalla de revisión |
| `apps/web/src/features/roles/LineaTiempo.tsx`, `ListaUnidades.tsx`, `PanelNoCubiertos.tsx`, `SelectorUnidad.tsx` | Componentes de la pantalla |

## Cambio al modelo (autorizado)

Migración `20261111233212_rol_autorizado_en`, creada con `prisma migrate dev` sin reset ni drift:

```sql
ALTER TABLE "rol_diario" ADD COLUMN "autorizado_en" TIMESTAMPTZ(3);
```

Es nula: solo tiene valor cuando el rol se autoriza. En la bitácora se agregaron la acción `AUTORIZAR` y la entidad `asignacion`. Son valores de texto y no cambian el esquema.

## Endpoints

Todas las rutas llevan el prefijo `/api` y exigen `Authorization: Bearer <token>`. Swagger tiene ejemplos de 200, 400, 401, 403, 404 y 409.

| Método | Ruta | Quién | Descripción | Respuestas |
|---|---|---|---|---|
| GET | `/roles/:fecha` (CU-15, CU-14) | ADMIN, COORD, SUPERVISOR | Estado y autorización. Unidades que participan (también las vacías) con tipo, capacidad, operador, cita y fin de jornada. Asignaciones por inicio con `vacio` (minutos, desde, hasta). No cubiertos con motivo | 200, 400, 401, 403, 404 |
| GET | `/roles/:fecha/servicios/:servicioId/opciones` (CU-15) | ADMIN, COORD, SUPERVISOR | Para cada unidad: `valido` y `posicion`, o `motivo` y `detalle`. Marca la unidad actual. Primero las válidas | 200, 400, 401, 403, 404 |
| PATCH | `/roles/:fecha/asignaciones/:id` (CU-15) | ADMIN, COORD | `{ vehiculoId }`. Mueve el servicio si la revalidación pasa | 200, 400, 401, 403, 404, 409 |
| POST | `/roles/:fecha/no-cubiertos/:servicioId/asignar` (CU-15) | ADMIN, COORD | `{ vehiculoId }`. Crea la asignación y quita el no cubierto | 200, 400, 401, 403, 404, 409 |
| POST | `/roles/:fecha/autorizar` (CU-16) | ADMIN, COORD | Verificador → AUTORIZADO, PROGRAMADO y bitácora | 200, 400, 401, 403, 404, 409 |
| POST | `/roles/generar` | ADMIN, COORD | Sin cambios, salvo que ahora también revisa con la fila bloqueada que el rol no esté AUTORIZADO | 409 |

Un 400 de revalidación trae `{ message, motivo, detalle }`, con `motivo` ∈ CAPACIDAD, EMPALME, JORNADA, ZONA_TERMINO o DISPONIBILIDAD. En la bitácora quedan, por ejemplo:
- `ACTUALIZAR: 2026-11-10: NEX-0013 de BL-02 a BL-05` (entidad `asignacion`);
- `CREAR: 2026-11-10: S-5 (no cubierto por JORNADA) a BL-04` (entidad `asignacion`);
- `AUTORIZAR: 2026-11-10: 41 servicios PROGRAMADO, 19 no cubiertos` (entidad `rol_diario`).

## Decisiones

| Decisión | Por qué |
|---|---|
| El servicio se inserta en su posición cronológica (por inicio efectivo); no se elige la posición a mano | Una secuencia válida siempre va en orden de inicio; así el coordinador solo elige la unidad |
| Se revisa la secuencia completa del destino **y** la del origen sin el servicio | Al quitar el último servicio, el nuevo último puede no cerrar bien el día (ZONA_TERMINO) |
| Mover a la misma unidad → 400 "El servicio NEX-0013 ya está en BL-02" | Plan aprobado |
| DISPONIBILIDAD = vehículo no DISPONIBLE, operador no disponible, operador sin cita o vehículo sin operador | Plan aprobado; es la misma condición con la que la unidad participa en la generación |
| Las horas se recalculan con los parámetros actuales | Plan aprobado; si cambió la anticipación o la matriz, la revalidación usa los valores vigentes |
| `SELECT … FOR UPDATE` sobre `rol_diario` y lectura del rol **después** del bloqueo | Plan aprobado. Sin el bloqueo, dos movimientos que juntos se empalman podrían pasar los dos (lo comprueba una prueba e2e) |
| Rol AUTORIZADO → 409 en mover, asignar, autorizar y generar | Plan aprobado; el rol autorizado es el que ejecuta Monitoreo |
| Autorizar corre `verificarRol` aunque cada cambio ya se revalidó | Es la red de seguridad independiente del motor (no comparte código con `algoritmo.ts`) |
| Mover registra `ACTUALIZAR` y asignar registra `CREAR` con entidad `asignacion`; autorizar registra `AUTORIZAR` con entidad `rol_diario` | Plan aprobado |
| Las opciones se piden siempre frescas (`staleTime: 0`) y, si un movimiento falla, la lista se vuelve a pedir | Otro coordinador pudo cambiar el rol mientras el diálogo estaba abierto |
| En celular (< 768 px) se cambia la línea de tiempo por una lista | Una línea de tiempo de 18 h no se puede leer en 360 px; la lista muestra lo mismo en orden |

## Problemas y soluciones

| Problema | Solución |
|---|---|
| La sesión anterior se cortó: `autorizado_en` estaba en `schema.prisma` sin migración y 6 pruebas e2e fallaban con "column rol_diario.autorizado_en does not exist" | Se creó la migración con `prisma migrate dev` y se revisó que el SQL fuera solo el `ADD COLUMN` |
| Dos pruebas unitarias de `roles.service` fallaban: el simulado de Prisma no tenía `$queryRaw` ni `updateMany` y los datos de `obtener` tenían la forma vieja | Se ajustaron el simulado y los datos sin quitar aserciones. Se agregaron otras más fuertes: vacío previo, fin de jornada, unidades vacías y 409 detectado con la fila bloqueada |
| En el e2e nuevo, la prueba esperaba 30 min de vacío en todos los servicios | Era un error de la prueba: si el servicio anterior termina en la misma zona donde empieza el siguiente, el vacío es de 10 min. La prueba ahora calcula el vacío esperado desde la zona anterior |
| Vitest fallaba con "failed to find the current suite" en todas las suites al correrlo desde Git Bash | No era el código: desde PowerShell (terminal normal de Windows) corre bien. Las pruebas de la web se corren con `npm test` en PowerShell |
| Revisión visual (Playwright, 1440 px): con la escala ajustada al ancho (~0.8 px por minuto), 18 de 41 barras medían de 23 a 35 px; el folio se partía o se cortaba y la hora no se veía. Además, la última hora del eje se salía del borde | Escala fija de 2.5 px por minuto (el servicio más corto mide unos 60 px) con folio y hora en dos líneas. La línea de tiempo se desplaza dentro de su tarjeta, con la columna de unidades fija (`sticky`) y un margen a cada lado del eje. Un texto indica desplazarse para ver la tarde y la noche |
| En el diálogo "Asignar a…" de NEX-0031, en 1440 × 900 solo se veían BL-01 a BL-08; BL-10, que tiene el detalle del empalme, quedaba abajo del scroll | Opciones más compactas y la lista usa el alto disponible (`max-h-[calc(100dvh-11rem)]`). Las 10 unidades caben en una sola captura |

## Resultado de las pruebas

| Suite | Resultado | Cobertura |
|---|---|---|
| API unitarias (`npm run test:cov`) | 284 de 284 | Global 84.1 % de líneas. `revision.service.ts`, `revalidacion.ts`, `bloqueo-rol.ts`, `datos-motor.ts` y `roles.service.ts` al 100 % de líneas; `algoritmo.ts` 100 % |
| API e2e (`npm run test:e2e`) | 96 de 96 en 13 suites (nueva: `revision-rol.e2e-spec.ts`, 10 pruebas) | — |
| Web (`npm test` / `npm run test:cov`) | 86 de 86 en 13 archivos (nuevo: `RevisionRolPage.test.tsx`, 10 pruebas) | `features/roles` 94.5 % de líneas |
| Lint y build | API y web sin avisos; `nest build` y `vite build` correctos | — |

Todo se corrió en PowerShell el 11/11/2026, después de las correcciones de la revisión visual.

## Revisión visual (Playwright)

Se hizo un recorrido con Playwright fuera del proyecto, en escritorio (1440 × 900) y en móvil (390 × 844), como COORDINADOR y como SUPERVISOR, con el rol del 10/11 generado desde la pantalla. Resultado final:
- **Línea de tiempo (1440):** 10 filas y 41 barras; ninguna barra se encima y los 41 folios y horas se leen completos. La página no se desborda; la línea de tiempo se desplaza dentro de su tarjeta.
- **Lista de celular (390):** 41 botones "Mover", vacío previo en cada servicio y sin desborde horizontal, también con el selector abierto.
- **Movimiento válido:** NEX-0013 de BL-02 a BL-05 ("Quedaría como el servicio 2 de la unidad"); después aparece en la fila de BL-05.
- **Rechazo:** en el selector de NEX-0031, las 10 unidades están deshabilitadas: BL-01 a BL-09 por Capacidad y BL-10 por Empalme. El detalle "Empalma con el servicio TUI-0024 de 15:00 en BL-10" se lee completo, sin cortarse, en 1440 y en 390. Por la API, `POST /roles/2026-11-10/no-cubiertos/31/asignar` con `{ "vehiculoId": 10 }` responde 400 con `motivo: "EMPALME"` y ese mismo detalle.
- **No cubiertos por motivo:** grupos de Capacidad, Empalme y Zona de término.
- **Autorización:** el diálogo de confirmación avisa los 19 servicios sin cubrir. Después de autorizar se ve el badge *Autorizado* con quién y cuándo, ya no hay botones de mover, asignar ni autorizar, y Generar rol avisa que el rol está AUTORIZADO.
- **SUPERVISOR:** en 1440 y en 390 ve el aviso "Solo consulta" y no tiene ningún botón de mover, asignar ni autorizar.
- **Consola:** sin errores de la aplicación. El navegador solo registra el 404 de red de `GET /roles/:fecha` cuando la fecha no tiene rol, por ejemplo mañana (12/11) al abrir Generar rol. La pantalla lo maneja como "todavía no hay rol"; ese 404 es el contrato de la API desde la Fase 9.

Al terminar, la base se dejó sin roles AUTORIZADOS con el comando de la última sección. Se comprobó con una huella (conteos de servicios, importaciones, vehículos, operadores, zonas, hoteles, usuarios, tiempos y parámetros, más un md5 de los servicios) que solo cambiaron los roles.

Qué comprueban las e2e de la revisión:
- después de cada movimiento válido, el verificador independiente da **0 violaciones** sobre lo guardado y el orden de cada unidad es 1..n;
- dos movimientos simultáneos que solos son válidos pero juntos se empalman: uno 200 y otro 400 EMPALME (se repitió 3 veces sin fallas);
- 400 con motivo y detalle (EMPALME, CAPACIDAD, JORNADA, DISPONIBILIDAD) y misma unidad;
- 404 (asignación, vehículo, no cubierto, fecha sin rol);
- 403 para SUPERVISOR en mover, asignar y autorizar, y para OPERADOR en opciones; 401 sin token;
- 409 en mover, asignar, autorizar y generar con el rol AUTORIZADO.

## Capturas (máximo 8, en este orden)

Antes de empezar:
- la API (`npm run start:dev` en `apps/api`) y la web (`npm run dev` en `apps/web`) deben estar corriendo;
- la base debe estar sin rol del 10/11, o con uno PROPUESTO (se reemplaza). Si ya hay uno AUTORIZADO, primero corre el comando de la sección "Regresar la base al estado anterior a las capturas".

Las capturas 1 a 7 no autorizan nada y se pueden repetir. **La captura 8 autoriza el rol**: después ya no se puede regenerar ni mover nada (409) hasta correr el comando de limpieza.

1. **Regenerar el rol del 10/11.** Inicia sesión como COORDINADOR (`coordinador@bestline.local`) y abre **Generar rol** (`http://localhost:5173/generar-rol`). Elige el **10/11/2026** y presiona **Generar rol** (si ya había uno PROPUESTO, confirma **Generar de nuevo**). Deben verse el aviso "Rol generado" o "Rol reemplazado", los totales 60 servicios, 41 asignados, 19 no cubiertos y 10 de 10 unidades usadas, y el botón **Revisar rol**.
2. **Revisar rol en escritorio.** Botón **Revisar rol** (abre `http://localhost:5173/roles/2026-11-10`). Deben verse el badge *Propuesto*, los totales, la leyenda y la línea de tiempo con BL-01 a BL-05 en la mañana: cada barra con folio y hora, y el vacío tenue entre servicios. Las unidades de la tarde (BL-06 a BL-10) se ven al desplazar la línea de tiempo a la derecha.
3. **Selector "Mover a…" (movimiento válido).** Clic en la barra **NEX-0013 · 06:40** de **BL-02**. En el diálogo, **BL-05** aparece arriba y habilitada ("Quedaría como el servicio 2 de la unidad"); las demás aparecen deshabilitadas con su motivo y el detalle.
4. **Movimiento hecho.** Elige **BL-05**. Deben verse el aviso "NEX-0013 movido a BL-05" y la barra NEX-0013 en la fila de BL-05.
5. **Rechazo, evidencia (a): selector de NEX-0031.** Baja a *Servicios no cubiertos → Capacidad* y presiona **Asignar a…** en **NEX-0031** (15:40, 30 pax). Las 10 unidades caben en el diálogo y todas están deshabilitadas:
   - BL-01 a BL-09 por *Capacidad* (por ejemplo, "NEX-0031 lleva 30 pasajeros y BL-05 tiene capacidad para 20");
   - **BL-10** por *Empalme*, con el detalle completo "Empalma con el servicio TUI-0024 de 15:00 en BL-10".
6. **Rechazo, evidencia (b): Swagger con el 400 EMPALME de la misma petición.** En `http://localhost:3000/api/docs`:
   1. con `POST /api/auth/login` inicia sesión como el coordinador, copia el `accessToken` y pégalo en **Authorize**;
   2. abre `POST /api/roles/{fecha}/no-cubiertos/{servicioId}/asignar` → **Try it out** con `fecha` = `2026-11-10`, `servicioId` = `31` (NEX-0031) y el cuerpo `{ "vehiculoId": 10 }` (BL-10);
   3. presiona **Execute**.

   En la captura deben verse el cuerpo de la petición y la respuesta **400**: `{ "message": "Empalma con el servicio TUI-0024 de 15:00 en BL-10", "motivo": "EMPALME", "detalle": "Empalma con el servicio TUI-0024 de 15:00 en BL-10", … }`. Los ids 31 y 10 son los del seed; se confirman en `GET /api/roles/2026-11-10` (`noCubiertos[].servicioId` de NEX-0031 y `unidades[].vehiculo.id` de BL-10).
7. **SUPERVISOR en celular (solo consulta).** Cierra sesión, entra como `supervisor@bestline.local` y abre `http://localhost:5173/roles/2026-11-10` con las DevTools en modo dispositivo de **390 px**. Deben verse el aviso "Solo consulta…", la lista por unidad con el vacío previo de cada servicio, y ningún botón de **Mover**, **Asignar a…** ni **Autorizar rol**.
8. **⚠ AUTORIZA EL ROL. Después de esta captura ya no se puede regenerar el 10/11 sin el comando de limpieza.** Vuelve a entrar como COORDINADOR en `http://localhost:5173/roles/2026-11-10` y presiona **Autorizar rol**. El diálogo avisa "Quedan 19 servicios sin cubrir". Confirma con **Autorizar**. Deben verse:
   - el aviso "Rol autorizado" (41 servicios PROGRAMADO, 19 sin cubrir);
   - el badge *Autorizado* con "Por Coordinador Ejemplo el …";
   - el aviso "El rol ya está AUTORIZADO: solo se puede consultar";
   - ningún botón de mover, asignar ni autorizar.

**Sobre el rechazo por empalme.** La pantalla no muestra un aviso de error al rechazar, porque el selector no deja elegir una unidad inválida: la deshabilita y explica el motivo antes de intentarlo. Por eso la evidencia del rechazo son las capturas 5 y 6: el selector con BL-10 deshabilitada y su detalle, y la misma petición hecha directamente a la API, que responde 400 EMPALME con el mismo detalle (la API revalida aunque alguien se salte la pantalla). Como NEX-0031 es un no cubierto, la petición es `POST …/no-cubiertos/31/asignar`. `PATCH …/asignaciones/:id` sirve para mover un servicio que ya tiene asignación.

Comprobación opcional (no es captura): como ADMINISTRADOR, en **Bitácora** quedan "ACTUALIZAR: 2026-11-10: NEX-0013 de BL-02 a BL-05" (entidad Asignación) y "AUTORIZAR: 2026-11-10: 41 servicios PROGRAMADO, 19 no cubiertos" (entidad Rol diario).

## Fragmento de código candidato

`apps/api/src/motor/algoritmo.ts`, función `revisarSecuencia` (14 líneas):

```ts
export function revisarSecuencia(
  u: UnidadEnRol,
  secuencia: ServicioCalculado[],
  p: ParametrosMotor,
): { motivo: Restriccion | 'ZONA_TERMINO'; indice: number } | null {
  for (let k = 0; k < secuencia.length; k++) {
    const motivo = verificarRestricciones(
      { ...u, secuencia: secuencia.slice(0, k) },
      secuencia[k],
      p,
    );
    if (motivo) return { motivo, indice: k };
  }
  return cierreValido({ ...u, secuencia }, p)
    ? null
    : { motivo: 'ZONA_TERMINO', indice: secuencia.length - 1 };
}
```

Revisa una secuencia completa de una unidad con las mismas reglas del Código 1: cada servicio contra los que lo anteceden (capacidad, empalme y jornada) y, al final, si la unidad cierra bien el día.
La usan la reinserción del motor (`secuenciaValida`) y la revisión manual del coordinador (`revisarMovimiento`), así que las dos aplican exactamente las mismas reglas.
Además de decir si la secuencia es válida, regresa qué regla falla y en qué servicio, y con eso se arma el mensaje que ve el coordinador.

## Regresar la base al estado anterior a las capturas

Borra **solo** el rol del 10/11: sus asignaciones, sus no cubiertos y la fila de `rol_diario`. También regresa a PENDIENTE los servicios que la autorización dejó en PROGRAMADO; si no, el motor no los volvería a tomar, porque solo genera con servicios PENDIENTE. Mover un servicio solo cambia `asignacion`, que de todos modos se borra. No toca servicios, importaciones, catálogos, usuarios ni el rol del 05/11. La bitácora se conserva, porque es el historial y no impide regenerar. Todo corre en una sola transacción: si algo falla, no se aplica nada.

En PowerShell, desde cualquier carpeta, con el contenedor `bestline-db` corriendo:

```powershell
@'
BEGIN;
UPDATE servicio SET estado = 'PENDIENTE'
 WHERE estado = 'PROGRAMADO'
   AND id IN (SELECT a.servicio_id FROM asignacion a JOIN rol_diario r ON r.id = a.rol_id WHERE r.fecha = :'fecha');
DELETE FROM asignacion WHERE rol_id IN (SELECT id FROM rol_diario WHERE fecha = :'fecha');
DELETE FROM servicio_no_cubierto WHERE rol_id IN (SELECT id FROM rol_diario WHERE fecha = :'fecha');
DELETE FROM rol_diario WHERE fecha = :'fecha';
COMMIT;
'@ | docker exec -i bestline-db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v fecha=2026-11-10'
```

El `'@` de cierre debe quedar al inicio de la línea. Para otra fecha, cambia `fecha=2026-11-10`. Con el rol autorizado del 10/11, la salida esperada es:

```text
BEGIN
UPDATE 41
DELETE 41
DELETE 19
DELETE 1
COMMIT
```

Si no hay rol de esa fecha, todo da 0 y no pasa nada. Después se puede volver a empezar desde la captura 1. Se probó dos veces el 11/11/2026: antes y después del comando, los conteos de servicios (118), importaciones (1), vehículos, operadores, zonas, hoteles, usuarios, tiempos y parámetros, y el md5 de los servicios (id, folio, estado y fecha), fueron idénticos.
