# 07 · Rutas sugeridas con mapa (Fase 12)

## Caso de uso y requerimientos

| Clave | Caso de uso | Qué cubre en esta fase |
|---|---|---|
| **CU por confirmar** | Consultar la ruta sugerida de una unidad | Recorrido de una unidad en el rol del día sobre el mapa, con paradas, horas, distancia y duración; comparación con otra unidad |

La memoria no está en el repositorio y las evidencias anteriores llegan hasta CU-16. No se inventó la clave del caso de uso ni el número de RF: hay que tomarlos de la memoria.

## Qué se hizo

Se implementó la consulta de la ruta sugerida de cada unidad sobre un mapa de OpenStreetMap. La API arma las paradas de la unidad a partir del rol del día: salida del encierro, origen y destino de cada servicio y, si el último destino no es zona de término, regreso al encierro. Cada parada lleva las horas del rol. Después pide a OSRM (Open Source Routing Machine) el trazado por carretera, la distancia y la duración de manejo. La pantalla *Rutas sugeridas* dibuja el trazado con Leaflet, numera las paradas en el mapa y en una lista lateral, centra el mapa en la parada que se elige y puede mostrar una segunda unidad en otro color. Si OSRM no responde, la pantalla sigue funcionando con líneas rectas y un aviso de trazado aproximado. Desde *Revisar rol*, cada unidad con servicios tiene un enlace *Ver ruta*.

## Cómo se hizo

- **No hizo falta migración.** `zona` y `hotel` ya tenían `latitud` y `longitud` (Decimal 9,6) y el seed ya traía coordenadas aproximadas de Cancún y la Riviera, con hoteles genéricos y sin direcciones de clientes. El encierro de cada vehículo es el nombre de una zona, así que se usan las coordenadas de esa zona.
- **Armado de paradas como función pura** (`rutas/armado-ruta.ts`, sin base de datos ni OSRM, para probarla sola):
  - *Salida del encierro*: la mayor entre la hora de cita y (inicio efectivo del primer servicio − traslado encierro → primer origen, de la matriz). Así refleja cuándo sale de verdad y no cuándo firma. La parada también lleva la hora de cita.
  - *Origen*: llega en el inicio efectivo y sale a la hora del servicio.
  - *Destino*: llega y queda libre en la liberación.
  - *Regreso al encierro*: solo si el último destino no es zona de término; llega en la liberación del último + traslado destino → encierro.
  - *Punto de cada parada*: el hotel del servicio si está en la zona de esa parada y del lado que le toca (en una LLEGADA el hotel es el destino; en SALIDA y TRASLADO, el origen); si no, las coordenadas de la zona.
- **OSRM solo desde la API** (`rutas/osrm.cliente.ts`). El navegador nunca lo consulta.
  - URL configurable con `OSRM_URL`; por defecto, el servidor público de demostración `https://router.project-osrm.org`.
  - Petición `/route/v1/driving/{lon,lat;…}?overview=full&geometries=geojson`, con límite de 5 s mediante `AbortController`.
  - Caché en memoria con la secuencia de coordenadas como llave (máximo 200 rutas; al llenarse se borra la más antigua).
  - Si OSRM falla, responde con error o tarda: 200 con segmentos rectos entre paradas, `trazado: "aproximado"`, distancia en línea recta (haversine) y `duracionMin: null`. Ese resultado no se guarda en caché, para que la siguiente consulta vuelva a intentar.
- **Pantalla** (`features/rutas`, `/rutas/:fecha`):
  - selector de fecha, de unidad (solo las que tienen servicios) y de unidad a comparar; la unidad va en la URL (`?unidad=10&comparar=9`);
  - mapa `react-leaflet` con teselas de OpenStreetMap y su atribución; trazado de la API (punteado si es aproximado);
  - marcadores numerados; el encierro tiene un icono de casa;
  - lista de paradas: al elegir una, el mapa la centra y abre su popup;
  - totales: distancia, duración de manejo y horario.

  En celular (< md) el mapa va arriba y la lista abajo. Leaflet se descarga en un archivo aparte, solo al abrir esta pantalla.

