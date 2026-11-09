# 02 · Autenticación y catálogos operativos (Fase 6)

## Qué se hizo

Se implementó la autenticación del sistema con JWT y control de acceso por rol, y los catálogos operativos de vehículos, operadores, zonas y hoteles, tanto en la API como en el frontend. En la API se agregaron el inicio de sesión con bcrypt, un guard global que valida el token y que el usuario siga activo en cada petición, un guard de roles, el registro en la bitácora de cada inicio de sesión y de cada alta, cambio, desactivación o eliminación, la regla de capacidad máxima por tipo de vehículo y la documentación completa en Swagger. El seed se actualizó con los valores de operación y un usuario por rol. En el frontend se conectó el inicio de sesión a la API, se agregaron rutas protegidas con un menú lateral que depende del rol y se construyeron las cuatro pantallas de catálogo con búsqueda, filtros, paginación, formularios en ventana modal y confirmación antes de desactivar o eliminar.

## Endpoints

Todas las rutas llevan el prefijo `/api`. Salvo `auth/login` y `health`, todas exigen `Authorization: Bearer <token>`.

| Método | Ruta | Quién | Descripción | Respuestas |
|---|---|---|---|---|
| POST | `/auth/login` | Público | Inicia sesión; devuelve el JWT (id y rol) y el usuario. Registra `INICIO_SESION` en la bitácora | 200, 400, 401 |
| GET | `/auth/me` | Autenticado | Datos del usuario dueño del token | 200, 401 |
| GET | `/health` | Público | Verifica que la API responde | 200 |
| GET | `/vehiculos` | Autenticado | Listado con `buscar`, `tipo`, `estado`, `pagina`, `limite` | 200, 400, 401 |
| GET | `/vehiculos/:id` | Autenticado | Un vehículo | 200, 400, 401, 404 |
| POST | `/vehiculos` | ADMINISTRADOR | Alta con regla de capacidad por tipo | 201, 400, 401, 403, 409 |
| PATCH | `/vehiculos/:id` | ADMINISTRADOR | Edición | 200, 400, 401, 403, 404, 409 |
| PATCH | `/vehiculos/:id/desactivar` | ADMINISTRADOR | Estado BAJA (no se borra) | 200, 400, 401, 403, 404 |
| GET | `/operadores` | Autenticado | Listado con `buscar`, `disponible`, `pagina`, `limite` | 200, 400, 401 |
| GET | `/operadores/:id` | Autenticado | Un operador | 200, 400, 401, 404 |
| POST | `/operadores` | ADMINISTRADOR | Alta | 201, 400, 401, 403 |
| PATCH | `/operadores/:id` | ADMINISTRADOR | Edición | 200, 400, 401, 403, 404 |
| PATCH | `/operadores/:id/desactivar` | ADMINISTRADOR | `disponible = false` (no se borra) | 200, 400, 401, 403, 404 |
| GET | `/zonas` | Autenticado | Listado con `buscar`, `esZonaTermino`, `pagina`, `limite` | 200, 400, 401 |
| GET | `/zonas/:id` | Autenticado | Una zona | 200, 400, 401, 404 |
| POST | `/zonas` | ADMINISTRADOR | Alta | 201, 400, 401, 403, 409 |
| PATCH | `/zonas/:id` | ADMINISTRADOR | Edición | 200, 400, 401, 403, 404, 409 |
| DELETE | `/zonas/:id` | ADMINISTRADOR | Elimina solo si ningún hotel, tiempo de traslado ni servicio la usa | 200, 400, 401, 403, 404, 409 |
| GET | `/hoteles` | Autenticado | Listado con `buscar`, `zonaId`, `pagina`, `limite`; incluye la zona | 200, 400, 401 |
| GET | `/hoteles/:id` | Autenticado | Un hotel | 200, 400, 401, 404 |
| POST | `/hoteles` | ADMINISTRADOR | Alta (la zona debe existir) | 201, 400, 401, 403 |
| PATCH | `/hoteles/:id` | ADMINISTRADOR | Edición | 200, 400, 401, 403, 404 |
| DELETE | `/hoteles/:id` | ADMINISTRADOR | Elimina solo si ningún servicio lo usa | 200, 400, 401, 403, 404, 409 |
| GET | `/resumen` | Autenticado | Solo lectura para la pantalla de inicio: vehículos activos (no dados de baja), operadores disponibles, zonas, hoteles y servicios pendientes de un día (`?fecha=AAAA-MM-DD`; si se omite, el próximo día con servicios a partir de hoy, en hora de Cancún) | 200, 400, 401 |

