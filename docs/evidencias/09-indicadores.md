# 09 · Indicadores y exportación del rol (Fase 14)

## Caso de uso y requerimientos

| Clave | Caso de uso | Qué cubre en esta fase |
|---|---|---|
| **CU por confirmar** | Consultar indicadores de operación | Cobertura, empalmes, no cubiertos por motivo, completados, cancelados, no show, incidencias, ocupación y horas de jornada por día y del rango |
| **CU por confirmar** | Exportar el rol del día | Rol por operador o de todos, en CSV y en PDF para imprimir |
| **RF-19, CU-20** | Tiempo de elaboración del rol | Minutos desde la última generación hasta la autorización, por día y promedio del rango |

Las claves RF-19 y CU-20 las indicó el alumno para el tiempo de elaboración. Las demás claves de caso de uso y de requerimiento no están en el repositorio; hay que tomarlas de la memoria.

## Tiempo de elaboración del rol (RF-19, CU-20)

- **Cálculo:** `autorizado_en − generado_en`, en minutos con un decimal, solo en roles AUTORIZADOS (`minutosElaboracion` en `indicadores/calculo.ts`). Un rol PROPUESTO muestra "—" y no cuenta como 0 en el promedio.
- **Promedio del rango:** media de los tiempos de los roles autorizados del rango.
- **Pantalla:** columna *Elaboración (min)* en la tabla *Por día* y fila *Promedio del rango*.
- **API:** `tiempoElaboracionMin` en cada día y `tiempoElaboracionPromedioMin` en el resumen de `GET /api/indicadores`. No se agregaron tablas ni columnas.
- **`generado_en` al regenerar:** se revisó y se actualiza correctamente. Faltaba una prueba y se agregó. Un rol AUTORIZADO no se puede regenerar (409), así que su tiempo ya no cambia.
- **Un solo reloj:** al crear el rol, `generado_en` venía de PostgreSQL (`now()`), y al regenerar y autorizar, de Node. Ahora las tres fechas usan `new Date()` de la API. Los timestamps históricos no se modificaron.

**Limitación:** el indicador mide desde la **última** generación. Si el rol se regeneró, el tiempo anterior a esa regeneración no se cuenta, porque `generado_en` guarda una sola fecha. Tampoco distingue tiempo de trabajo de tiempo de espera: un rol generado en la noche y autorizado a la mañana siguiente cuenta todas esas horas.

## Qué se hizo

Se implementaron los indicadores de la operación y la exportación del rol. La API calcula, para cada día de un rango de hasta 31 días:
- los servicios, los asignados y los no cubiertos por motivo, y el porcentaje de cobertura;
- los empalmes que encuentra el verificador independiente en los roles AUTORIZADOS;
- los completados, cancelados y no show, y las incidencias por tipo;
- la ocupación promedio y las horas de jornada de cada unidad.

La pantalla *Indicadores* muestra cuatro tarjetas (cobertura, empalmes, completados e incidencias), cuatro gráficas con Recharts y una tabla por día. El rol de un día se exporta en CSV para Excel o en PDF, de todos los operadores o de uno, desde *Revisar rol*; desde *Mi rol*, el operador descarga solo el suyo.

## Cómo se hizo

- **El cálculo es una función pura** (`indicadores/calculo.ts`). El servicio lee la base y le pasa los datos ya preparados, así se prueba con datos conocidos.
  - **Cobertura** = asignados / (asignados + no cubiertos) del rol del día. En el rango se calcula con todos los servicios, no como promedio de los porcentajes.
  - **Ocupación** = promedio de pasajeros / capacidad de cada servicio asignado.
  - **Horas de jornada** de una unidad: desde la cita del operador hasta la liberación de su último servicio. Si ese servicio no termina en zona de término, se suma el regreso en vacío a su encierro (la misma regla del motor).
  - Los servicios y las incidencias se agrupan por día en hora de Cancún.
- **Empalmes:**
  - Se extrajo de `autorizar` la llamada al verificador y quedó como `verificarRolGuardado` (`roles/revision.service.ts`). La usan la autorización y los indicadores; así los dos revisan con el mismo código.
  - Solo corre sobre roles AUTORIZADOS. En un rol PROPUESTO el valor es `null` y se muestra "—".