## Archivos principales

| Archivo | Qué tiene |
|---|---|
| `apps/api/src/rutas/armado-ruta.ts` | `armarParadas`, `salidaDelEncierro` y el punto de cada parada (hotel o zona) |
| `apps/api/src/rutas/osrm.cliente.ts` | `OsrmCliente` (caché, límite de 5 s, respaldo), `trazadoAproximado` y `distanciaRectaKm` |
| `apps/api/src/rutas/rutas.service.ts` | Lee el rol, las asignaciones de la unidad, el encierro y la matriz; 404 |
| `apps/api/src/rutas/rutas.controller.ts` | Endpoint y documentación de Swagger |
| `apps/web/src/features/rutas/RutasPage.tsx` | Pantalla, selectores, totales y aviso de trazado aproximado |
| `apps/web/src/features/rutas/MapaRuta.tsx` | Mapa, trazados, marcadores, popups, encuadre y centrado |
| `apps/web/src/features/rutas/ListaParadas.tsx`, `formato.ts` | Lista de paradas, numeración y agrupación de marcadores |
| `apps/web/src/features/roles/DatosUnidad.tsx` | Enlace *Ver ruta* en Revisar rol |

## Endpoint

Prefijo `/api`. Exige `Authorization: Bearer <token>`. Swagger (`/api/docs`, etiqueta *rutas*) tiene ejemplos de 200, 400, 401, 403 y 404.

| Método | Ruta | Quién | Respuestas |
|---|---|---|---|
| GET | `/roles/:fecha/rutas/:vehiculoId` | ADMINISTRADOR, COORDINADOR, SUPERVISOR | 200, 400 (fecha), 401, 403 (OPERADOR), 404 (sin rol, unidad sin servicios ese día o encierro que no es zona) |

La respuesta trae `vehiculo`, `operador`, `servicios`, `paradas[]` (`orden`, `tipo`, `nombre`, `zona`, `latitud`, `longitud`, `llegada`, `salida`, `horaCita` en el encierro y `servicio` con folio, pasajeros, origen y destino), `geometria` (GeoJSON LineString, `[longitud, latitud]`), `distanciaKm`, `duracionMin` y `trazado` (`carretera` o `aproximado`).

## Decisiones

| Decisión | Por qué |
|---|---|
| Servidor público de demostración de OSRM, configurable con `OSRM_URL` | Plan aprobado. Ese servidor admite como máximo ~1 petición por segundo y solo sirve para desarrollo y demostración; con la caché basta. En producción se cambia la URL por un OSRM propio en Docker con el mapa de México, sin tocar código |
| Las horas salen del rol; OSRM solo da trazado, distancia y duración | Plan aprobado. Las horas que valen son las del motor (inicio efectivo y liberación), no las de un servidor externo |
| Salida del encierro = la mayor entre la cita y (inicio efectivo − traslado al primer origen) | Indicado por el alumno al aprobar el plan |
| Regreso al encierro solo si el último destino no es zona de término | Plan aprobado; es la regla confirmada con la empresa |
| Con trazado aproximado, la duración se muestra como "—" | Plan aprobado; no se inventa una duración de manejo |
| El encierro no lleva número; las paradas de servicio se numeran 1, 2, 3… | El número coincide con la lista y el encierro se distingue por su icono |
| Las paradas que en pantalla se tocarían (a menos de 56 × 30 px) van en un solo marcador ("2·3·5·7"), con un popup que las lista todas | Cuando el mapa encuadra Cancún y Puerto Morelos, CUN, el encierro y los hoteles cercanos se enciman. Se calcula una vez, con el zoom del encuadre, y no en cada zoom; así el popup que abre la lista no se cierra solo |
| Al comparar, los marcadores de la segunda unidad bajan de 30 en 30 px (hasta 120) mientras choquen con los de la primera | Juntar paradas de dos unidades distintas en un marcador confundiría; así las dos se leen |
| La unidad elegida va en la URL | El enlace *Ver ruta* abre directo la unidad, y la vista se puede compartir |
| El resultado aproximado no se guarda en caché | Si OSRM vuelve, la siguiente consulta ya trae el trazado por carretera |
| Leaflet en un archivo aparte del build (`mapa`, 154 kB), sin arrastrar React | El archivo de librerías ya estaba cerca del límite de 600 kB y las demás pantallas no necesitan el mapa |
| Ninguna prueba consulta el OSRM real | Indicado por el alumno. Las unitarias reciben un `fetch` simulado; la e2e reemplaza el cliente con `overrideProvider` y, por seguridad, el entorno e2e apunta `OSRM_URL` a un puerto local cerrado |

