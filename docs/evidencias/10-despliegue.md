# 10 · Despliegue con Docker Compose y Nginx (Fase 15)

## Qué se hizo

Se preparó el sistema para ejecutarse en la laptop como entorno de producción con un solo comando y para abrirse desde otros equipos de la misma red. Se crearon imágenes Docker de la API y de la web, un `docker-compose.prod.yml` con PostgreSQL, API y Nginx, un seed de producción sin usuarios de prueba y un pipeline de integración continua en GitHub Actions. También se completó la documentación Swagger, se exportó a `openapi.json` y se redactaron la guía de despliegue y el manual de usuario por rol.

## Cómo se hizo

- **Imágenes multietapa.** La etapa de compilación genera el cliente de Prisma y compila la API y el seed. La imagen final solo lleva lo necesario para correr y usa el usuario `node`, sin privilegios de root.
- **Arranque de la API.** `docker-entrypoint.sh` aplica `prisma migrate deploy`, revisa la carga inicial e inicia Node. Si un paso falla, el contenedor no atiende peticiones.
- **Nginx.** Sirve React con fallback a `index.html`, envía `/api` a la API, comprime con gzip y guarda en caché los archivos con hash. Acepta hasta 11 MB para que la API responda con su propio mensaje de límite.
- **Redes.** `db` solo está en una red interna. `api` está en esa red y en la de salida, para consultar OSRM. Solo `nginx` publica un puerto (80).
- **Separación de desarrollo.** El proyecto `bestline-prod` tiene contenedores, redes y volumen propios. No se publica el puerto 5432, así que no choca con la base de desarrollo.
- **Seed de producción.** Los catálogos se movieron a `prisma/catalogos.ts`, compartido con el seed de desarrollo. El de producción crea catálogos y un administrador en una transacción, y solo corre si no hay usuarios.
- **Web relativa.** En producción `VITE_API_URL=/api`, y `urlApi` la resuelve contra el origen de la página. Así funciona igual por `localhost` que por la IP.
- **CI.** En cada PR y push a `main` corre lint, revisión de tipos, unitarias, e2e con un servicio de PostgreSQL, pruebas web y build.

## Archivos principales

| Archivo | Función |
|---|---|
| `docker-compose.prod.yml` | Servicios, healthchecks, redes y volumen de producción |
| `apps/api/Dockerfile`, `apps/api/docker-entrypoint.sh` | Imagen y arranque de la API |
| `apps/web/Dockerfile`, `apps/web/nginx.conf` | Imagen de la web y configuración de Nginx |
| `.env.production.example` | Plantilla de variables, sin secretos |
| `.gitattributes` | Finales de línea LF para scripts y Dockerfiles |
| `apps/api/prisma/catalogos.ts`, `sembrar-produccion.ts`, `seed-produccion.ts` | Catálogos compartidos y carga inicial |
| `apps/api/src/health/salud.controller.ts` | Salud de la API y de la base |
| `apps/api/src/exportar-openapi.ts` | Exporta `docs/api/openapi.json` |
| `.github/workflows/ci.yml` | Integración continua |
| `docs/despliegue.md`, `docs/manual-usuario.md` | Guía de operación y manual de usuario |

## Endpoints

| Método y ruta | Cambio |
|---|---|
| `GET /api/salud` | Nuevo. Público. 200 si la base responde, 503 si no |
| `POST` y `PATCH /api/operadores` | Aceptan `usuarioId` para vincular la cuenta (rol OPERADOR). No se agregaron columnas |
| `GET /api/docs` | Disponible solo con `SWAGGER_HABILITADO=true` en producción |

## Decisiones

- **`/api/salud` además de `/api/health`.** `/api/health` solo indica que el proceso responde. El healthcheck necesita saber también si la base contesta.
- **Seed solo con la base vacía.** Corre en cada arranque, pero no restablece contraseñas ni deshace cambios del administrador.
- **Usuario vinculado en Operadores.** Sin los usuarios de prueba, el vínculo no se podía crear desde el sistema y ningún chofer entraría a *Mi rol*.
- **Swagger apagado por defecto en producción.** Se enciende solo para consultarlo o capturarlo.
- **HTTP sin cifrar.** Se aceptó solo para la demostración en una red de confianza. Un uso real necesita HTTPS.
- **OSRM público.** El despliegue usa el servidor de demostración. `OSRM_URL` permite cambiarlo por uno propio.

## Problemas y soluciones