- **Exportación** (`exportacion/`):
  - Se arma el rol agrupado por unidad, con los servicios por inicio efectivo.
  - **CSV:** PapaParse, con BOM para que Excel respete los acentos y una fila por servicio.
  - **PDF:** pdfmake 0.2.23, aprobado por el alumno, con las fuentes estándar Helvetica, sin archivos de fuentes ni logos. Hoja carta horizontal; encabezado con el nombre del sistema y "Rol del 10/11/2026 · AUTORIZADO"; una tabla por unidad que no se parte entre páginas; pie con la fecha de generación y el número de página.
  - El hotel aparece bajo el origen en SALIDA y TRASLADO, y bajo el destino en LLEGADA.
  - El archivo se envía con `StreamableFile`, su `Content-Type` y `Content-Disposition: attachment; filename="rol-2026-11-10[-BL-06].pdf"`.
  - La API expone ese encabezado por CORS para que el navegador lea el nombre.
- **Permisos de exportación:**
  - ADMIN, COORD y SUPERVISOR exportan cualquier rol, PROPUESTO o AUTORIZADO.
  - El OPERADOR solo exporta el suyo y solo si está AUTORIZADO. Si pide otro `operadorId`, responde 403.
- **Web:**
  - *Indicadores* (`/indicadores?desde&hasta`): por omisión, los últimos 30 días.
  - Gráficas de una sola serie: un color validado con el script de la guía de visualización, sin leyenda (el título nombra la serie), rejilla discreta, tooltip y "Ver datos en tabla" debajo de cada una.
  - En celular, ocupación por unidad y no cubiertos por motivo usan barras horizontales para que se lean las etiquetas.
  - Recharts va en su propio archivo del build (`graficas`, 380 kB), que solo se descarga al abrir Indicadores.
  - Los botones *Exportar CSV* y *Exportar PDF* descargan con el token de la sesión (`descargar` en `api/cliente.ts`).

## Cambios para el diagrama entidad–relación

Los hizo la migración `20261119230000_monitoreo_estados_horas_usuario_operador` en la Fase 13, aprobada por el alumno. La Fase 14 no agregó tablas ni columnas.

| Tabla | Cambio | Tipo | Detalle |
|---|---|---|---|
| `servicio` | columna `inicio_real` | timestamptz, nula | Hora real en que pasó a EN_RUTA |
| `servicio` | columna `termino_real` | timestamptz, nula | Hora real en que pasó a COMPLETADO |
| `operador` | columna `usuario_id` | int, nula, **única**, FK → `usuario.id` (ON DELETE SET NULL) | Usuario con el que el operador entra a *Mi rol*. Relación 1 a 0..1 entre `usuario` y `operador` |
| enum `EstadoServicio` | valor `NO_SHOW` | — | El pasajero no se presentó. Queda: PENDIENTE, PROGRAMADO, EN_RUTA, EN_SERVICIO, COMPLETADO, CANCELADO, INCIDENCIA (ya no se usa como estado) y NO_SHOW |

## Archivos principales

| Archivo | Qué tiene |
|---|---|
| `apps/api/src/indicadores/calculo.ts` | `indicadoresDelDia`, `resumenDelRango`, `cobertura`, `ocupacionPromedio` y `horasJornada` |
| `apps/api/src/indicadores/indicadores.service.ts` | Lee el rango, agrupa por día de Cancún, corre el verificador y valida el rango (400) |
| `apps/api/src/roles/revision.service.ts` | `verificarRolGuardado` (extraído de `autorizar`) |
| `apps/api/src/exportacion/rol-exportado.ts` | `rolACsv`, `definicionPdf`, `rolAPdf` y `conHotel` |
| `apps/api/src/exportacion/exportacion.service.ts` | Rol por unidad y permisos del OPERADOR |
| `apps/web/src/features/indicadores/IndicadoresPage.tsx`, `Graficas.tsx`, `formato.ts` | Pantalla, tarjetas KPI, gráficas y tabla por día |
| `apps/web/src/features/roles/BotonesExportar.tsx` | Botones y selector de operador (Revisar rol y Mi rol) |

## Endpoints

| Método | Ruta | Quién | Respuestas |
|---|---|---|---|
| GET | `/indicadores?desde&hasta` | ADMIN, COORD, SUPERVISOR | 200, 400 (formato, fecha inexistente, desde > hasta o más de 31 días), 401, 403 |
| GET | `/roles/:fecha/exportar?formato=csv\|pdf&operadorId=` | ADMIN, COORD, SUPERVISOR; OPERADOR solo el suyo | 200 (`text/csv; charset=utf-8` o `application/pdf`, adjunto), 400, 401, 403 (operador con otro `operadorId`), 404 (sin rol, operador sin servicios, rol no autorizado para el OPERADOR) |