Los listados responden `{ datos, total, pagina, limite }`. En Swagger, cada endpoint tiene resumen, ejemplo de cuerpo y ejemplos de respuesta. Los GET no documentan 403 porque cualquier rol autenticado puede consultar.

## Decisiones técnicas

- **JWT sin Passport.** Se usó `@nestjs/jwt` con un guard global propio (`JwtAuthGuard`) en lugar de `@nestjs/passport`. Hace lo mismo con menos piezas y se puede explicar línea por línea. Las rutas abiertas se marcan con `@Public()`.
- **Validación del usuario en cada petición.** El guard, además de verificar la firma del token, consulta que el usuario exista y siga activo, y toma el rol **de la base de datos**, no del token. Así, al desactivar un usuario o cambiarle el rol, el cambio aplica de inmediato y no hasta que el token expire. El costo es una consulta por petición, aceptable para un sistema interno.
- **Mismo mensaje para todo fallo de login.** Para un correo inexistente, una contraseña incorrecta o un usuario inactivo se responde el mismo 401 ("Correo o contraseña incorrectos"), para no revelar qué correos están registrados.
- **Roles.** Un `RolesGuard` global revisa `@Roles(...)`. Cualquier rol autenticado puede leer los catálogos y solo ADMINISTRADOR puede escribir.
- **Bitácora en la misma transacción.** Cada cambio y su registro en `bitacora` se guardan dentro de un `$transaction`: si uno falla, no se guarda ninguno. Las acciones son `INICIO_SESION`, `CREAR`, `ACTUALIZAR`, `DESACTIVAR` y `ELIMINAR`.
- **Desactivación sin columnas nuevas.**
  - Vehículos: estado `BAJA`.
  - Operadores: `disponible = false`.
  - Zonas y hoteles: no tienen columna `activo` y no se agregó. Se eliminan físicamente solo si no están referenciados. Si lo están, se responde 409 con el detalle (por ejemplo, cuántos hoteles, tiempos de traslado y servicios usan la zona). También se traduce a 409 el error de llave foránea de PostgreSQL (P2003), por si otra petición agrega una referencia entre la revisión y el borrado.
- **Regla de capacidad como función pura.** `validarCapacidad(tipo, capacidad)` (Van/Urvan 14, Sprinter 20, Autobús 45) se puede probar sin base de datos. Al editar se combina con el valor guardado: si solo cambia la capacidad, se revisa contra el tipo que ya tenía. Van y Urvan se aceptan como dos nombres del mismo tipo. El frontend repite la regla en Zod para avisar al momento, pero la API la valida siempre.
- **Coordenadas como número.** Prisma devuelve las columnas `Decimal` como objetos que en JSON se vuelven texto. La API las convierte a número para que el frontend (y después el mapa) las use directamente.
- **Pruebas e2e con base aislada.** Las pruebas e2e usan la base `bestline_test` (`DATABASE_URL_TEST`), que se crea y migra sola antes de correrlas. La limpieza se niega a ejecutarse si la base no termina en `_test`, para no borrar datos de desarrollo.
- **Valores de operación en el seed.** Los valores que indicó el alumno quedaron separados de los datos de ejemplo:
  - capacidades 14/20/45;
  - anticipación por modalidad (PRIVADO 10, COMPARTIDO 20 y GRUPO 30 min);
  - `hora_cita.turno_1` 04:00 y `hora_cita.turno_2` 05:00;
  - jornada de 9.5 h;
  - zonas de término: solo Zona Hotelera y Aeropuerto CUN.

  El seed borra los parámetros de versiones anteriores y crea un usuario por rol.
