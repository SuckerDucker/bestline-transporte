# 04 · Importación de servicios de los mayoristas (Fase 8)

## Qué se hizo

Se implementó la importación de los servicios que envían los mayoristas (CU-10, RF-04, RF-05). La API lee el layout diario de la empresa en Excel (.xlsx, con SheetJS) o en CSV (con PapaParse), encuentra la fila de encabezados aunque antes haya filas de título, lee cada columna por su nombre y valida cada fila: obligatorios, fecha y hora, pasajeros, largo de los campos, tipo de servicio, agencia, zona, hotel y duplicados por folio + localizador dentro del archivo y contra la base. Primero se genera una vista previa que no guarda nada y muestra cada fila como VÁLIDA, ADVERTENCIA, DUPLICADA o ERROR con sus mensajes; al confirmar, el archivo se procesa otra vez y en una sola transacción se guardan la importación, los servicios importables en estado PENDIENTE y el registro en la bitácora. También se agregaron el historial de importaciones con su detalle y la consulta de servicios con filtros. En el frontend se creó el grupo "Operación" con las pantallas Importar servicios, Servicios e Historial de importaciones.

## Cómo se hizo

La lógica se separó en tres archivos de funciones puras (sin base de datos), para poder probarlas directamente con el archivo de ejemplo de la empresa:

1. `mapeo.ts`: todas las reglas configurables en un solo lugar (encabezados, aeropuerto, modalidad por omisión, valores vacíos, interpretación del tipo y ruta según el sentido).
2. `lectura.ts`: convierte el .xlsx o el .csv en filas indexadas por nombre de encabezado.
3. `procesar-filas.ts`: valida y convierte cada fila, y decide su estado.

`ImportacionesService` junta los catálogos (zonas, hoteles y mayoristas) y los servicios existentes con los mismos folios, llama a esas funciones y guarda. La vista previa y la confirmación usan el mismo procesamiento; por eso, al confirmar, los duplicados se revisan otra vez contra la base.

## Archivos principales

| Archivo | Contenido |
|---|---|
| `apps/api/src/importaciones/mapeo.ts` | Reglas de mapeo configurables |
| `apps/api/src/importaciones/lectura.ts` | Lectura de .xlsx y .csv, detección de encabezados |
| `apps/api/src/importaciones/procesar-filas.ts` | Validación por fila, estados y contadores |
| `apps/api/src/importaciones/importaciones.service.ts` / `.controller.ts` | Vista previa, confirmación, historial y detalle |
| `apps/api/src/servicios/` | Consulta de servicios con filtros y lista de mayoristas |
| `apps/api/prisma/seed.ts` | Los 8 hoteles del archivo de ejemplo (`HOTELES_LAYOUT`) |
| `apps/web/src/features/importacion/` | Pantalla Importar, vista previa, historial y detalle |
| `apps/web/src/features/servicios/` | Pantalla Servicios y tabla compartida |
| `docs/ejemplos/Layout_Servicios_Nexus.xlsx` y `.csv` | Archivo de ejemplo de la empresa (anonimizado) y su versión CSV generada con SheetJS |

## Endpoints

Todas las rutas llevan el prefijo `/api` y exigen `Authorization: Bearer <token>`.

| Método | Ruta | Quién | Descripción | Respuestas |
|---|---|---|---|---|
| POST | `/importaciones/vista-previa` | ADMINISTRADOR, COORDINADOR | Multipart con `archivo` (.xlsx o .csv, máx. 5 MB) y `mayoristaId`. Procesa sin guardar: filas con estado y mensajes, totales y avisos | 200, 400, 401, 403, 404, 413 |
| POST | `/importaciones/confirmar` | ADMINISTRADOR, COORDINADOR | Mismo formulario. Vuelve a procesar y guarda en una transacción la importación, los servicios VÁLIDA y ADVERTENCIA (PENDIENTE) y la bitácora | 201, 400, 401, 403, 404, 409, 413 |
| GET | `/importaciones` | ADMINISTRADOR, COORDINADOR, SUPERVISOR | Historial paginado, de la más reciente a la más antigua; búsqueda por archivo y filtro por mayorista | 200, 400, 401, 403 |
| GET | `/importaciones/:id` | ADMINISTRADOR, COORDINADOR, SUPERVISOR | Una importación con sus servicios ordenados por hora | 200, 400, 401, 403, 404 |
| GET | `/servicios` | ADMINISTRADOR, COORDINADOR, SUPERVISOR | Filtros `fecha` (día de Cancún), `mayoristaId`, `tipo`, `modalidad`, `zonaId` (origen o destino), `estado`, `importacionId` y `buscar` (folio, localizador o vuelo); ordenados por hora, con paginación | 200, 400, 401, 403 |
| GET | `/mayoristas` | Autenticado | Mayoristas para los selectores | 200, 401 |

