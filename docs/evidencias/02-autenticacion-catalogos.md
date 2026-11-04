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

## Problemas que surgieron y cómo se resolvieron

| Problema | Causa | Solución |
|---|---|---|
| 59 de los 60 servicios del seed quedaban en el mismo hotel | El generador pseudoaleatorio multiplicaba números mayores a 2^53; JavaScript perdía precisión y los bits bajos quedaban en cero, así que `azar(0, 7)` casi siempre daba 0 | Se cambió al algoritmo *mulberry32*, que trabaja con enteros de 32 bits (`Math.imul`). Ahora los servicios se reparten entre los 8 hoteles (de 4 a 11 cada uno) |
| Un usuario desactivado seguía usando la API hasta que su token expiraba (8 h) | El guard solo verificaba la firma del token | El guard consulta en cada petición que el usuario exista y esté activo; se agregó una prueba e2e que lo comprueba |
| La cobertura total parecía muy baja (11 %) | Se medían el cliente generado por Prisma, los módulos y los DTO, y solo había pruebas de dos archivos | Se excluyeron de la medición y se agregaron pruebas unitarias de los 4 servicios y de los guards con un Prisma simulado |
| Las coordenadas llegaban al frontend como texto (`"21.1335"`) | Prisma serializa `Decimal` como texto | Función `conCoordenadasNumericas` en las respuestas de zonas y hoteles |
| Avisos de oxlint en el frontend: `setState` dentro de un efecto, archivos que exportaban componentes y constantes (rompe Fast Refresh) y `watch` de React Hook Form | Organización del código | El usuario de la sesión se deriva en el render; los esquemas de Zod se movieron a `esquema.ts` y las clases de estilo a `estilos.ts`; se usa `useWatch` |
| Aviso de oxlint en la API por copiar la instancia del DTO con `...dto` | Copiar una instancia de clase pierde su prototipo | Se pasan los campos de forma explícita |
| Al iniciar la sesión de trabajo, el contenedor de PostgreSQL estaba detenido | Docker Desktop se reinició | `docker compose up -d` antes de probar |

## Resultado de las pruebas

- **Unitarias** (`npm test`, Jest): 8 suites y 71 pruebas aprobadas.
  - `AuthService`: login correcto con JWT (id y rol), registro en bitácora, contraseña incorrecta, correo inexistente, usuario inactivo y perfil.
  - Regla de capacidad: máximos por tipo, límites, enteros > 0 y tipo desconocido.
  - Servicios de vehículos, operadores, zonas y hoteles con Prisma simulado: alta, edición, desactivación, eliminación con 409 (por referencias y por P2003), duplicados con 409, 404 y escritura en bitácora.
  - Guards: ruta pública, sin token, token inválido, usuario inactivo o inexistente, rol tomado de la base y 403 por rol.
  - `HealthController`.
- **E2E** (`npm run test:e2e`, Jest + Supertest contra `bestline_test`): 3 suites y 19 pruebas aprobadas.
  - Login: 200, 401 por contraseña, 401 por correo inexistente y 400 por correo inválido; registro en bitácora.
  - `/auth/me`: 200 y 401.
  - Usuario desactivado: su token deja de funcionar (401).
  - Vehículos: 201 con registro en bitácora, 400 por capacidad, 400 por tipo desconocido, 400 por propiedad no declarada, 403 para COORDINADOR, 401 sin token, 200 de listado para COORDINADOR y 200 al desactivar.
  - Health y documento OpenAPI.
- **Cobertura** (`npm run test:cov`), sin código generado, `main.ts`, módulos ni DTO:
  - **68.96 % de sentencias, 49.76 % de ramas, 54.25 % de funciones y 68.72 % de líneas.**
  - Los 4 servicios, los dos guards, `AuthService` y la regla de capacidad tienen 100 % de líneas.
  - Lo que no cubren las unitarias son los 5 controladores, `swagger.ts` y `configurar-app.ts`, que solo se ejecutan en las pruebas e2e.
- **Build y lint**: `npm run build` y `npm run lint` sin errores ni avisos en la API y en la web.
- **Verificación manual de la API** (con `curl`): 401 sin token, 401 por credenciales, 400 por capacidad, tipo y propiedades extra, 409 por duplicado, 404, 409 al eliminar zonas y hoteles referenciados, eliminación de una zona y un hotel sin referencias, y los registros en la bitácora. También se verificaron las peticiones *preflight* de CORS (`PATCH` y `DELETE` con `Authorization`) desde `http://localhost:5173`.
- **Frontend**: no se probaron las pantallas en el navegador desde la sesión de trabajo. Se verificó que compilan, que pasan el lint y que Vite las sirve. La prueba visual corresponde a las capturas de la lista siguiente.