## Problemas y soluciones

| Problema | Solución |
|---|---|
| `AbortSignal.timeout` usa temporizadores internos de Node que los temporizadores simulados de Jest no controlan, así que no se podía probar el límite de 5 s | `AbortController` + `setTimeout`, con `clearTimeout` al terminar; la prueba avanza el reloj simulado 5 s |
| En la e2e, un provider agregado al módulo raíz no reemplaza al de `RutasModule` | `crearApp` recibe una función para personalizar el módulo de prueba; la suite usa `overrideProvider(OsrmCliente)` |
| Revisión visual: en BL-08 y BL-09, el encierro (Centro Cancún) y el Hotel Plaza Caribe, a ~450 m, se encimaban; en BL-03, la etiqueta ancha de CUN tocaba la del Hotel ZH 2 | Agrupación por cercanía en pantalla (cajas de 56 × 30 px) al zoom del encuadre. Se volvió a medir: 0 marcadores encimados en las 10 unidades, en 1440 y en 390 px |
| Al comparar BL-10 con BL-09, los marcadores naranjas tapaban a los azules en CUN, el encierro y Puerto Morelos | Desplazamiento adaptativo de la unidad comparada y la principal siempre encima; 0 encimados |
| El CSS de Leaflet pone 17 px de margen a cada `<p>` del popup, y el popup de CUN tapaba medio mapa | Márgenes quitados en el popup y alto máximo de 280 px con desplazamiento |
| El enlace *Ver ruta* apretaba la columna fija de la línea de tiempo y partía "BL-01" y "Van · 14 pax" en dos renglones | El enlace pasó al renglón de la jornada |
| Al agregar Leaflet, el archivo de librerías del build pasó a 690 kB; al separarlo, el grupo `mapa` arrastró React y todas las pantallas lo cargaban | `includeDependenciesRecursively: false` en `advancedChunks`: `mapa` solo tiene Leaflet y solo lo pide `RutasPage` |
| El nombre accesible del botón de cada parada juntaba los textos ("Recoge· S-1Hotel…") | `aria-label` claro: "1. Recoge S-1, Hyatt Ziva Cancun, Llega 05:50 · Sale 06:00" |

## Resultado de las pruebas

| Suite | Resultado | Cobertura |
|---|---|---|
| API unitarias (`npm run test:cov`) | 308 de 308 en 24 suites (nuevas: `armado-ruta.spec.ts` 7, `osrm.cliente.spec.ts` 12, `rutas.service.spec.ts` 5) | Global 84.7 % de líneas. `armado-ruta.ts` y `osrm.cliente.ts` 100 %, `rutas.service.ts` 100 % de líneas; carpeta `rutas` 94.1 % (el controller se cubre con la e2e) |
| API e2e (`npm run test:e2e`) | 103 de 103 en 14 suites (nueva: `rutas.e2e-spec.ts`, 7 pruebas) | — |
| Web (`npm run test:cov`) | 100 de 100 en 15 archivos (nuevos: `RutasPage.test.tsx` 8 y `formato.test.ts` 4; más *Ver ruta* en Revisar rol y en el menú) | `features/rutas` 98.5 % de líneas |
| Lint y build | API y web sin avisos; `nest build` y `vite build` correctos | — |

Todo se corrió en PowerShell el 19/11/2026.

