# 03 · Usuarios, bitácora, parámetros de operación y matriz de tiempos (Fase 7)

## Qué se hizo

Se implementaron la administración de usuarios (CU-03, RF-02), la consulta de la bitácora (CU-04, RF-03), la edición de los parámetros de operación (CU-08, RF-07), el marcado de zonas de término y la matriz de tiempos de traslado entre zonas (CU-09, RF-08), tanto en la API como en el frontend. En la API se agregaron los endpoints con su documentación completa en Swagger (ejemplos de petición y de respuesta para 200/201, 400, 401, 403, 404 y 409), validaciones por clave para los parámetros y por celda para la matriz, guardado de varios valores en una sola transacción y registro de cada cambio en la bitácora dentro de la misma transacción, guardando el valor anterior y el nuevo en el texto de la acción sin agregar columnas. En el frontend se agregaron las pantallas de Usuarios y Bitácora en el grupo "Administración" (solo ADMINISTRADOR) y las de Parámetros, Zonas de término y Matriz de tiempos en el grupo "Configuración" (el coordinador y el supervisor las ven en modo consulta), con los componentes de shadcn/ui ya existentes. Por último, se configuraron Vitest y React Testing Library en el frontend con reporte de cobertura. En una revisión posterior se amplió la columna `bitacora.accion` a 255 caracteres con una migración, se agregó la regla de que siempre debe existir al menos una zona de término y se agregaron pruebas de las pantallas de listado de vehículos y usuarios.

## Endpoints

Todas las rutas llevan el prefijo `/api` y exigen `Authorization: Bearer <token>`.

| Método | Ruta | Quién | Descripción | Respuestas |
|---|---|---|---|---|
| GET | `/usuarios` | ADMINISTRADOR | Listado con `buscar` (nombre o correo), `rol`, `activo`, `pagina`, `limite`. Nunca devuelve `password_hash` | 200, 400, 401, 403 |
| GET | `/usuarios/:id` | ADMINISTRADOR | Un usuario | 200, 400, 401, 403, 404 |
| POST | `/usuarios` | ADMINISTRADOR | Alta con contraseña cifrada con bcrypt; el correo se guarda en minúsculas | 201, 400, 401, 403, 409 |
| PATCH | `/usuarios/:id` | ADMINISTRADOR | Edición de nombre y rol. Un administrador no puede quitarse su propio rol | 200, 400, 401, 403, 404 |
| PATCH | `/usuarios/:id/password` | ADMINISTRADOR | Cambio de contraseña (bcrypt) | 200, 400, 401, 403, 404 |
| PATCH | `/usuarios/:id/desactivar` | ADMINISTRADOR | `activo = false`; su token deja de funcionar. Un administrador no puede desactivarse a sí mismo | 200, 400, 401, 403, 404 |
| PATCH | `/usuarios/:id/reactivar` | ADMINISTRADOR | `activo = true` | 200, 400, 401, 403, 404 |
| GET | `/bitacora` | ADMINISTRADOR | Filtros `usuarioId`, `desde`, `hasta` (días de Cancún, ambos incluidos), `accion`, `entidad`; del más reciente al más antiguo, con paginación | 200, 400, 401, 403 |
| GET | `/parametros` | Autenticado | Parámetros de operación ordenados por clave | 200, 401 |
| PUT | `/parametros` | ADMINISTRADOR | Guarda varios parámetros en una transacción (todo o nada), validados por clave | 200, 400, 401, 403, 404 |
| PATCH | `/zonas/:id/zona-termino` | ADMINISTRADOR | Marca o desmarca una zona de término. Desmarcar la última responde 400 "Debe existir al menos una zona de término" | 200, 400, 401, 403, 404 |
| GET | `/tiempos-traslado/matriz` | Autenticado | Zonas, matriz origen × destino en minutos (`null` = falta) y lista de combinaciones faltantes | 200, 401 |
| PUT | `/tiempos-traslado/matriz` | ADMINISTRADOR | Crea o actualiza varias celdas en una transacción (enteros de 1 a 300) | 200, 400, 401, 403 |

