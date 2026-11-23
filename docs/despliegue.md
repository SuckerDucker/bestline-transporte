# Guía de despliegue

Esta guía levanta el sistema Best Line en una laptop con Windows, como entorno de producción accesible desde otros equipos de la misma red. Todos los comandos son para **PowerShell** y se ejecutan desde la raíz del repositorio, salvo donde se indique.

## 1. Cómo queda el sistema

```text
Navegador (laptop, celular u otro equipo de la red)
        │  http://<IP-de-la-laptop>  (puerto 80)
        ▼
     Nginx ── archivos de React
        │  /api
        ▼
      API (NestJS) ──► OSRM (internet, solo para trazar rutas)
        │  red interna
        ▼
   PostgreSQL 16 (volumen propio, sin puerto publicado)
```

- Solo Nginx publica un puerto. La API y la base de datos no son accesibles desde fuera de Docker.
- El proyecto se llama `bestline-prod`. Sus contenedores, redes y volumen son distintos a los de desarrollo (`bestline-db`, puerto 5432), así que ambos pueden correr al mismo tiempo.
- Al arrancar, la API aplica las migraciones pendientes con `prisma migrate deploy`. Si la base está vacía, carga los catálogos y un administrador.

## 2. Requisitos

- Docker Desktop encendido. La primera construcción descarga dependencias y puede tardar varios minutos.
- El puerto 80 libre. Para comprobarlo (no debe mostrar nada):

```powershell
Get-NetTCPConnection -LocalPort 80 -State Listen -ErrorAction SilentlyContinue
```

## 3. Configurar los secretos

El archivo `.env.production` contiene las contraseñas y **nunca se sube a Git** (ya está en `.gitignore`). Este bloque lo crea desde el ejemplo y rellena la contraseña de la base y el secreto JWT con valores aleatorios, sin mostrarlos en pantalla:

```powershell
function New-SecretoHex([int]$Bytes) {
  $datos = New-Object byte[] $Bytes
  $generador = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $generador.GetBytes($datos)
  $generador.Dispose()
  -join ($datos | ForEach-Object { $_.ToString('x2') })
}

if (Test-Path .env.production) { throw 'Ya existe .env.production; no se sobrescribe.' }
$texto = [IO.File]::ReadAllText((Resolve-Path .env.production.example))
$texto = $texto.Replace('<secreto-hexadecimal-de-48-caracteres>', (New-SecretoHex 24))
$texto = $texto.Replace('<secreto-hexadecimal-de-96-caracteres>', (New-SecretoHex 48))
$destino = Join-Path (Get-Location) '.env.production'
# UTF-8 sin BOM: con BOM, Docker Compose no reconoce la primera variable.
[IO.File]::WriteAllText($destino, $texto, (New-Object Text.UTF8Encoding $false))
```

Después abre el archivo y reemplaza `ADMIN_EMAIL` y `ADMIN_PASSWORD`:

```powershell
code .env.production
```

`ADMIN_PASSWORD` debe tener de 12 a 72 caracteres. Para generar una, ejecuta `New-SecretoHex 12` en la misma ventana y guárdala en un gestor de contraseñas.

> `ADMIN_PASSWORD` y `POSTGRES_PASSWORD` solo se aplican la **primera vez**, con el volumen vacío. Cambiarlas después en el archivo no cambia las contraseñas existentes. La del administrador se cambia en la pantalla *Usuarios*.

## 4. Comandos de operación

Define este atajo una vez por cada ventana de PowerShell:

```powershell
$prod = @('-f', 'docker-compose.prod.yml', '--env-file', '.env.production')
```

| Acción | Comando |
|---|---|
| **Levantar o actualizar** | `docker compose @prod up -d --build` |
| Ver estado y salud | `docker compose @prod ps` |
| Ver logs de todo | `docker compose @prod logs -f --tail 100` |
| Ver logs de la API | `docker compose @prod logs -f --tail 100 api` |
| Detener sin borrar nada | `docker compose @prod stop` |
| Volver a encender | `docker compose @prod start` |
| Quitar contenedores (conserva los datos) | `docker compose @prod down` |