Qué comprueban:
- **Unitarias:**
  - armado: orden y tipo de paradas, horas del rol, salida del encierro por traslado o por cita, falta de tiempo en la matriz, regreso solo fuera de zona de término y hotel o zona;
  - caché: la segunda consulta no llama a OSRM, puntos repetidos y borrado de la más antigua;
  - respaldo: red caída, 503, sin ruta y más de 5 s, todos con "aproximado" y sin guardarse en caché.
- **e2e:** 200 por carretera con OSRM simulado (paradas, horas y totales); 200 aproximado cuando OSRM falla; la segunda consulta sale de la caché; 404 sin rol, 404 con unidad sin servicios o inexistente; 400 por fecha; 403 OPERADOR y 401 sin token. Además se comprueba que la URL consultada sea la de pruebas y no la real.
- **Vitest (Leaflet simulado):**
  - lista de paradas con horas y encierro sin número;
  - totales y atribución de OpenStreetMap;
  - marcadores agrupados y el icono del encierro;
  - centrar y abrir el popup al elegir una parada;
  - aviso de aproximado con "—";
  - selector de unidad (solo con servicios), unidad desde la URL y comparación en otro color;
  - rol inexistente.

## Revisión visual (Playwright)

Se hizo con Playwright fuera del proyecto, en 1440 × 900 y 390 × 844, como ADMINISTRADOR, con el rol del 10/11 que ya existía en la base (AUTORIZADO; la pantalla es de solo consulta y funciona igual con un rol PROPUESTO). En la revisión sí se usó el OSRM real, con al menos 1.1 s entre consultas por el límite del servidor público. Resultado:
- **Trazado por carretera** en las 10 unidades, con 2 400 a 4 100 vértices por ruta. Al centrar una parada de la Zona Hotelera, el trazado sigue el bulevar Kukulcán.
- **Marcadores:** 0 encimados en las 10 unidades, en 1440 y en 390 px, y también comparando BL-10 con BL-09.
- **Móvil (390 px):** el mapa arriba, la lista abajo y sin desborde horizontal.
- **Trazado aproximado:** con la API apuntando a un OSRM inalcanzable se ven las líneas punteadas rectas, la duración "—" y el aviso amarillo; la API registra `Trazado aproximado: fetch failed`.
- **Consola:** sin errores.

No se modificó la base de desarrollo: la pantalla y el endpoint solo leen.

## Capturas (máximo 8, en este orden)

**Unidad a usar: BL-10** (Autobús, 45 pax, id 10), con 5 servicios en el rol del 10/11. Su ruta tiene 12 paradas, recorre Zona Hotelera, CUN, Puerto Morelos y Costa Mujeres, y termina en Centro Cancún, que no es zona de término, así que muestra el regreso al encierro. Con el OSRM público mide **169.3 km** y **3 h 03 min** de manejo, de 13:15 a 20:30. La distancia puede variar unas décimas si el servidor actualiza su mapa.

Antes de empezar:
- la API (`npm run start:dev` en `apps/api`) y la web (`npm run dev` en `apps/web`) deben estar corriendo, y el equipo debe tener internet (teselas y OSRM);
- debe existir el rol del 10/11. Si no existe, genéralo en **Generar rol** con el 10/11/2026; no hace falta autorizarlo.

Inicia sesión como COORDINADOR (`coordinador@bestline.local`).

1. **Revisar rol con *Ver ruta*.** Abre `http://localhost:5173/roles/2026-11-10`. Cada unidad de la columna izquierda muestra **Ver ruta** junto a su jornada.
2. **Ruta de BL-10.** Desplaza la línea de tiempo hasta la fila de **BL-10** y presiona **Ver ruta**, que abre `http://localhost:5173/rutas/2026-11-10?unidad=10`. Deben verse:
   - totales: BL-10, 169.3 km, 3 h 03 min, 5 · 13:15 a 20:30;
   - el trazado azul por carretera;
   - el encierro con icono de casa ("⌂ 10"), los marcadores numerados ("1·4", "2·3·5·7", "6", "8·9");
   - la lista de paradas, de "Sale del encierro" a "Regresa al encierro";
   - la atribución "© OpenStreetMap contributors".