Errores del archivo completo (400): falta el archivo, no es .xlsx ni .csv, supera 5 MB, no se pudo leer o le faltan encabezados. En este último caso la respuesta trae la lista:

```json
{ "message": "Faltan encabezados: Zona, Hora", "faltantes": ["Zona", "Hora"], "error": "Bad Request", "statusCode": 400 }
```

## Reglas de mapeo

- **Encabezados:** la fila de encabezados es la que contiene "Folio" (se revisan las primeras 20 filas). Se leen por nombre, sin distinguir mayúsculas ni acentos: Folio, Localizador, Agencia, Fecha, Tipo de Servicio, Pasajeros, Hotel, Zona, Vuelo y Hora. Si falta alguno → 400 con la lista.
- **Fecha y hora:** Fecha en dd/mm/aaaa y Hora en HH:mm forman la `fecha_hora` en hora de Cancún (se guarda en UTC). Si Excel las guarda como fecha real, se convierten.
- **Agencia → mayorista** por nombre ("Nexus Tours", "TUI"). Si no existe → ERROR. El servicio se guarda con el mayorista de su fila; la importación, con el que elige el usuario. Si alguna fila trae otra agencia, la vista previa lo avisa.
- **Tipo de Servicio** = sentido (LLEGADA, SALIDA o TRASLADO) + modalidad opcional (PRIVADO, COMPARTIDO o GRUPO), sin distinguir mayúsculas ni acentos. Sin modalidad → COMPARTIDO con ADVERTENCIA. Cualquier otro texto → ERROR.
- **Origen y destino:** LLEGADA = Aeropuerto CUN → zona del hotel; SALIDA = zona del hotel → Aeropuerto CUN; TRASLADO = zona del hotel → zona del hotel.
- **Zona** por nombre en el catálogo: "—" o vacía → ERROR "Zona no indicada"; inexistente → ERROR "Zona no registrada en el catálogo".
- **Hotel** por nombre: si no existe, la fila es ADVERTENCIA "Hotel no registrado en el catálogo" y se guarda con `hotel_id` nulo. Vacío → ERROR (es obligatorio).
- **Vuelo:** "—" o vacío = sin vuelo. En TRASLADO no se exige; en LLEGADA o SALIDA sin vuelo → ADVERTENCIA.
- **Validaciones:** obligatorios (todos menos Vuelo y Zona, que tiene su propio mensaje), fecha real, hora válida, Pasajeros entero mayor que 0, folio y localizador de hasta 30 caracteres, vuelo de hasta 15.
- **Estado de cada fila,** por prioridad: ERROR > DUPLICADA (folio + localizador repetido en el archivo o ya en la base) > ADVERTENCIA > VÁLIDA. Se importan VÁLIDA y ADVERTENCIA. En el archivo, la primera fila importable se queda y las siguientes con el mismo folio + localizador salen como DUPLICADA; una fila con error no "ocupa" el folio.
- **Al confirmar:** `filas_validas` = VÁLIDA + ADVERTENCIA y `filas_rechazadas` = ERROR + DUPLICADA.

## Supuestos por confirmar con la empresa

| # | Supuesto | Dónde se cambia |
|---|---|---|
| 1 | Si "Tipo de Servicio" no trae la modalidad, se asume **COMPARTIDO** (la fila queda como ADVERTENCIA) | `MODALIDAD_POR_OMISION` en `mapeo.ts` |
| 2 | En un **TRASLADO**, origen y destino son la zona del hotel (el layout no trae una segunda zona) | `rutaDelServicio` en `mapeo.ts` |
| 3 | Las LLEGADA y SALIDA usan siempre el **Aeropuerto CUN** (el layout no indica aeropuerto; los hoteles de Tulum podrían usar TQO) | `ZONA_AEROPUERTO` en `mapeo.ts` |
| 4 | Una LLEGADA o SALIDA **sin vuelo** es ADVERTENCIA, no ERROR | `procesar-filas.ts` |
| 5 | El **Hotel** es obligatorio; si no está en el catálogo, la fila se importa sin hotel | `procesar-filas.ts` |
| 6 | La zona de la columna **Zona** manda, aunque el hotel del catálogo esté en otra zona | `procesar-filas.ts` |
| 7 | La Fecha viene en **dd/mm/aaaa** (no en mm/dd/aaaa) | `leerFecha` en `procesar-filas.ts` |
| 8 | Cada servicio se guarda con la **agencia de su fila**, aunque el usuario haya elegido otro mayorista para la importación | `ImportacionesService` |