## Decisiones

| Decisión | Por qué |
|---|---|
| pdfmake 0.2.23 en el servidor con fuentes estándar | Aprobado por el alumno: tablas declarativas, sin navegador sin interfaz y sin archivos de fuentes. Helvetica cubre los acentos. Como no trae "→", origen y destino van en columnas separadas |
| Recharts 3.10.1 (versión exacta) | Estaba en el stack del proyecto. La 3.11.0 tenía 2 días de publicada |
| Empalmes solo en roles AUTORIZADOS, con el mismo verificador de la autorización | Es la red de seguridad del motor. En un rol PROPUESTO todavía se puede mover todo |
| Cobertura del rango = total de asignados / total de servicios del rol | Promediar porcentajes de días con distinto volumen da un número engañoso |
| Asignados y no cubiertos se toman del rol del día, sea PROPUESTO o AUTORIZADO, y se indica cuál es | El 05/11 solo tiene rol PROPUESTO y debe contar en los resultados |
| El OPERADOR solo exporta su rol AUTORIZADO | Un rol PROPUESTO todavía puede cambiar; *Mi rol* también solo muestra el autorizado |
| Gráficas de una serie con un solo color, sin leyenda y con tabla de datos | Guía de visualización: el color se validó contra el fondo; la tabla da acceso sin depender del color |
| Las horas de jornada usan la cita actual del operador | La base no guarda el historial de la hora de cita; para días pasados vale si no cambió |

## Problemas y soluciones

| Problema | Solución |
|---|---|
| En el PDF, el título de una unidad quedaba solo al pie de la página y su tabla en la siguiente | Título y tabla en un bloque `unbreakable` |
| El hotel aparecía siempre bajo "Destino", también en las SALIDAS (donde es la recogida) | `conHotel`: misma regla que Rutas sugeridas |
| En celular, las etiquetas del eje X de motivos y unidades se encimaban | Barras horizontales (siempre en motivos, en celular en unidades) con 28 px por barra |
| El valor del tooltip salía en el color de la serie | Va en color de texto (regla de la guía de visualización) |
| El navegador no podía leer el nombre del archivo descargado | `exposedHeaders: ['Content-Disposition']` en CORS |
| Supertest trataba el PDF como texto | En la e2e, el cuerpo binario se junta en un `Buffer` |
| Al quitar una línea de una prueba con PowerShell 5.1 (`Get-Content`), se dañaron los acentos | Se reescribió el archivo en UTF-8; ya no se usa `Get-Content` para editar |

## Resultado de las pruebas

| Suite | Resultado | Cobertura |
|---|---|---|
| API unitarias (`npm run test:cov`) | 374 de 374 en 30 suites (4 nuevas del tiempo de elaboración). Nuevas de la fase: `calculo.spec.ts`, que calcula cada indicador con un día de datos conocidos y el rango; `indicadores.service.spec.ts`; `rol-exportado.spec.ts`, con el CSV, el lado del hotel y un PDF real; y `exportacion.service.spec.ts`, con los permisos del operador | Global 85.5 % de líneas. `calculo.ts`, `exportacion.service.ts` y `rol-exportado.ts` al 100 %; `indicadores.service.ts` al 98 % (los controllers se cubren con la e2e) |
| API e2e (`npm run test:e2e`) | 118 de 118 en 16 suites. `roles.e2e-spec.ts` revisa que regenerar actualice `generado_en`. Nueva de la fase: `indicadores.e2e-spec.ts`, con 7 pruebas (una del tiempo de elaboración). Genera y autoriza un rol con la API real, y revisa la cobertura del 75 %, los 0 empalmes, CSV con `text/csv`, PDF con `application/pdf` que empieza con `%PDF`, el 403 del operador con otro `operadorId`, y los 400, 401 y 404 | — |
| Web (`npm run test:cov`) | 123 de 123. Nuevas de la fase: `IndicadoresPage.test.tsx`, con 8 pruebas y Recharts simulado (KPI, datos de cada gráfica, tiempo de elaboración, cambio de rango, vacío, sin datos, error y carga), y `BotonesExportar.test.tsx`, con 2 | `features/indicadores` 89.5 % de líneas, `BotonesExportar.tsx` 100 % |
| Lint y build | API y web sin avisos de lint; `nest build` y `vite build` correctos | — |