Reglas de validación de `PUT /parametros` (mismas en el frontend con Zod):

| Clave | Regla |
|---|---|
| `hora_cita.turno_1`, `hora_cita.turno_2` | Formato `HH:mm` de 24 horas (00:00 a 23:59) |
| `jornada_maxima_horas` | Número de 1 a 12 horas, hasta 2 decimales (9.5 = nueve horas y media) |
| `anticipacion.PRIVADO`, `.COMPARTIDO`, `.GRUPO` | Minutos enteros de 0 a 120 |

Cuando un valor no cumple su regla, la API responde 400 con `message` (lista de textos, como el resto de la API) y además `errores`, que indica a qué campo o celda pertenece cada error:

```json
{
  "message": ["jornada_maxima_horas debe ser un número de horas entre 1 y 12"],
  "errores": [{ "clave": "jornada_maxima_horas", "mensaje": "debe ser un número de horas entre 1 y 12" }],
  "error": "Bad Request",
  "statusCode": 400
}
```

En la matriz, cada error lleva `zonaOrigenId` y `zonaDestinoId` en lugar de `clave`.

## Decisiones técnicas

| Decisión | Por qué |
|---|---|
| El detalle del cambio va en el texto de la acción de la bitácora: `ACTUALIZAR: 9.5 → 10`, `ACTUALIZAR: rol SUPERVISOR → OPERADOR`, `CREAR: 10 min` | La tabla `bitacora` no tiene columna de detalle y no se agregan columnas. La columna `accion` se amplió de `VarChar(50)` a `VarChar(255)` con la migración `amplia_accion_bitacora` (solo cambia el tamaño, no agrega columnas ni pierde datos), así que el texto se guarda completo, sin recortes. La clave del parámetro o el par de zonas se identifica con `entidad` y `entidad_id` |
| El filtro por acción de la bitácora usa "empieza con" | Así `accion=ACTUALIZAR` también encuentra los registros con detalle |
| Las fechas del filtro de la bitácora son días de Cancún (UTC-05:00), ambos incluidos; `desde` posterior a `hasta` → 400 | Las fechas se guardan en UTC y se muestran en America/Cancun. Se reutilizó `rangoDelDia`, que se movió de `resumen/` a `comun/fechas.ts` |
| Parámetros y matriz se guardan con un solo `PUT` que recibe varios valores, en una transacción | El formulario y la matriz tienen un solo botón "Guardar cambios": si un valor es inválido no se guarda ninguno y no queda la configuración a medias. Clave inexistente → 404 con la lista de claves |
| Solo se escriben y registran los valores que cambiaron | La bitácora queda limpia: guardar sin cambios no genera registros |
| La validación por clave (parámetros) y por celda (matriz) se hace en el servicio, no en el DTO | `class-validator` devuelve mensajes generales ("parametros.2.valor…"); en el servicio se puede responder qué campo o celda falló. El DTO solo revisa la forma del cuerpo |
| La matriz incluye la diagonal (de una zona a la misma zona) | El motor necesita el tiempo de traslado dentro de la misma zona; el seed ya lo trae (10 min) |
| No se puede vaciar una celda que ya tiene tiempo | No hay endpoint para borrar tiempos; el frontend lo marca como error en lugar de ignorarlo |
| Usuarios: el correo no se edita; contraseña de 8 a 72 caracteres | El correo identifica al usuario en el login. bcrypt solo considera los primeros 72 bytes. `CAMBIAR_PASSWORD` se registra en la bitácora sin la contraseña |
| Un administrador no puede quitarse el rol ni desactivarse (400) | Siempre queda al menos un administrador activo. El frontend también lo refleja: el rol aparece bloqueado y la opción "Desactivar" deshabilitada en la fila propia |
| `@Roles(ADMINISTRADOR)` a nivel de clase en usuarios y bitácora | Todo el módulo es de administración; se evita olvidarlo en una ruta nueva |
| "Configuración" visible para ADMINISTRADOR, COORDINADOR y SUPERVISOR; "Administración" solo para ADMINISTRADOR | Igual que los catálogos: la API deja leer parámetros y matriz a cualquier rol autenticado, pero al OPERADOR no le sirven estas pantallas |
| El menú arma sus grupos a partir de la lista de opciones (`menuAgrupado`) | Agregar una pantalla es agregar una línea a `MENU`; la misma función se prueba con Vitest |
| Zonas de término: cada casilla guarda al momento | Es un cambio de un solo valor |
| Siempre debe existir al menos una zona de término (400 "Debe existir al menos una zona de término") | Regla del motor: el último servicio de cada unidad debe terminar en una zona de término. Se revisa en las tres formas de perder la última: desmarcarla (`PATCH /zonas/:id/zona-termino`), editarla (`PATCH /zonas/:id`) o eliminarla (`DELETE /zonas/:id`). La revisión (`exigirOtraZonaTermino`) cuenta las otras zonas de término dentro de la misma transacción del cambio. El frontend muestra el mensaje en un aviso rojo y la casilla sigue marcada |
| Vitest reutiliza `vite.config.ts` | Mismo alias `@/` y mismo plugin de React que la aplicación |
| La cobertura web no mide `src/components/ui/**`, `main.tsx` ni los archivos de tipos (`tipos.ts`, `*.d.ts`) | Los componentes de shadcn/ui son código copiado de una librería, `main.tsx` solo arranca la aplicación y los tipos no tienen lógica; medirlos solo distorsiona el porcentaje |
| Las pruebas de pantallas simulan la API reemplazando `fetch` (`src/pruebas/api-simulada.ts`) | Se prueban la pantalla y el cliente HTTP reales; cada prueba revisa qué peticiones y filtros se enviaron |