## Decisiones técnicas

| Decisión | Por qué |
|---|---|
| Confirmar vuelve a enviar el archivo y lo procesa otra vez | Así se revisan de nuevo los duplicados contra la base (otra persona pudo importar el mismo archivo) y el servidor no guarda vistas previas a medias. Si aun así se cruza otra importación, la restricción única de la tabla responde 409 |
| Un solo registro de bitácora por importación: `CREAR: Layout_Servicios_Nexus.xlsx: 58 servicios importados, 7 filas rechazadas` | Registrar 58 creaciones llenaría la bitácora sin aportar más; los servicios quedan ligados por `importacion_id`. Se agregó la entidad `importacion` |
| Multer acepta hasta 10 MB; el límite de 5 MB lo revisa el servicio | Con más de 10 MB multer corta (413) para proteger la memoria; entre 5 y 10 MB la API responde 400 con un mensaje en español |
| `defParamCharset: 'utf8'` en la subida | Multer decodifica por omisión el nombre del archivo como latin1 y "Cancún" llegaba mal; se prueba en e2e |
| Duplicados contra la base: solo con los folios del archivo | Se consulta `folio IN (...)` en lugar de toda la tabla |
| SheetJS se instaló desde su CDN oficial (`cdn.sheetjs.com`, 0.20.3) | La versión publicada en npm está desactualizada y tiene vulnerabilidades conocidas; `npm audit` de la API queda sin vulnerabilidades |
| Se agregaron al seed los 8 hoteles del archivo de ejemplo, sin usarlos para los 60 servicios de ejemplo | Con el catálogo genérico todas las filas salían como "Hotel no registrado"; los servicios de ejemplo del 10/11 no cambian |
| `GET /api/mayoristas` (solo lectura) | La pantalla necesitaba la lista para el selector y no existía |
| Grupo "Operación" al principio del menú | Es el trabajo diario; importar solo lo ven ADMINISTRADOR y COORDINADOR, como en la API |

## Problemas que surgieron y cómo se resolvieron

| Problema | Solución |
|---|---|
| `main` todavía no tenía la Fase 7 (su PR no se había abierto) y esta fase usa piezas de ella | Se abrió el PR #2; el alumno lo fusionó y la rama se creó desde `main` actualizado |
| El archivo de ejemplo estaba en `docs/evidencias/ejemplos/` | Se movió a `docs/ejemplos/`, como indica la estructura del proyecto |
| Para aceptar fechas guardadas como fecha real de Excel, la primera versión convertía cualquier número pequeño en hora: unos Pasajeros = 0 se habrían leído como "00:00" | La conversión se aplica solo a las columnas Fecha y Hora |
| La prueba de la fecha de Excel daba el 4 de noviembre | SheetJS convierte un `Date` de JavaScript con la zona horaria de la máquina (UTC−5); la prueba usa el número de serie de Excel, que no depende de la zona |
| El primer conteo de advertencias de modalidad dio 31 y no 28 | Las filas con error o duplicadas también muestran el aviso de modalidad; se cuentan solo las importables (28), que coincide con una cuenta independiente hecha sobre el CSV |
| La expresión para quitar el BOM del CSV quedó con el carácter invisible en el código | Se usa `String.fromCharCode(0xfeff)` |
| En e2e, el 401 con archivo adjunto fallaba con `ECONNRESET` | El guard responde antes de leer el archivo y cierra la conexión a mitad de la subida; las pruebas de 401 y 403 envían solo el campo del mayorista (los guards corren antes que la subida) |
| Dos commits se subieron con avisos del lint | Se corrigieron en commits `fix:` y desde entonces se revisa que el lint quede en 0 antes de cada commit |
| En la revisión visual, la columna Mensajes de la vista previa quedaba fuera de la pantalla y la tabla de Servicios se cortaba a 1440 px | Mensajes va después del folio y salta de línea; en Servicios el hotel va debajo de la ruta |

## Función destacada

`apps/api/src/importaciones/mapeo.ts`

```ts
export function interpretarTipo(texto: string): TipoInterpretado | null {
  const partes =
    /^(llegada|salida|traslado)(?: (privado|compartido|grupo))?$/.exec(
      normalizar(texto),
    );
  if (!partes) return null;
  const [, sentido, modalidad] = partes;
  return {
    tipo: sentido.toUpperCase() as TipoServicio,
    modalidad: modalidad
      ? (modalidad.toUpperCase() as ModalidadServicio)
      : MODALIDAD_POR_OMISION,
    modalidadAsumida: !modalidad,
  };
}
```