## Revisión visual (Playwright, 1440 y 390 px)

- **Monitoreo simulado:** para que las gráficas tuvieran datos de monitoreo, en el 10/11 NEX-0029 quedó completado, NEX-0051 como no show y TUI-0022 cancelado, y se registraron incidencias en NEX-0017 y TUI-0016. Al terminar, la base volvió a la foto previa:
  - 41 servicios PROGRAMADO sin horas reales;
  - 0 incidencias;
  - bitácora otra vez hasta el id 161.
- **Indicadores del 05/11 al 10/11:** 4 gráficas dibujadas y el tooltip de ocupación de BL-02 en "46.4 %". En celular la página mide 390 px de ancho.
- **Descargas:** `rol-2026-11-10-BL-06.pdf` y `rol-2026-11-10.csv` desde *Revisar rol*, y `rol-2026-11-10-BL-01.csv` desde *Mi rol*, como José Hernández.
- **Contenido:** el PDF de BL-06 cabe en una página y el CSV abre con acentos.
- No hubo errores de consola.

## Datos para Resultados

Valores de la base de desarrollo tal como la dejan el seed y la importación, sin monitoreo. `GET /api/indicadores?desde=2026-11-05&hasta=2026-11-10`, consultado el 19/11/2026.

| Indicador | 05/11 (importación de Nexus, rol PROPUESTO) | 10/11 (seed, rol AUTORIZADO) | Rango 05/11–10/11 |
|---|---|---|---|
| Servicios del día | 58 | 60 | 118 |
| Asignados | 46 | 41 | 87 |
| No cubiertos | 12 | 19 | 31 |
| · CAPACIDAD | 0 | 2 | 2 |
| · EMPALME | 11 | 14 | 25 |
| · JORNADA | 1 | 0 | 1 |
| · ZONA_TERMINO | 0 | 3 | 3 |
| · SIN_UNIDAD | 0 | 0 | 0 |
| Cobertura | 79.3 % | 68.3 % | 73.7 % |
| Empalmes (verificador) | — (rol PROPUESTO) | **0** | 0 |
| Completados / cancelados / no show | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| Incidencias | 0 | 0 | 0 |
| Ocupación promedio | 29.6 % | 30.2 % | 29.9 % |
| Tiempo de elaboración del rol | — (rol PROPUESTO) | 12.9 min (**dato de prueba**) | 12.9 min (**dato de prueba**) |

**El 12.9 min es un dato de prueba, no un tiempo real de la empresa.** Sale de `generado_en` (11/11/2026 23:20:27) y `autorizado_en` (11/11/2026 23:33:18) del rol del 10/11, que se generó y autorizó durante el desarrollo. No debe presentarse como tiempo real de elaboración en Resultados.

Completados, cancelados, no show e incidencias están en 0 porque en la base de desarrollo todavía no se ha registrado el monitoreo de esos días. Las capturas se tomaron con un monitoreo simulado que después se revirtió.

**Ocupación y horas de jornada por unidad** (jornada máxima 9.5 h):

| Unidad | 05/11: servicios · ocupación · jornada | 10/11: servicios · ocupación · jornada |
|---|---|---|
| BL-01 (Van 14) | 4 · 46.4 % · 9.25 h | 3 · 50.0 % · 9.50 h |
| BL-02 (Van 14) | 4 · 35.7 % · 7.83 h | 4 · 57.1 % · 8.92 h |
| BL-03 (Van 14) | 3 · 23.8 % · 6.92 h | 4 · 30.4 % · 8.42 h |
| BL-04 (Van 14) | 5 · 34.3 % · 8.33 h | 4 · 35.7 % · 8.75 h |
| BL-05 (Sprinter 20) | 5 · 42.0 % · 9.25 h | 4 · 21.3 % · 7.42 h |
| BL-06 (Sprinter 20) | 5 · 24.0 % · 8.50 h | 4 · 28.8 % · 8.00 h |
| BL-07 (Sprinter 20) | 5 · 28.0 % · 9.42 h | 3 · 41.7 % · 8.17 h |
| BL-08 (Sprinter 20) | 6 · 28.3 % · 9.33 h | 5 · 25.0 % · 9.33 h |
| BL-09 (Sprinter 20) | 5 · 20.0 % · 9.00 h | 5 · 16.0 % · 6.75 h |
| BL-10 (Autobús 45) | 4 · 12.2 % · 9.08 h | 5 · 12.9 % · 7.50 h |