- **Frontend.**
  - TanStack Query maneja las peticiones y la caché. Después de guardar se invalida el listado, para que la tabla se actualice sola.
  - React Router maneja las rutas protegidas. El menú y las rutas comparten la misma lista de roles (`layout/menu.ts`).
  - El token se guarda en `localStorage`. Si cualquier petición recibe 401, la sesión se cierra y se regresa al login.
  - COORDINADOR y SUPERVISOR ven los catálogos en modo consulta, sin botones de alta, edición ni desactivación.
  - Al OPERADOR, que es el chofer, solo se le muestra Inicio, porque estos catálogos no le sirven.

## Rediseño visual con shadcn/ui

Después de tener la funcionalidad completa se rediseñó el frontend **sin cambiar su comportamiento ni la API existente**. Se incorporó [shadcn/ui](https://ui.shadcn.com), una colección de componentes de interfaz construidos sobre Radix UI y TailwindCSS.

**Por qué shadcn/ui:**

- **No es una dependencia cerrada.** Sus componentes se copian al proyecto (`apps/web/src/components/ui`) como código propio en TypeScript, así que se pueden leer, explicar y ajustar. De hecho se ajustaron para React 18 (ver problemas).
- **Accesibilidad resuelta por Radix UI.** Los diálogos atrapan el foco y se cierran con Escape, los menús y las listas desplegables se manejan con teclado y los roles ARIA vienen correctos. Hacerlo a mano era propenso a errores.
- **Usa TailwindCSS**, que ya estaba en el stack: no agrega otro sistema de estilos. Los colores se definen una sola vez como variables (azul marino como color principal y ámbar como acento) y todos los componentes los respetan.
- **Consistencia.** Botones, campos, tablas, insignias, diálogos y avisos se ven y se comportan igual en todas las pantallas, lo que apoya la usabilidad y el diseño adaptable (RNF-05).

**Componentes usados:** Button, Input, Label, Card, Table, Dialog (formularios), AlertDialog (confirmaciones), Select, Badge (estados), DropdownMenu (menú de usuario y acciones por fila), Skeleton (carga), Sonner (avisos), Sheet (menú en móvil) y Checkbox. Íconos con lucide-react y tipografía Geist, empaquetada con npm para no depender de un CDN.

**Qué cambió en las pantallas:**

- **Layout.** Menú lateral en azul marino con "Best Line · Operaciones" y "Asignación asistida y monitoreo". Muestra Inicio y el grupo "Catálogos" con íconos, y la opción activa se marca con el acento ámbar. El encabezado lleva el título de la pantalla y el usuario con su rol; su menú incluye "Cerrar sesión". En móvil el menú se oculta y se abre con un botón.
- **Login.** Dos columnas: a un lado el nombre del sistema y una breve descripción, al otro el formulario, con la misma validación de antes.
- **Inicio.** Saludo con nombre, rol y fecha, y cinco tarjetas con datos reales de `GET /api/resumen`: vehículos activos, operadores disponibles, zonas, hoteles y servicios pendientes del próximo día con servicios (el 10 de noviembre de 2026 del seed). Cada tarjeta tiene ícono, número grande, descripción y enlace a su catálogo. La de servicios aún no tiene enlace, porque la pantalla de servicios llegará con la importación.
- **Catálogos.**
  - Tablas con encabezado, filas alternadas y Badge de color: Disponible, Mantenimiento o Baja; Disponible o No disponible; Zona de término.
  - Estado vacío con ícono y mensaje, y Skeleton mientras carga.
  - Acciones por fila en un menú.
  - Avisos (Sonner) al crear, editar, desactivar, eliminar o al fallar. El 409 muestra el mensaje de la API.
- **Diseño adaptable.** La página nunca se desborda en un teléfono (390 px). Solo la tabla se desplaza horizontalmente.
- **Rendimiento.** Las pantallas de catálogo se descargan solo cuando se abren (`React.lazy`), y las librerías van en un archivo aparte que el navegador guarda en caché.

## Problemas que surgieron y cómo se resolvieron

| Problema | Causa | Solución |
|---|---|---|
| 59 de los 60 servicios del seed quedaban en el mismo hotel | El generador pseudoaleatorio multiplicaba números mayores a 2^53; JavaScript perdía precisión y los bits bajos quedaban en cero, así que `azar(0, 7)` casi siempre daba 0 | Se cambió al algoritmo *mulberry32*, que trabaja con enteros de 32 bits (`Math.imul`). Ahora los servicios se reparten entre los 8 hoteles (de 4 a 11 cada uno) |
| Un usuario desactivado seguía usando la API hasta que su token expiraba (8 h) | El guard solo verificaba la firma del token | El guard consulta en cada petición que el usuario exista y esté activo; se agregó una prueba e2e que lo comprueba |
| La cobertura total parecía muy baja (11 %) | Se medían el cliente generado por Prisma, los módulos y los DTO, y solo había pruebas de dos archivos | Se excluyeron de la medición y se agregaron pruebas unitarias de los 4 servicios y de los guards con un Prisma simulado |
| Las coordenadas llegaban al frontend como texto (`"21.1335"`) | Prisma serializa `Decimal` como texto | Función `conCoordenadasNumericas` en las respuestas de zonas y hoteles |
| Avisos de oxlint en el frontend: `setState` dentro de un efecto, archivos que exportaban componentes y constantes (rompe Fast Refresh) y `watch` de React Hook Form | Organización del código | El usuario de la sesión se deriva en el render; los esquemas de Zod se movieron a `esquema.ts` (las clases de estilo propias se reemplazaron después por shadcn/ui); se usa `useWatch` |
| Aviso de oxlint en la API por copiar la instancia del DTO con `...dto` | Copiar una instancia de clase pierde su prototipo | Se pasan los campos de forma explícita |
| Al iniciar la sesión de trabajo, el contenedor de PostgreSQL estaba detenido | Docker Desktop se reinició | `docker compose up -d` antes de probar |
| Con shadcn/ui, React avisaba "Function components cannot be given refs" y los campos y menús podían perder su referencia | La versión actual de shadcn/ui asume React 19, que pasa `ref` como prop normal; el proyecto usa React 18 | Se agregó `React.forwardRef` a Button, Input y a los overlays de Dialog, Sheet y AlertDialog, con un comentario en cada uno. Un recorrido automatizado en el navegador confirmó que el aviso desapareció |
| Los componentes generados importaban `cn` desde `"cn"` y el aviso (Sonner) dependía de `next-themes` | Particularidades de la versión de shadcn/ui | Los imports apuntan a `@/lib/utils`; Sonner usa tema claro fijo y se quitó `next-themes` |
| El Select de shadcn/ui no admite una opción con valor vacío para "Todos" | Restricción de Radix UI | Los filtros usan el valor `todos`, que no se envía a la API |
| Al cerrarse el diálogo de confirmación, el mensaje perdía el nombre del registro | La página limpiaba el registro elegido al mismo tiempo que empezaba la animación de cierre | El diálogo conserva el último mensaje mientras se cierra |
| El paquete de JavaScript pasaba de 500 kB (aviso de Vite) | Librerías de interfaz (Radix, React, TanStack) | Carga diferida de las pantallas y librerías en un archivo aparte (~170 kB comprimido); se ajustó el límite del aviso con un comentario |

## Resultado de las pruebas

- **Unitarias** (`npm test`, Jest): 9 suites y 76 pruebas aprobadas.
  - `AuthService`: login correcto con JWT (id y rol), registro en bitácora, contraseña incorrecta, correo inexistente, usuario inactivo y perfil.
  - Regla de capacidad: máximos por tipo, límites, enteros > 0 y tipo desconocido.
  - Servicios de vehículos, operadores, zonas y hoteles con Prisma simulado: alta, edición, desactivación, eliminación con 409 (por referencias y por P2003), duplicados con 409, 404 y escritura en bitácora.
  - Guards: ruta pública, sin token, token inválido, usuario inactivo o inexistente, rol tomado de la base y 403 por rol.
  - Resumen: conteos, filtro de servicios por día en hora de Cancún, próximo día con servicios y día de hoy cuando no hay servicios próximos.
  - `HealthController`.
- **E2E** (`npm run test:e2e`, Jest + Supertest contra `bestline_test`): 4 suites y 22 pruebas aprobadas.
  - Login: 200, 401 por contraseña, 401 por correo inexistente y 400 por correo inválido; registro en bitácora.
  - `/auth/me`: 200 y 401.
  - Usuario desactivado: su token deja de funcionar (401).
  - Vehículos: 201 con registro en bitácora, 400 por capacidad, 400 por tipo desconocido, 400 por propiedad no declarada, 403 para COORDINADOR, 401 sin token, 200 de listado para COORDINADOR y 200 al desactivar.
  - Resumen: 200 con los conteos del día (un servicio a las 00:30 del día siguiente no cuenta), 400 por fecha mal escrita y 401 sin token.
  - Health y documento OpenAPI.
- **Cobertura** (`npm run test:cov`), sin código generado, `main.ts`, módulos ni DTO:
  - **69.5 % de sentencias, 49.78 % de ramas, 55.44 % de funciones y 69.45 % de líneas.**
  - Los 5 servicios, los dos guards, `AuthService` y la regla de capacidad tienen 100 % de líneas.
  - Lo que no cubren las unitarias son los 6 controladores, `swagger.ts` y `configurar-app.ts`, que solo se ejecutan en las pruebas e2e.
- **Build y lint**: `npm run build` y `npm run lint` sin errores ni avisos en la API y en la web.
- **Verificación manual de la API** (con `curl`): 401 sin token, 401 por credenciales, 400 por capacidad, tipo y propiedades extra, 409 por duplicado, 404, 409 al eliminar zonas y hoteles referenciados, eliminación de una zona y un hotel sin referencias, y los registros en la bitácora. También se verificaron las peticiones *preflight* de CORS (`PATCH` y `DELETE` con `Authorization`) desde `http://localhost:5173`.
- **Frontend en el navegador.** Se hizo un recorrido automatizado con Playwright y Chromium sin interfaz, como herramienta temporal fuera del proyecto, en escritorio (1440 px) y en móvil (390 px). Recorrió:
  - el login con error de validación, el 401 y la entrada;
  - el inicio con el resumen;
  - los filtros y el formulario con el error de capacidad;
  - el alta con aviso, el menú de acciones, la confirmación de baja con aviso y la eliminación de una zona con el aviso 409;
  - hoteles, operadores, la edición en diálogo y el menú de usuario con cierre de sesión;
  - la vista de solo consulta del coordinador y el menú móvil.

  Sin errores de React en la consola; los únicos errores fueron el 401 y el 409 esperados. En móvil la página no se desborda (0 px) y la tabla se desplaza horizontalmente. Los datos de prueba creados durante el recorrido se borraron.

## Capturas que se deben tomar

Antes de empezar:

1. En la raíz, `docker compose up -d`.
2. En `apps/api`, `npx prisma db seed` y luego `npm run start:dev`.
3. En `apps/web`, `npm run dev`.

Las contraseñas están en `apps/api/.env` (`ADMIN_PASSWORD` y `SEED_PASSWORD_EJEMPLO`).

**Pruebas (terminal, en `apps/api`)**

1. `npm test -- --verbose`: las 9 suites con sus pruebas en verde y "Tests: 76 passed".
2. `npm run test:e2e -- --verbose`: `prisma migrate deploy` sobre `bestline_test` y "Tests: 22 passed", incluidas "Usuario desactivado" y "Resumen".
3. `npm run test:cov`: la tabla de cobertura con la fila "All files" (69.5 %) y los servicios al 100 %.

**Swagger (http://localhost:3000/api/docs)**

4. La página completa con las secciones auth, health, vehiculos, operadores, zonas, hoteles y resumen, y el botón **Authorize**.
5. Login: en `POST /api/auth/login`, "Try it out" con el correo del administrador y "Execute". Debe salir 200 con `accessToken`.
6. Authorize: pega el token. En `GET /api/auth/me`, "Execute" debe dar 200.
7. Error 400: en `POST /api/vehiculos`, el ejemplo "Capacidad mayor al máximo" debe dar 400 con "La capacidad de un vehículo Sprinter debe estar entre 1 y 20 pasajeros".
8. Error 403: con el token de `coordinador@bestline.local`, el mismo POST debe dar 403.
9. Error 409: en `DELETE /api/zonas/{id}` con id 7 (Tulum) y token de administrador, debe dar 409 con el detalle de las referencias.
10. Documentación de respuestas: un POST expandido en "Responses", con los ejemplos 201, 400, 401 y 403.
11. Resumen: en `GET /api/resumen`, "Try it out" sin fecha y "Execute". Debe salir 200 con `servicios.fecha` "2026-11-10" y los conteos.

**Frontend (http://localhost:5173)**

12. Login: la pantalla a dos columnas, con el panel azul marino a la izquierda y el formulario a la derecha.
13. Credenciales incorrectas: un correo válido con una contraseña equivocada. Debe verse el recuadro rojo "Correo o contraseña incorrectos".
14. Inicio como administrador:
    - el menú lateral con Inicio y el grupo "Catálogos" con íconos;
    - el encabezado con el título y tu nombre con el rol;
    - el saludo y las 5 tarjetas: 10 vehículos activos, 9 operadores disponibles, 8 zonas, 8 hoteles y 60 servicios pendientes del 10 de noviembre de 2026.
15. Vehículos: la tabla con filas alternadas y Badges de estado (verde Disponible, ámbar Mantenimiento). Filtra con la lista "Todos los tipos" por "Sprinter".
16. Validación del formulario: en "Nuevo vehículo" elige tipo "Van (máx. 14)" y capacidad 20, y pulsa Guardar. Debe verse el error "Un vehículo Van admite máximo 14 pasajeros" bajo el campo.
17. Alta: registra un vehículo válido (por ejemplo BL-11, Sprinter, 20). Debe verse el aviso verde arriba a la derecha ("Vehículo BL-11 dado de alta").
18. Desactivar:
    - En la fila del vehículo abre el menú "⋯" y elige "Desactivar".
    - Captura el diálogo "¿Dar de baja este vehículo?" y confirma.
    - Debe verse el aviso "dado de baja" y el Badge gris "Baja".
19. Eliminar con 409: en Zonas abre "⋯" en Tulum, elige "Eliminar" y confirma. Debe verse el aviso rojo "No se pudo eliminar la zona" con el detalle de la API ("está referenciada por…").
20. Hoteles: la tabla con la columna Zona. Filtra por "Zona Hotelera".
21. Menú de usuario: pulsa tu nombre arriba a la derecha. Debe verse el menú con correo, rol y "Cerrar sesión".
22. Solo consulta: cierra sesión y entra como `coordinador@bestline.local`. Deben verse los catálogos sin el botón "Nuevo…" ni la columna Acciones, y el texto "Solo consulta".
23. Menú del operador: entra como `operador@bestline.local`. El menú solo muestra Inicio y las tarjetas no tienen enlaces. Luego escribe en la barra la URL `http://localhost:5173/vehiculos`; debe verse la tarjeta "Acceso denegado" con el botón "Volver al inicio".
24. Diseño adaptable:
    - En Chrome pulsa F12, activa la vista de dispositivo (Ctrl+Shift+M) y elige un teléfono de unos 390 px.
    - Captura el inicio, con el menú oculto y el botón ☰.
    - Captura el menú abierto con ☰.
    - Captura Vehículos con la tabla desplazada a la derecha, sin que se mueva la página.
25. Usuario desactivado: con la sesión del supervisor abierta en el navegador, en una terminal en la raíz corre
    `docker compose exec db psql -U <usuario_bd> -d bestline -c "UPDATE usuario SET activo=false WHERE email='supervisor@bestline.local'"`.
    Recarga cualquier pantalla: la aplicación debe regresar al login. Después reactívalo con el mismo comando y `activo=true`.
26. Bitácora: en `apps/api` corre `npx prisma studio --port 5555` y abre la tabla `Bitacora`. Deben verse los registros `INICIO_SESION`, `CREAR` y `DESACTIVAR` de los pasos anteriores.

**GitHub**

27. La lista de commits de la rama `feat/autenticacion-catalogos`.
28. El pull request abierto hacia `main`, con su descripción y la pestaña "Files changed".