> **No uses `docker compose down -v`.** La opción `-v` borra el volumen y con él toda la base de producción.

El sistema está listo cuando `db`, `api` y `nginx` aparecen como `healthy`. Se abre en <http://localhost>.

Los contenedores usan `restart: unless-stopped`: vuelven solos al abrir Docker Desktop, salvo que los hayas detenido a mano. Para que arranquen con Windows, activa *Start Docker Desktop when you sign in* en la configuración de Docker Desktop.

## 5. Acceso desde otros equipos de la red

**Ver la IP de la laptop:**

```powershell
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.InterfaceAlias -notmatch 'vEthernet|Loopback' -and $_.PrefixOrigin -ne 'WellKnown' } |
  Select-Object InterfaceAlias, IPAddress
```

**Revisar que la red sea privada** (`NetworkCategory` debe decir `Private`):

```powershell
Get-NetConnectionProfile | Select-Object InterfaceAlias, NetworkCategory
```

**Abrir el puerto 80 en el firewall.** Ejecuta PowerShell **como administrador**. La regla solo aplica en redes privadas y solo para equipos de la misma subred:

```powershell
New-NetFirewallRule -DisplayName 'Best Line HTTP 80' -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow -Profile Private -RemoteAddress LocalSubnet
```

Para quitarla: `Remove-NetFirewallRule -DisplayName 'Best Line HTTP 80'`.

**Abrir el sistema desde el celular:** conéctalo a la misma red y entra a `http://<IP-de-la-laptop>`.

Si no abre:

- Comprueba que el celular y la laptop estén en la misma red y no en una red de invitados. Algunos routers aíslan a los clientes del WiFi.
- Revisa si la IP cambió. El router puede asignar otra al reconectar. Para fijarla, reserva la IP de la laptop en la configuración del router.

> **Limitación de seguridad:** el sistema se sirve por HTTP, sin cifrado. Las contraseñas y los datos viajan legibles dentro de la red. Úsalo solo en una red de confianza para la demostración. Para un uso real en la empresa hace falta HTTPS con un dominio o un certificado interno.

## 6. Datos de producción

La primera vez, la base queda con:

- 1 administrador (el de `.env.production`), sin usuarios de prueba.
- 8 zonas, matriz de 64 tiempos, 16 hoteles, 2 mayoristas y parámetros de operación.
- 10 unidades (4 Van, 5 Sprinter, 1 Autobús) y 10 operadores con su hora de cita.
- Ningún servicio, importación ni rol.

Los nombres de operadores, licencias y teléfonos son **de ejemplo**. Corrígelos en *Operadores* antes de un uso real.

**Cargar la importación de ejemplo** con la propia pantalla, para que quede registrada en la bitácora:

1. Entra como administrador y abre **Importar servicios**.
2. Elige el mayorista **Nexus Tours**.
3. Selecciona `docs/ejemplos/Layout_Servicios_Nexus.xlsx`.
4. Revisa la vista previa y pulsa **Confirmar importación**.
5. En **Generar rol**, elige el día **05/11/2026** y genera el rol.

**Dar acceso a un operador:**

1. En **Usuarios**, crea una cuenta con rol *Operador*.
2. En **Operadores**, edita al chofer y elige la cuenta en **Usuario vinculado**.
3. Con esa cuenta, el chofer ve sus servicios en **Mi rol**.

## 7. Respaldar y restaurar la base

Los respaldos contienen datos de la operación. Se guardan en `respaldos/`, carpeta que Git ignora.

**Respaldar:**

```powershell
New-Item -ItemType Directory -Force respaldos | Out-Null
$archivo = "respaldos\bestline-$(Get-Date -Format yyyy-MM-dd_HHmm).dump"
docker compose @prod exec -T db sh -c 'pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -Fc -f /tmp/respaldo.dump'
$db = docker compose @prod ps -q db
docker cp "${db}:/tmp/respaldo.dump" $archivo
docker compose @prod exec -T db rm -f /tmp/respaldo.dump
Get-Item $archivo
```