Ninguna unidad pasa de la jornada máxima de 9.5 h; BL-01 la usa completa el 10/11. La ocupación más baja es la del autobús (45 lugares), porque la mayoría de los servicios son de 2 a 12 pasajeros.

## Capturas (máximo 8, en este orden)

Antes de empezar:
- la API y la web deben estar corriendo;
- inicia sesión como COORDINADOR (`coordinador@bestline.local`);
- para tener datos de monitoreo, en *Monitoreo* del 10/11 (evidencia 08) aplica: NEX-0029 → Iniciar, Pasajeros a bordo y Completar; NEX-0051 → Marcar no show; TUI-0022 → Cancelar servicio; y registra un *Retraso* en NEX-0017 y una *Falla mecánica* en TUI-0016;
- al terminar las capturas, regresa la base con el comando de la evidencia 08.

1. **Indicadores.**
   - Abre `http://localhost:5173/indicadores?desde=2026-11-05&hasta=2026-11-10` a 1440 px, en página completa.
   - Tarjetas: Cobertura 73.7 % (87 de 118), Empalmes 0 con ✓, Completados 1 (1 cancelado · 1 no show) e Incidencias 2.
   - Las cuatro gráficas y la tabla *Por día* con 05/11 *Propuesto* (empalmes "—") y 10/11 *Autorizado* (empalmes 0).
2. **Tooltip.** Pasa el mouse sobre la barra de BL-02 en *Ocupación por unidad*: debe verse "BL-02 46.4 %".
3. **Celular.** DevTools a 390 px y la misma URL. Deben verse las tarjetas en dos columnas, las barras horizontales en motivos y unidades, y ningún desplazamiento horizontal de la página.
4. **Un día con rol PROPUESTO.** `http://localhost:5173/indicadores?desde=2026-11-05&hasta=2026-11-05`: cobertura 79.3 % y empalmes "—" ("Sin roles autorizados en el rango").
5. **Exportar desde Revisar rol.** `http://localhost:5173/roles/2026-11-10`: en *Exportar el rol*, elige **BL-06 · Ricardo Díaz**. Deben verse el selector y los botones *Exportar CSV* y *Exportar PDF*.
6. **PDF.**
   - Pulsa **Exportar PDF** y abre `rol-2026-11-10-BL-06.pdf`.
   - Debe tener el encabezado "Best Line · Sistema de asignación y monitoreo" y "Rol del 10/11/2026 · AUTORIZADO".
   - Debajo, la tabla de BL-06 con NEX-0029, TUI-0022, NEX-0017 y NEX-0051, y en el pie la fecha de generación y "Página 1 de 1".
7. **Mi rol con exportación.** Entra como OPERADOR (`operador@bestline.local`) a 390 px en `http://localhost:5173/mi-rol/2026-11-10`. Deben verse *Exportar CSV* y *Exportar PDF* bajo el encabezado de José Hernández; al pulsar uno se descarga `rol-2026-11-10-BL-01.csv` o `.pdf`.
8. **Swagger.** `http://localhost:3000/api/docs#/Indicadores` → *GET /api/indicadores*. Deben verse la descripción de cada indicador y los ejemplos de 200, 400, 401 y 403.

## Fragmento de código candidato

`apps/api/src/indicadores/calculo.ts` (17 líneas):

```ts
export function horasJornada(
  servicios: AsignacionDia[],
  zonasTermino: ReadonlySet<number>,
  tiempo: DatosDia['tiempo'],
): number | null {
  const ultimo = servicios.reduce<AsignacionDia | undefined>(
    (u, s) => (!u || s.liberacion > u.liberacion ? s : u),
    undefined,
  );
  if (!ultimo?.cita) return null;
  const regreso =
    zonasTermino.has(ultimo.destinoId) || ultimo.encierroId === null
      ? 0
      : (tiempo(ultimo.destinoId, ultimo.encierroId) ?? 0);
  const fin = ultimo.liberacion.getTime() + regreso * MINUTO;
  return redondear((fin - ultimo.cita.getTime()) / (60 * MINUTO), 2);
}
```

Busca el servicio que libera más tarde a la unidad. Si termina fuera de una zona de término, suma el regreso en vacío a su encierro según la matriz de tiempos, como lo exige la regla de la empresa. El resultado son las horas desde la cita del operador hasta ese fin, que se comparan con la jornada máxima de 9.5 h.