## Capturas que se deben tomar

Antes de empezar:

1. En la raíz, `docker compose up -d`.
2. En `apps/api`, `npx prisma db seed` y luego `npm run start:dev`.
3. En `apps/web`, `npm run dev`.

Las contraseñas están en `apps/api/.env` (`ADMIN_PASSWORD` y `SEED_PASSWORD_EJEMPLO`).

**Pruebas (terminal, en `apps/api`)**

1. `npm test -- --verbose`: las 8 suites con sus pruebas en verde y "Tests: 71 passed".
2. `npm run test:e2e -- --verbose`: `prisma migrate deploy` sobre `bestline_test` y "Tests: 19 passed", incluida la prueba "Usuario desactivado".
3. `npm run test:cov`: la tabla de cobertura con la fila "All files" y los servicios al 100 %.

**Swagger (http://localhost:3000/api/docs)**

4. La página completa con las secciones auth, health, vehiculos, operadores, zonas y hoteles, y el botón **Authorize**.
5. Login: en `POST /api/auth/login`, "Try it out" con el correo del administrador y "Execute". Debe salir 200 con `accessToken`.
6. Authorize: pega el token. En `GET /api/auth/me`, "Execute" debe dar 200.
7. Error 400: en `POST /api/vehiculos`, el ejemplo "Capacidad mayor al máximo" debe dar 400 con "La capacidad de un vehículo Sprinter debe estar entre 1 y 20 pasajeros".
8. Error 403: con el token de `coordinador@bestline.local`, el mismo POST debe dar 403.
9. Error 409: en `DELETE /api/zonas/{id}` con id 7 (Tulum) y token de administrador, debe dar 409 con el detalle de las referencias.
10. Documentación de respuestas: un POST expandido en "Responses", con los ejemplos 201, 400, 401 y 403.

**Frontend (http://localhost:5173)**

11. Credenciales incorrectas: en el login, un correo válido con una contraseña equivocada. Debe verse el mensaje rojo "Correo o contraseña incorrectos".
12. Inicio como administrador: inicia sesión con el administrador. Deben verse el menú lateral (Inicio, Vehículos, Operadores, Zonas y Hoteles), el nombre con el rol abajo y las tarjetas de acceso.
13. Vehículos: la tabla con los 10 vehículos y sus estados de color. Filtra por tipo "Sprinter".
14. Validación del formulario: en "Nuevo vehículo" elige tipo "Van" y capacidad 20, y pulsa Guardar. Debe verse el error "Un vehículo Van admite máximo 14 pasajeros" bajo el campo.
15. Alta: registra un vehículo válido (por ejemplo BL-11, Sprinter, 20). Debe verse el aviso verde y el vehículo en la tabla.
16. Desactivar: pulsa "Desactivar" en ese vehículo. Debe verse el diálogo de confirmación; tómale captura y confirma. Debe verse el estado "Baja".
17. Eliminar con 409: en Zonas pulsa "Eliminar" en Tulum y confirma. Debe verse el mensaje de la API dentro del diálogo ("No se puede eliminar la zona "Tulum": está referenciada por…").
18. Hoteles: la tabla con la columna Zona. Filtra por "Zona Hotelera".
19. Solo consulta: cierra sesión y entra como `coordinador@bestline.local`. Deben verse los catálogos sin el botón "Nuevo…" ni la columna Acciones, y el texto "Solo consulta".
20. Menú del operador: entra como `operador@bestline.local`. El menú solo muestra Inicio. Luego escribe en la barra la URL `http://localhost:5173/vehiculos`; debe verse "Acceso denegado".
21. Usuario desactivado: con la sesión del supervisor abierta en el navegador, en una terminal en la raíz corre
    `docker compose exec db psql -U <usuario_bd> -d bestline -c "UPDATE usuario SET activo=false WHERE email='supervisor@bestline.local'"`.
    Recarga cualquier catálogo: la aplicación debe regresar al login. Después reactívalo con el mismo comando y `activo=true`.
22. Bitácora: en `apps/api` corre `npx prisma studio --port 5555` y abre la tabla `Bitacora`. Deben verse los registros `INICIO_SESION`, `CREAR` y `DESACTIVAR` de los pasos anteriores.

**GitHub**

23. La lista de commits de la rama `feat/autenticacion-catalogos`.
24. El pull request abierto hacia `main`, con su descripción y la pestaña "Files changed".