## Problemas que surgieron y cómo se resolvieron

| Problema | Solución |
|---|---|
| React Hook Form interpreta el punto de `hora_cita.turno_1` como un objeto anidado | El esquema de Zod del formulario usa objetos anidados con las mismas claves (`hora_cita.turno_1` → `hora_cita: { turno_1 }`); `aValores` y `aLista` convierten de y hacia la lista de la API |
| El frontend necesitaba los errores por campo y por celda que devuelve la API | `ErrorApi` (en `api/cliente.ts`) ahora conserva el cuerpo completo de la respuesta (`datos`); el formulario de parámetros llama `setError` por clave y la matriz pinta la celda |
| Los componentes Select y Checkbox de Radix fallan en jsdom (faltan `ResizeObserver`, `hasPointerCapture` y `scrollIntoView`) | Se simulan en `src/pruebas/configuracion.ts`; con eso la prueba del vehículo abre el Select y elige "Sprinter" como lo haría un usuario |
| En la revisión en el navegador, las celdas con error de la matriz casi no se distinguían y las celdas sin editar no parecían editables | Se definió una prioridad de resaltado (error rojo con contorno > modificada azul > faltante ámbar > normal con borde) y se revisó de nuevo con una zona temporal que dejó 17 combinaciones faltantes |
| La prueba e2e del filtro de fechas de la bitácora encontraba registros de más | Los inicios de sesión de la propia prueba caen dentro del rango; la prueba ignora `INICIO_SESION` |
| La regla de "al menos una zona de término" podía saltarse por otras rutas | Además de la casilla, una zona se puede desmarcar con la edición general o eliminarse; la misma revisión se aplicó en las tres operaciones, con pruebas unitarias para cada una y e2e para la casilla y la edición |
| `npm audit` reporta 6 avisos (2 bajos, 4 moderados) en el frontend | Todos vienen del paquete de línea de comandos `shadcn` (`deepmerge` y `minimatch`), que solo se usa para copiar componentes y no forma parte del build. Ya estaban antes de esta fase; la única corrección es `npm audit fix --force`, que bajaría shadcn a la versión 1.0, así que no se aplicó |

## Función destacada

`apps/api/src/parametros/reglas.ts`