3. **Popup de un marcador agrupado.** Clic en el marcador **2·3·5·7** (Aeropuerto CUN). El popup lista las cuatro paradas con su folio, hora, origen → destino y pasajeros.
4. **Centrar desde la lista.** Clic en la parada **1 · Recoge · NEX-0035** de la lista. El mapa se acerca al Kempinski Hotel Cancun, en la Zona Hotelera, y abre su popup (1 y 4). El trazado sigue el bulevar.
5. **Comparar.** En **Comparar con** elige **BL-09 · Sprinter · 5 servicios**. Deben verse:
   - la ruta de BL-09 en naranja, con sus marcadores debajo de los azules, sin encimarse;
   - el texto "Comparando con BL-09: 158.5 km · 3 h 00 min de manejo · 5 servicios".
6. **Celular (390 px).** Con las DevTools en modo dispositivo de **390 px**, abre `http://localhost:5173/rutas/2026-11-10?unidad=10`. Arriba se ven los selectores y los totales, después el mapa y abajo la lista de paradas.
7. **Swagger.** En `http://localhost:3000/api/docs`:
   1. inicia sesión con `POST /api/auth/login` y pega el `accessToken` en **Authorize**;
   2. abre `GET /api/roles/{fecha}/rutas/{vehiculoId}` (etiqueta *rutas*) → **Try it out** con `fecha` = `2026-11-10` y `vehiculoId` = `10`;
   3. presiona **Execute**.

   En la respuesta **200** deben verse `paradas`, `geometria` (`"type": "LineString"`), `distanciaKm`, `duracionMin` y `"trazado": "carretera"`.
8. **Trazado aproximado.**
   1. Detén la API (Ctrl+C).
   2. En la misma terminal de PowerShell, en `apps/api`, corre `$env:OSRM_URL = 'http://127.0.0.1:9'; npm run start:dev`.
   3. Recarga `http://localhost:5173/rutas/2026-11-10?unidad=10`. Deben verse el aviso amarillo "Trazado aproximado: no se pudo consultar el servidor de rutas (OSRM)…", la duración "—", la distancia en línea recta (124.1 km) y líneas punteadas rectas entre paradas.
   4. Al terminar, detén la API, corre `Remove-Item Env:OSRM_URL` y vuelve a iniciarla.

## Fragmento de código candidato

`apps/api/src/rutas/armado-ruta.ts`, función `armarParadas` (18 líneas):

```ts
export function armarParadas(datos: DatosRuta): Parada[] {
  const { encierro: e, cita, asignaciones, tiempo } = datos;
  const [primera, ultima] = [asignaciones[0], asignaciones.at(-1)!];
  const enc = puntoEncierro(e);
  const traslado = tiempo(e.id, primera.servicio.zonaOrigen.id);
  const salida = salidaDelEncierro(cita, primera.inicioEfectivo, traslado);
  const paradas: Omit<Parada, 'orden'>[] = [
    { ...enc, tipo: 'ENCIERRO_SALIDA', llegada: null, salida, horaCita: cita },
    ...asignaciones.flatMap(paradasDelServicio),
  ];
  if (!ultima.servicio.zonaDestino.esZonaTermino) {
    const regreso = tiempo(ultima.servicio.zonaDestino.id, e.id);
    const llegada =
      regreso === undefined ? null : mas(ultima.liberacion, regreso);
    paradas.push({ ...enc, tipo: 'ENCIERRO_REGRESO', llegada, salida: null });
  }
  return paradas.map((p, i) => ({ ...p, orden: i + 1 }));
}
```

Arma la ruta de una unidad con las horas del rol: sale del encierro (la mayor entre la cita y lo justo para llegar al primer origen) y agrega el origen y el destino de cada servicio.
Agrega el regreso al encierro solo cuando el último destino no es zona de término, que es la regla de cierre confirmada con la empresa.
Es una función pura: no consulta la base ni OSRM, así que se prueba sola y OSRM solo agrega el trazado sobre estas paradas.