Convierte la columna "Tipo de Servicio" (por ejemplo "SALIDA COMPARTIDO" o "llegada") en los dos campos de la tabla servicio: tipo (sentido) y modalidad.
Primero normaliza el texto (sin acentos, minúsculas y un solo espacio) y luego una expresión regular exige el sentido y acepta la modalidad como opcional.
Si falta la modalidad usa la de omisión y lo indica con `modalidadAsumida`, para que la fila quede como ADVERTENCIA; si el texto no encaja devuelve null y la fila es ERROR.

## Resultado de las pruebas

- **Archivo de ejemplo** (`Layout_Servicios_Nexus`, 65 servicios del 05/11/2026), igual en .xlsx y en .csv:
  - 30 VÁLIDAS, 28 ADVERTENCIAS (modalidad no indicada), 2 DUPLICADAS (NX-15011 y NX-15044) y 5 ERRORES (3 "Zona no indicada" y 2 "Zona no registrada en el catálogo": "Riviera Maya").
  - Se importan 58 y se rechazan 7.
  - Los números se compararon con una cuenta independiente hecha sobre el CSV.
- **API, unitarias** (`npm run test:cov`): 16 suites y 170 pruebas aprobadas (antes 13 y 126).
  - Lectura y mapeo: el archivo de ejemplo en .xlsx y .csv con resultados idénticos, encabezado faltante con la lista, extensión no permitida, sin fila de "Folio", columnas en otro orden, fecha y hora como fecha real de Excel, archivo dañado, fecha inválida (31/02), hora inválida, pasajeros 0, -2, 2.5 y "dos", tipo inválido, duplicado contra la base, obligatorios y largos, hotel no registrado y vuelo faltante, interpretación del tipo y rutas.
  - `ImportacionesService`: vista previa sin guardar, duplicados solo con los folios del archivo, aviso de otra agencia, 400, 404, confirmación en transacción con bitácora, 400 sin filas importables y 409.
  - `ServiciosService`: filtros y día de Cancún.
- **API, cobertura**: **77.8 % de sentencias, 64.45 % de ramas, 68.16 % de funciones y 77.91 % de líneas** (antes 73.96 / 57.14 / 61.96 / 73.65). `mapeo.ts` 100 %; `procesar-filas.ts`, `lectura.ts` e `importaciones.service.ts` entre 95 % y 98 % de líneas.
- **API, e2e** (`npm run test:e2e`, contra `bestline_test`): 10 suites y 70 pruebas aprobadas (antes 8 y 55).
  - Importaciones: vista previa del .xlsx y del .csv sin guardar nada, confirmación con 58 servicios PENDIENTE (06:15 de Cancún = 11:15 UTC) y bitácora, reimportación con todo DUPLICADO y 400 al confirmar, historial y detalle (SUPERVISOR), 400 por encabezado faltante, extensión y falta de archivo, acentos del nombre, 403 y 401.
  - Servicios: día de Cancún (un servicio a las 23:30 cuenta en su día), filtros, 400, 403 del OPERADOR, 401 y lista de mayoristas.
- **Web** (`npm run test:cov`, Vitest): 10 archivos y 63 pruebas aprobadas (antes 8 y 54).
  - Vista previa: contadores de cada estado, aviso del archivo, estado y mensajes de cada fila, filtro al pulsar un contador (y quitarlo), filtro con el selector y estado vacío.
  - Pantalla Importar: archivo no permitido sin llamar a la API, encabezados faltantes y el flujo vista previa → confirmar con el mismo archivo y mayorista → detalle.
  - Menú: grupo Operación e "Importar servicios" solo para ADMINISTRADOR y COORDINADOR.
- **Web, cobertura**: **40.98 % de sentencias y 41.99 % de líneas** (antes 38.86 / 39.42). `VistaPrevia.tsx` 96 % e `ImportarPage.tsx` 94 % de líneas. Las pantallas Servicios, Historial y Detalle no tienen pruebas de Vitest.
- **Build y lint**: sin errores ni avisos en la API y en la web.
- **Revisión en el navegador** (Playwright, escritorio de 1440 px y móvil de 390 px), importando el archivo de ejemplo:
  - Como COORDINADOR: vista previa 65 / 30 / 28 / 2 / 5, filtros de errores y duplicadas, confirmación y detalle con 58 servicios, historial, reimportación del .csv con 60 duplicadas y el botón de confirmar deshabilitado, y Servicios del 05/11 filtrados por Llegada y Costa Mujeres (5).
  - Como SUPERVISOR: ve el historial, no ve "Importar servicios" y en `/importar` aparece "Acceso denegado".
  - En móvil no hay desborde horizontal en las tres pantallas.
  - Sin errores en la consola.
  - Al terminar, la base de desarrollo se restauró al estado del seed: se borraron la importación, sus 58 servicios y los registros de bitácora del recorrido.