El archivo se genera dentro del contenedor y se copia con `docker cp` porque la redirección `>` de PowerShell 5.1 cambia la codificación y corrompe los respaldos binarios.

**Restaurar** (reemplaza los datos actuales de producción por los del respaldo):

```powershell
$archivo = 'respaldos\NOMBRE-DEL-RESPALDO.dump'
docker compose @prod stop nginx api
$db = docker compose @prod ps -q db
docker cp $archivo "${db}:/tmp/restaurar.dump"
docker compose @prod exec -T db sh -c 'pg_restore -U $POSTGRES_USER -d $POSTGRES_DB --clean --if-exists --no-owner --exit-on-error /tmp/restaurar.dump'
docker compose @prod exec -T db rm -f /tmp/restaurar.dump
docker compose @prod start api nginx
```

## 8. Swagger (documentación de la API)

Swagger está **apagado por defecto** en producción. El documento completo también está en [`docs/api/openapi.json`](api/openapi.json).

**Encender** (por ejemplo, para las capturas):

1. En `.env.production`, cambia a `SWAGGER_HABILITADO=true`.
2. Recrea solo la API y espera a que esté `healthy`:

```powershell
docker compose @prod up -d --wait api
```

3. Abre <http://localhost/api/docs>.

**Apagar al terminar:**

1. En `.env.production`, regresa a `SWAGGER_HABILITADO=false`.
2. Aplica el cambio y comprueba:

```powershell
docker compose @prod up -d --wait api
curl.exe -s -o NUL -w "%{http_code}`n" http://localhost/api/docs
```

Con Swagger apagado, el último comando debe responder **404**. Encendido responde **200**.

Para regenerar `openapi.json` después de cambiar la API (no necesita base de datos):

```powershell
Push-Location apps/api; npm run openapi; Pop-Location
```

## 9. OSRM (rutas sugeridas)

El despliegue usa el **servidor público de demostración** de OSRM (`https://router.project-osrm.org`). Solo lo consulta la API y solo sirve para dibujar el trazado por carretera. Las horas del rol no dependen de OSRM.

- Tiene un límite aproximado de 1 petición por segundo y no ofrece garantía de servicio.
- Las coordenadas de los hoteles salen a ese servidor externo; no se envían nombres de pasajeros.
- Si no responde, la pantalla muestra un trazado aproximado y el resto del sistema sigue funcionando.

**Cambiar a un OSRM propio:**

1. Levanta tu servidor con un mapa de la región y anota su URL, por ejemplo `http://192.168.1.60:5000`. La [documentación de OSRM](https://github.com/Project-OSRM/osrm-backend#using-docker) explica cómo prepararlo con Docker.
2. En `.env.production`, cambia `OSRM_URL` a esa dirección, sin diagonal final.
3. Aplica el cambio:

```powershell
docker compose @prod up -d --wait api
```

## 10. Problemas frecuentes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `Falta JWT_SECRET en .env.production` | Se ejecutó sin `@prod` o falta la variable | Define `$prod` y revisa el archivo |
| `bind: address already in use` en el puerto 80 | Otro programa usa el puerto | Identifícalo con `Get-NetTCPConnection -LocalPort 80` |
| `api` no llega a `healthy` | Falló la migración, el seed o la conexión | `docker compose @prod logs --tail 100 api` |
| `password authentication failed` | Cambió `POSTGRES_PASSWORD` con un volumen ya creado | Regresa a la contraseña original |
| `ECONNRESET` al construir | Se cortó la descarga de npm | Repite `up -d --build`; la caché conserva lo descargado |
| El mapa se ve sin fondo | Sin internet en el equipo que abre la página | Revisa su conexión; los mosaicos vienen de OpenStreetMap |