```ts
export function validarParametro(clave: string, valor: string): string | null {
  if (clave.startsWith('hora_cita.')) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(valor)
      ? null
      : 'debe tener el formato HH:mm (00:00 a 23:59)';
  }
  if (clave === 'jornada_maxima_horas') {
    const horas = Number(valor);
    return /^\d{1,2}(\.\d{1,2})?$/.test(valor) && horas >= 1 && horas <= 12
      ? null
      : 'debe ser un número de horas entre 1 y 12';
  }
  if (esMinutos(clave)) {
    return /^\d{1,3}$/.test(valor) && Number(valor) <= 120
      ? null
      : 'debe ser un número entero de minutos entre 0 y 120';
  }
  return 'no tiene una regla de validación definida';
}
```

Cada parámetro se valida según el prefijo de su clave, con una expresión regular para el formato y una comparación para el rango.
Devuelve el mensaje de error en lugar de lanzar una excepción, para que el servicio junte los errores de todas las claves y responda un solo 400 con `errores`.
Es una función pura (sin base de datos), así que sus 17 casos se prueban directamente; el frontend repite las mismas reglas con Zod.

## Resultado de las pruebas

- **API, unitarias** (`npm run test:cov`): 13 suites y 126 pruebas aprobadas (antes 9 y 76).
  - `UsuariosService`: filtros sin `password_hash`, bcrypt en alta y cambio de contraseña, 409 por correo repetido, cambio de rol en la bitácora, 400 al quitarse el rol o desactivarse, reactivar e idempotencia.
  - `BitacoraService` y `textoAccion`: orden, paginación, filtros, rango de días de Cancún, 400 por rango invertido y un texto de acción largo que se guarda completo.
  - `validarParametro` (17 casos) y `ParametrosService`: solo cambia lo modificado, bitácora con antes y después, 400 por clave sin guardar nada, 404 y claves repetidas.
  - `TiemposTrasladoService`: matriz con faltantes, guardado en transacción con `ACTUALIZAR`/`CREAR` y 400 con el error de cada celda.
  - `ZonasService`: marcar con bitácora, sin cambios, 404 y 400 al quitar la última zona de término (al desmarcar, editar o eliminar); se permite si queda otra.
- **API, cobertura**: **73.96 % de sentencias, 57.14 % de ramas, 61.96 % de funciones y 73.65 % de líneas** (antes 69.5 / 49.78 / 55.44 / 69.45). Los servicios nuevos tienen 100 % de líneas.
- **API, e2e** (`npm run test:e2e`, contra `bestline_test`): 8 suites y 55 pruebas aprobadas (antes 4 y 22).
  - Usuarios: 201 con hash bcrypt y login del usuario nuevo, 409, 400, 200 con filtros, 403, 401, 404, edición con bitácora, 400 por quitarse el rol o desactivarse, cambio de contraseña (la anterior deja de servir) y desactivar/reactivar con su efecto en el login.
  - Bitácora: orden, filtros por entidad, acción, usuario y fechas (un registro a las 23:30 de Cancún cuenta en su día), un texto de acción de más de 190 caracteres guardado y devuelto completo (columna de 255), 400, 403 y 401.
  - Parámetros: 200 para coordinador, 401, 200 con la bitácora `ACTUALIZAR: 9.5 → 10`, 400 sin guardar ninguno, 404 y 403.
  - Matriz y zonas de término: faltantes, guardado completo con bitácora, 400 sin guardar ninguna celda, 403, y 200/400/403/404 al marcar una zona, incluido el 400 al quitar la última zona de término por la casilla y por la edición general (la zona sigue marcada).