| Problema | Solución |
|---|---|
| `tsc --noEmit` fallaba por el tipo del parser binario en la e2e de indicadores | Se tipó con `request.Response` |
| `new URL('/api/...')` falla con una ruta relativa | `urlApi` la resuelve contra el origen de la página |
| La regla `.env.*` ignoraba `.env.production.example` | Se agregó una excepción solo para ese archivo |
| El seed de desarrollo crea usuarios de prueba y restablece contraseñas | Seed de producción separado, con catálogos compartidos |
| `npm ci` se cortaba con `ECONNRESET` en una conexión lenta | Caché de npm en BuildKit y hasta 5 intentos del comando |
| PowerShell 5.1 quita comillas internas y corrompe binarios con `>` | Los comandos no usan comillas internas, y el respaldo se genera dentro del contenedor y se copia con `docker cp` |

## Pruebas

Ejecutadas en PowerShell:

| Suite | Resultado | Cobertura de líneas |
|---|---|---|
| API unitarias | 380/380 (31 suites) | 85.25 % |
| API e2e | 124/124 (17 suites) | — |
| Web | 126/126 (20 archivos) | 63.49 % |
| Lint, `tsc` y build | Sin errores en las dos apps | — |
| GitHub Actions (PR #15) | Trabajos de API y Web en verde | — |

Prueba del stack completo en un proyecto Docker temporal, ya eliminado:

- 41 comprobaciones a través de Nginx: rutas de React, caché, gzip, encabezados, límites de subida, login, catálogos, importación del ejemplo (58 importables de 65), generar y autorizar el rol, monitoreo, indicadores, exportación y cuenta de operador.
- Los datos persistieron después de `down` y `up`.
- Respaldo y restauración: los datos quedaron idénticos después de borrar el rol y restaurar.
- Swagger respondió 404 apagado y 200 encendido.
- `/api/salud` respondió 503 con la base detenida y 200 al volver.
- Navegador real por la IP de la laptop a 1440 y 390 px: sin errores de consola ni desplazamiento horizontal.
- La base de desarrollo no cambió (misma huella antes y después).

**Pendiente de comprobar por el alumno:** la regla de firewall y el acceso desde un celular real.

## Encender y apagar Swagger para las capturas

Define el atajo en PowerShell, desde la raíz del repositorio:

```powershell
$prod = @('-f', 'docker-compose.prod.yml', '--env-file', '.env.production')
```

**Encender:**

1. En `.env.production`, cambia a `SWAGGER_HABILITADO=true`.
2. Ejecuta `docker compose @prod up -d --wait api`.
3. Abre <http://localhost/api/docs> y toma la captura.

**Apagar al terminar:**

1. En `.env.production`, regresa a `SWAGGER_HABILITADO=false`.
2. Ejecuta:

```powershell
docker compose @prod up -d --wait api
curl.exe -s -o NUL -w "%{http_code}`n" http://localhost/api/docs
```

Debe responder **404**.

## Capturas (máximo 8, en este orden)

No captures `.env.production`, el editor de código ni una terminal que muestre contraseñas.

1. **Servicios en marcha.** PowerShell: `docker compose @prod ps`. Deben verse `db`, `api` y `nginx` como `healthy`, y solo `nginx` con el puerto 80 publicado.
2. **Salud del sistema.** Navegador: <http://localhost/api/salud>. Debe verse `{"status":"ok","baseDatos":"ok"}`.
3. **Sistema en producción.** Navegador: <http://localhost>, con la sesión del administrador en *Inicio*.
4. **Importación de ejemplo.** *Importar servicios* con Nexus Tours y `Layout_Servicios_Nexus.xlsx`: vista previa con sus contadores, antes de confirmar.
5. **Sistema desde el celular.** Navegador del celular: `http://<IP-de-la-laptop>/monitoreo/2026-11-05`, con la dirección visible en la barra, después de autorizar el rol.
6. **Swagger.** Enciéndelo con los pasos anteriores y abre <http://localhost/api/docs>. Deben verse las secciones auth, catálogos, parámetros, servicios, importaciones, roles, rutas, monitoreo e indicadores. Apágalo al terminar.
7. **Respaldo.** PowerShell: ejecuta el bloque *Respaldar* de `docs/despliegue.md`. Debe verse el archivo `.dump` con su tamaño.
8. **CI en verde.** GitHub, pestaña *Checks* del PR de la Fase 15. Deben verse los trabajos de API y Web con palomita verde.

## Fragmento de código para la memoria

Ruta: `apps/api/src/health/salud.controller.ts`

```ts
async verificar(): Promise<{ status: string; baseDatos: string }> {
  try {
    await this.prisma.$queryRaw`SELECT 1`;
  } catch {
    throw new ServiceUnavailableException('La base de datos no responde');
  }
  return { status: 'ok', baseDatos: 'ok' };
}
```

Docker Compose llama a esta función para saber si la API está lista para recibir tráfico.
Ejecuta una consulta mínima, así detecta también una base caída y no solo un proceso vivo.
Si falla responde 503 sin detalles internos, porque es una ruta pública.