## Capturas que se deben tomar

Antes de empezar:

1. En la raíz, `docker compose up -d`.
2. En `apps/api`, `npx prisma db seed` (carga los 8 hoteles del ejemplo) y `npm run start:dev`.
3. En `apps/web`, `npm run dev`.

Para Swagger (http://localhost:3000/api/docs) inicia sesión en `POST /api/auth/login` con `coordinador@bestline.local` (contraseña `SEED_PASSWORD_EJEMPLO` de `apps/api/.env`) y pega el `accessToken` en **Authorize**. En cada captura de Swagger deben verse la petición y la respuesta con su código.

**API en Swagger**

1. **Vista previa.** En `POST /api/importaciones/vista-previa`, "Try it out", en `archivo` elige `docs/ejemplos/Layout_Servicios_Nexus.xlsx`, escribe el id de Nexus Tours en `mayoristaId` (lo da `GET /api/mayoristas`) y "Execute". Debe verse el 200 con `totales`: total 65, validas 30, advertencias 28, duplicadas 2, errores 5, importables 58 y rechazadas 7.
2. **Encabezado faltante (400).**
   - Copia `docs/ejemplos/Layout_Servicios_Nexus.csv` como `sin_hora.csv`.
   - Ábrelo con el Bloc de notas y en la fila de encabezados cambia `Hora` por `Horario`.
   - Súbelo en la misma ruta. Debe verse el 400 con `"message": "Faltan encabezados: Hora"` y `"faltantes": ["Hora"]`.

**Pantallas (http://localhost:5173, como coordinador)**

3. **Vista previa.** Entra a Operación → Importar servicios, elige "Nexus Tours", arrastra `Layout_Servicios_Nexus.xlsx` y pulsa "Generar vista previa". Deben verse los contadores 65, 30, 28, 2 y 5 y la tabla con los Badges de estado.
4. **Filas con error.** Pulsa el contador "Errores". Deben verse "Mostrando 5 de 65 filas" y las filas NX-15018, NX-15025, NX-15032, NX-15055 y NX-15060 con sus mensajes ("Zona no indicada" y "Zona no registrada en el catálogo: "Riviera Maya"").
5. **Importación confirmada.**
   - Pulsa "Confirmar importación"; en el diálogo debe decir que se guardarán 58 servicios y se rechazarán 7.
   - Confírmalo. Debe abrirse el detalle con el aviso verde "Importación guardada: 58 servicios", la tarjeta con "58 guardadas · 7 rechazadas" y la tabla de servicios en estado Pendiente.
6. **Historial.** Pulsa "Volver al historial". Debe verse la fila de `Layout_Servicios_Nexus.xlsx` con Nexus Tours, Coordinador Ejemplo, 58 servicios y 7 rechazadas.
7. **Servicios con filtros.** Entra a Operación → Servicios. En Fecha elige el 05/11/2026, en Tipo "Llegada" y en Zona "Costa Mujeres". Deben verse 5 servicios (NX-15039, NX-15011, NX-15015, NX-15026 y NX-15046) ordenados por hora.

**Revalidación al confirmar (Swagger)**

8. En `POST /api/importaciones/confirmar` sube otra vez `Layout_Servicios_Nexus.xlsx` con el mismo `mayoristaId` y "Execute". Debe verse el 400 "El archivo no tiene filas válidas para importar": los 58 servicios ya existen y ahora salen como DUPLICADA.

**Pruebas (terminal)**

9. **API.** En `apps/api`, `npm run test:cov`. Deben verse "Test Suites: 16 passed", "Tests: 170 passed" y la fila "All files" (77.8 %), con `mapeo.ts` al 100 %.
10. **Web.** En `apps/web`, `npm run test:cov`. Deben verse "Test Files 10 passed (10)", "Tests 63 passed (63)" y la fila "All files" (40.98 %), con `VistaPrevia.tsx` e `ImportarPage.tsx`.

Al terminar, para regresar la base al estado del seed, en la raíz corre (cambia `<usuario_bd>` por el de tu `.env`):

```bash
docker compose exec db psql -U <usuario_bd> -d bestline -c "DELETE FROM servicio WHERE importacion_id IS NOT NULL; DELETE FROM importacion;"
```