- **Web** (`npm run test:cov`, Vitest + React Testing Library): 8 archivos y 54 pruebas aprobadas.
  - Login: esquema, errores de validación sin llamar a la API, correo mal escrito y llamada a `POST /auth/login` con el 401 en pantalla.
  - Vehículo: regla de capacidad de los 4 tipos, error bajo el campo y cambio de tipo a Sprinter con el Select.
  - Menú según el rol: opciones y grupos de los 4 roles, enlaces del menú lateral y opción activa.
  - Parámetros: reglas del esquema, errores en pantalla sin enviar, envío de las 6 claves, error de la API en su campo y modo consulta.
  - Matriz: validación de celdas y armado de los cambios.
  - Pantalla de vehículos: esqueleto mientras carga y luego las filas, estado vacío, error de la API, búsqueda y filtro por tipo enviados a la API (sin mandar "todos"), y botón "Nuevo vehículo" y acciones por fila solo para ADMINISTRADOR (COORDINADOR y SUPERVISOR ven "Solo consulta").
  - Pantalla de usuarios (dentro de la misma ruta protegida que usa la aplicación): carga, estado vacío, filtros de rol y estado, "Nuevo usuario" y acciones para el ADMINISTRADOR (con "Desactivar" deshabilitado en su propia fila y "Reactivar" en un inactivo), y "Acceso denegado" sin botones ni peticiones para los otros 3 roles.
  - Zonas de término: el 400 de la API se muestra en un aviso y la casilla sigue marcada; el coordinador ve las casillas deshabilitadas.
- **Web, cobertura** (sin `src/components/ui/**`, `main.tsx` ni archivos de tipos): **38.86 % de sentencias, 39.52 % de ramas, 34.43 % de funciones y 39.42 % de líneas** (antes 19.09 % de sentencias). `menu.ts`, `Navegacion.tsx`, `celdas.ts`, `TablaDatos.tsx`, `BarraFiltros.tsx`, `Encabezado.tsx`, `AccionesFila.tsx` y los esquemas de login, vehículo y parámetros quedan al 100 % de líneas; `FormularioParametros.tsx` 94 %, `ZonasTerminoPage.tsx` 88 %, `catalogos/api.ts` 84 %, `VehiculosPage.tsx` 63 % y `UsuariosPage.tsx` 48 % (lo que falta en estas dos es guardar, desactivar y cambiar contraseña). Sin pruebas todavía: las pantallas de operadores, zonas, hoteles, bitácora, matriz e inicio, y el layout.
- **Build y lint**: `npm run build` y `npm run lint` sin errores ni avisos en la API y en la web.
- **Revisión en el navegador** (recorrido automatizado con Playwright fuera del proyecto, escritorio de 1440 px y móvil de 390 px):
  - Usuarios: validación del alta, alta, 409, edición de rol, cambio de contraseña, desactivar, reactivar y la opción deshabilitada en la fila propia.
  - Bitácora con filtros y aviso de rango invertido.
  - Parámetros: validación, guardado y regreso al valor original.
  - Zonas de término: marcar y desmarcar; al quitar la última (con Aeropuerto CUN ya desmarcada, desmarcar Zona Hotelera) aparece el aviso rojo "Debe existir al menos una zona de término" y la casilla sigue marcada.
  - Matriz: errores locales, guardado, celdas faltantes con una zona temporal y 400 por celda desde la API.
  - Coordinador: Configuración en modo consulta, sin Administración y "Acceso denegado" en `/usuarios`.
  - Móvil: menú ☰ con los tres grupos y sin desborde horizontal en las cinco pantallas (las tablas se desplazan).
  - Sin errores de React en la consola; el único error fue el 409 esperado. Los datos creados durante el recorrido se borraron y los valores modificados se regresaron a los del seed.

## Capturas que se deben tomar

Antes de empezar:

1. En la raíz, `docker compose up -d`.
2. En `apps/api`, `npx prisma migrate dev` (aplica la migración `amplia_accion_bitacora` si tu base aún no la tiene), `npx prisma db seed` y luego `npm run start:dev`.
3. En `apps/web`, `npm run dev`.

Las contraseñas están en `apps/api/.env` (`ADMIN_PASSWORD` y `SEED_PASSWORD_EJEMPLO`).

Para las capturas de Swagger (http://localhost:3000/api/docs), primero obtén el token: en `POST /api/auth/login`, "Try it out" con el correo y la contraseña del administrador, "Execute", copia el `accessToken` y pégalo en **Authorize**. En cada captura deben verse la petición (cuerpo o parámetros) y la respuesta con su código.

**API en Swagger**

1. **Parámetros, 400.** En `PUT /api/parametros`, "Try it out", elige el ejemplo "Valores inválidos (400)" y "Execute". Debe verse el código 400 con `errores` para `jornada_maxima_horas` y `hora_cita.turno_1`.
2. **Parámetros, 403.** Inicia sesión en `POST /api/auth/login` con `coordinador@bestline.local`, pega ese token en Authorize y repite `PUT /api/parametros` con el ejemplo "Cambios válidos". Debe verse el 403 "No tienes permiso para realizar esta acción". Después vuelve a autorizarte con el token del administrador.
3. **Matriz.** En `GET /api/tiempos-traslado/matriz`, "Execute". Deben verse las 8 zonas, la matriz de 8 × 8 con minutos, `"faltantes": []` y `"completa": true`.
4. **Matriz, 400 por celda.** En `PUT /api/tiempos-traslado/matriz`, elige el ejemplo "Minutos fuera de rango (400)" y "Execute". Debe verse el 400 con `errores` para Zona Hotelera → Tulum y Aeropuerto CUN → Tulum.
5. **Usuarios.** En `POST /api/usuarios`, elige el ejemplo "Usuario nuevo", cambia `<contraseña-nueva>` por una de al menos 8 caracteres y "Execute". Debe verse el 201 con `id`, `nombre`, `email`, `rol` y `activo`, sin ningún campo de contraseña.
6. **Bitácora.** En `GET /api/bitacora`, elige `usuario` en `entidad` y `CREAR` en `accion`, y "Execute". Debe verse el 200 con el registro `CREAR` del usuario de la captura 5 (su `entidadId` es el `id` que devolvió el alta), la fecha y el nombre y correo del administrador.

**Pantallas (http://localhost:5173, como administrador)**

7. **Usuarios.** Entra a Administración → Usuarios. Debe verse la tabla con los 5 usuarios (el tuyo con "(tú)"), sus Badges de rol y estado. Abre el menú "⋯" del usuario de la captura 5 para que se vean "Editar", "Cambiar contraseña" y "Desactivar".
8. **Parámetros con error.** Entra a Configuración → Parámetros. En "Jornada máxima" escribe `15` y en "Turno 1" escribe `4:30`; pulsa "Guardar cambios". Deben verse los mensajes en rojo bajo cada campo ("Debe estar entre 1 y 12 horas" y "Usa el formato HH:mm…"). Después escribe `10` y `04:00` y guarda: debe aparecer el aviso verde "Parámetros guardados".
9. **Bitácora.** Entra a Administración → Bitácora y en "Entidad" elige "Parámetro". Debe verse el registro `ACTUALIZAR` con el detalle `9.5 → 10` y la fecha y hora de Cancún.
10. **Matriz de tiempos.** Entra a Configuración → Matriz de tiempos. En la celda Aeropuerto CUN → Tulum escribe `500` y en Tulum → Aeropuerto CUN escribe `abc`; pulsa "Guardar cambios". Deben verse las dos celdas en rojo y debajo el recuadro "Celdas con error" con un mensaje por celda. Pulsa "Descartar" al terminar.

**Pruebas (terminal)**

11. **API.** En `apps/api`, `npm run test:cov`. Deben verse "Test Suites: 13 passed", "Tests: 126 passed" y la tabla de cobertura con la fila "All files" (73.96 %) y los servicios nuevos (`usuarios`, `bitacora`, `parametros`, `tiempos-traslado`) al 100 % de líneas.
12. **Web.** En `apps/web`, `npm run test:cov`. Deben verse "Test Files 8 passed (8)", "Tests 54 passed (54)" y la tabla de cobertura con la fila "All files" (38.86 %), sin la carpeta `components/ui`, y las filas `VehiculosPage.tsx` y `UsuariosPage.tsx`.

Al terminar, regresa la jornada a `9.5` en la pantalla de Parámetros y, si quieres, desactiva el usuario de la captura 5 desde Usuarios.
