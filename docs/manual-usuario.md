<div align="center">

# Manual de usuario

## Sistema web para la asignación asistida y el monitoreo de servicios de transporte turístico

### Área de Operaciones · Best Line Travel Agency

Cancún, Quintana Roo

Versión 1.0 · Noviembre de 2026

Estadía profesional · Ingeniería en Software · UPQROO

[Captura: pantalla de inicio de sesión del sistema]

</div>

---

## Índice

1. [Antes de empezar](#1-antes-de-empezar)
2. [Capítulo del coordinador](#2-capítulo-del-coordinador)
3. [Capítulo del supervisor](#3-capítulo-del-supervisor)
4. [Capítulo del operador](#4-capítulo-del-operador)
5. [Capítulo del administrador](#5-capítulo-del-administrador)
6. [Glosario](#6-glosario)
7. [Problemas frecuentes](#7-problemas-frecuentes)

---

## 1. Antes de empezar

### 1.1 Para qué sirve el sistema

El sistema ayuda a organizar los servicios de transporte de cada día:

1. **Importa** los servicios que envían los mayoristas en Excel o CSV.
2. **Propone el rol**: qué unidad y qué operador hace cada servicio, sin empalmes.
3. **Permite revisar y autorizar** ese rol.
4. **Da seguimiento** a cada servicio durante el día y registra las incidencias.
5. **Muestra indicadores** de la operación.

### 1.2 Cómo entrar

1. Abre el navegador en la computadora o en el celular.
2. Escribe la dirección que te dio el administrador, por ejemplo `http://192.168.1.50`. Debes estar conectado a la misma red que el servidor.
3. Escribe tu **Correo** y tu **Contraseña**.
4. Pulsa **Iniciar sesión**.

[Captura: formulario de inicio de sesión]

Para salir, abre el menú con tu nombre en la parte superior y elige **Cerrar sesión**. La sesión también termina sola después de varias horas; en ese caso, vuelve a entrar.

> No compartas tu contraseña. Si la olvidas, pide al administrador que la cambie.

### 1.3 Qué puede hacer cada rol

| Función | Coordinador | Supervisor | Operador | Administrador |
|---|:---:|:---:|:---:|:---:|
| Importar servicios | Sí | No | No | Sí |
| Generar, ajustar y autorizar el rol | Sí | No | No | Sí |
| Consultar rol, rutas y servicios | Sí | Sí | Solo los suyos | Sí |
| Monitoreo e incidencias | Sí | Sí | No | Sí |
| Actualizar el avance de un servicio | Sí | Sí | Solo los suyos | Sí |
| Cancelar o marcar no show | Sí | Sí | No | Sí |
| Consultar indicadores | Sí | Sí | No | Sí |
| Consultar catálogos y configuración | Sí | Sí | No | Sí |
| Modificar catálogos y configuración | No | No | No | Sí |
| Usuarios y bitácora | No | No | No | Sí |

### 1.4 Estados de un servicio

```text
PROGRAMADO → EN RUTA → EN SERVICIO → COMPLETADO
```

Mientras no esté completado, un servicio también puede pasar a **Cancelado** o **No show** (el pasajero no se presentó). Completado, Cancelado y No show son estados finales: ya no cambian.

---

## 2. Capítulo del coordinador

El coordinador prepara la operación del día siguiente. Su flujo es:

```text
Importar servicios → Generar rol → Revisar y ajustar → Autorizar → Monitorear
```

### 2.1 Pantalla Inicio

Muestra un resumen de la operación. Desde el menú lateral se llega a las demás pantallas.

[Captura: pantalla Inicio con la sesión del coordinador]

### 2.2 Importar servicios

1. En el menú, abre **Operación → Importar servicios**.
2. Elige el **mayorista**.
3. Arrastra el archivo o haz clic en **Elegir archivo de servicios**. Acepta `.xlsx` o `.csv` de hasta 5 MB.
4. Revisa la **vista previa**. Los contadores indican cuántas filas están bien y cuáles tienen problemas.
5. Si es correcto, pulsa **Confirmar importación** y acepta el mensaje.

[Captura: vista previa de una importación con sus contadores por estado]

Si al archivo le faltan encabezados, el sistema lo indica y no lo importa. Corrige el archivo y vuelve a subirlo.

Para consultar lo cargado, abre **Historial de importaciones** y selecciona un archivo. Los servicios individuales se consultan en **Servicios**.

[Captura: historial de importaciones]

### 2.3 Generar el rol

1. Abre **Operación → Generar rol**.
2. Elige el **Día de operación**.
3. Pulsa **Generar rol**.
4. Revisa el **Resumen del rol**: servicios del día, asignados, no cubiertos, unidades usadas y tiempo de generación.

[Captura: resultado de generar el rol con su resumen]

Si ya existía un rol **propuesto** para ese día, el sistema pregunta si deseas reemplazarlo. Pulsa **Generar de nuevo** solo si quieres descartar los ajustes manuales. Un rol **autorizado** ya no se puede regenerar.

### 2.4 Revisar y ajustar el rol

1. Abre **Operación → Revisar rol** y elige el día.
2. Revisa la **línea de tiempo por unidad** y la lista **Servicios por unidad**.
3. Para cambiar un servicio de unidad, pulsa su botón de mover y elige una opción en **Mover a…**. El sistema solo ofrece las unidades que pueden tomarlo sin romper las reglas.

[Captura: línea de tiempo por unidad en Revisar rol]

[Captura: diálogo Mover a… con las unidades disponibles]

### 2.5 Atender los servicios no cubiertos

El panel **Servicios no cubiertos** agrupa los que el sistema no pudo asignar, con su motivo:

| Motivo | Qué significa | Qué hacer |
|---|---|---|
| Capacidad | El grupo no cabe en ninguna unidad disponible | Contratar una unidad externa |
| Empalme | Todas las unidades están ocupadas a esa hora | Reacomodar servicios o contratar unidad externa |
| Jornada | Se excedería la jornada máxima del operador | Reasignar o contratar unidad externa |
| Zona de término | La unidad no podría cerrar bien el día | Reasignar a otra unidad |
| Sin unidad | No hay unidades u operadores disponibles | Revisar disponibilidad con el administrador |

Para asignar uno manualmente, pulsa **Asignar a…** y elige una unidad.

[Captura: panel de servicios no cubiertos agrupados por motivo]

### 2.6 Autorizar el rol

1. Cuando el rol esté listo, pulsa **Autorizar rol**.
2. Confirma con **Autorizar**.

Antes de autorizar, el sistema vuelve a comprobar que no haya empalmes ni violaciones de las reglas. Al autorizar, los servicios quedan **Programados**, aparecen en Monitoreo y cada operador los ve en **Mi rol**.

[Captura: rol con estado Autorizado]

### 2.7 Exportar el rol

En **Revisar rol**, sección **Exportar el rol**:

1. Elige **Todos los operadores** o uno en particular.
2. Pulsa **Exportar CSV** (para Excel) o **Exportar PDF** (para imprimir).

[Captura: sección Exportar el rol]

### 2.8 Rutas sugeridas

1. Abre **Operación → Rutas sugeridas** y elige el día y la **Unidad**.
2. Consulta el mapa, las **Paradas de la ruta** y los totales de distancia y manejo.
3. Con **Comparar con** puedes ver otra unidad en el mismo mapa.

Si el trazado por carretera no está disponible, el mapa muestra una línea punteada aproximada. Las horas del rol no cambian.

[Captura: mapa de rutas sugeridas con la lista de paradas]

### 2.9 Monitoreo e indicadores

El coordinador usa estas pantallas igual que el supervisor. Consulta las secciones [3.1](#31-monitoreo-del-día), [3.2](#32-registrar-una-incidencia) y [3.3](#33-indicadores).

---

## 3. Capítulo del supervisor

El supervisor da seguimiento a la operación durante el día. Puede consultar el rol, las rutas, los servicios, los catálogos y la configuración, pero no generar ni autorizar el rol.

### 3.1 Monitoreo del día

1. Abre **Operación → Monitoreo**.
2. Elige el **Día de operación**. El tablero muestra datos cuando el rol de ese día ya está autorizado.
3. Revisa los **Totales por estado** y la tabla **Servicios del día**.
4. Usa los filtros de **Estado** y **Unidad** para localizar un servicio.

La información se actualiza sola cada 30 segundos.

[Captura: tablero de monitoreo con totales por estado]

**Para cambiar el estado de un servicio:**

1. En la columna **Acciones**, abre el menú del servicio.
2. Elige la acción que corresponda:
   - **Iniciar**: la unidad va en camino.
   - **Pasajeros a bordo**: los pasajeros ya subieron.
   - **Completar**: el servicio terminó.
   - **Cancelar servicio**: ya no se realizará.
   - **Marcar no show**: el pasajero no se presentó.

[Captura: menú de acciones de un servicio]

> Cancelar, marcar no show y completar son definitivos. Revisa el folio antes de confirmar.

### 3.2 Registrar una incidencia

1. En el menú de **Acciones** del servicio, elige **Registrar incidencia**.
2. Elige el **Tipo**: Retraso, Falla mecánica, Pasajero no se presentó, Cambio de hora u Otro.
3. Escribe la **Descripción**, por ejemplo: «Vuelo demorado 40 minutos; la unidad espera en CUN».
4. Guarda.

La incidencia aparece en **Incidencias del día**. Registrarla no cambia el estado del servicio: si además hay que cancelarlo o marcarlo como no show, hazlo desde **Acciones**.

[Captura: diálogo Registrar incidencia]

### 3.3 Indicadores

1. Abre **Operación → Indicadores**.
2. Elige el rango con **Desde** y **Hasta** (máximo 31 días).
3. Revisa las tarjetas de **Cobertura**, **Empalmes**, **Completados** e **Incidencias**.
4. Consulta las gráficas y la tabla **Por día**.

La columna **Elaboración (min)** indica los minutos desde la última generación del rol hasta su autorización. Si un rol se regeneró, solo cuenta desde la última vez.

[Captura: pantalla Indicadores con tarjetas y gráficas]

[Captura: tabla Por día con el promedio del rango]

### 3.4 Consultas

El supervisor también puede consultar **Revisar rol**, **Rutas sugeridas**, **Servicios**, **Historial de importaciones**, catálogos y configuración. También puede exportar el rol en CSV o PDF.

---

## 4. Capítulo del operador

El operador (chofer) usa el sistema, normalmente desde el celular, para ver sus servicios y avisar su avance.

### 4.1 Entrar desde el celular

1. Conecta el celular a la red indicada por la empresa.
2. Abre el navegador y escribe la dirección del sistema.
3. Inicia sesión con tu cuenta.

Si al entrar no ves servicios y crees que deberías tenerlos, pide al administrador que revise que tu cuenta esté vinculada a tu registro de operador.

[Captura: inicio de sesión en un celular]

### 4.2 Consultar Mi rol

1. En el menú, abre **Mi rol**.
2. Se muestra el día actual. Con el campo **Día** puedes ver otra fecha.
3. En **Mis servicios** revisa, en orden, la hora, el origen, el destino y los pasajeros.

Solo aparecen servicios de roles ya autorizados.

[Captura: pantalla Mi rol en un celular]

### 4.3 Actualizar el avance

Cada servicio muestra un botón con el siguiente paso:

| Momento | Botón |
|---|---|
| Sales hacia el punto de recogida | **Iniciar** |
| Los pasajeros ya subieron | **Pasajeros a bordo** |
| Dejaste a los pasajeros en su destino | **Completar** |

[Captura: tarjeta de un servicio con el botón Iniciar]

Si aparece el aviso **«Ya pasó la hora y no se ha iniciado»**, inicia el servicio o comunícate con tu supervisor.

> Si un pasajero no se presenta, se cancela un servicio o hay un problema en el camino, **avisa a tu supervisor o coordinador**. Ellos lo registran en el sistema.

### 4.4 Descargar tu rol

En **Mi rol**, pulsa **Exportar PDF** o **Exportar CSV**. Solo se descargan tus servicios.

[Captura: botones para exportar en Mi rol]

---

## 5. Capítulo del administrador

El administrador tiene acceso a todas las pantallas. Además de lo descrito en los capítulos del coordinador y del supervisor, mantiene los datos base y las cuentas.

### 5.1 Usuarios

**Crear un usuario:**

1. Abre **Administración → Usuarios** y pulsa **Nuevo usuario**.
2. Captura **Nombre**, **Correo** y **Contraseña** (mínimo 8 caracteres).
3. Elige el rol y guarda.

**Otras acciones** desde la fila del usuario: editar, **Cambiar contraseña**, desactivar o reactivar. Un usuario inactivo no puede entrar y conserva su historial.

[Captura: pantalla Usuarios]

### 5.2 Vehículos

1. Abre **Catálogos → Vehículos**.
2. Da de alta o edita unidades con su número económico, tipo, capacidad, estado y encierro.

La capacidad máxima por tipo es: Van/Urvan 14, Sprinter 20 y Autobús 45. Una unidad que no esté disponible no recibe servicios.

[Captura: catálogo de vehículos]

### 5.3 Operadores y usuario vinculado

1. Abre **Catálogos → Operadores** y pulsa **Nuevo operador** o edita uno.
2. Captura nombre, licencia y teléfono.
3. Elige su **Unidad** y su **Hora de cita**, dentro del bloque matutino (04:00 a 05:00) o vespertino (12:00 a 13:00).
4. En **Usuario vinculado**, elige su cuenta con rol Operador. Sin este vínculo, el chofer no ve sus servicios en **Mi rol**.
5. Marca **Disponible para asignación** y guarda.

Un operador sin unidad o sin hora de cita no participa en el rol. Cada unidad tiene un solo operador y cada cuenta se vincula a un solo operador.

[Captura: formulario de operador con el campo Usuario vinculado]

### 5.4 Zonas y hoteles

- **Catálogos → Zonas**: nombre y coordenadas de cada zona.
- **Catálogos → Hoteles**: nombre, zona y coordenadas. Para que una importación reconozca un hotel, debe existir aquí con el mismo nombre.

[Captura: catálogo de hoteles]

### 5.5 Parámetros de operación

En **Configuración → Parámetros** se ajustan los bloques de hora de cita, la jornada máxima, la anticipación por modalidad y el parámetro del motor de asignación. Pulsa **Guardar cambios** para aplicar o **Descartar cambios** para deshacer.

Los cambios se aplican a los roles que se generen después.

[Captura: pantalla Parámetros de operación]

### 5.6 Zonas de término

En **Configuración → Zonas de término** se marcan las zonas donde una unidad puede terminar el día sin regresar a su encierro. Debe quedar al menos una.

[Captura: pantalla Zonas de término]

### 5.7 Matriz de tiempos

1. Abre **Configuración → Matriz de tiempos**.
2. Edita los minutos de traslado entre zonas. Cada sentido tiene su propio valor.
3. Las celdas vacías se resaltan: el motor necesita esos tiempos para generar el rol.
4. Pulsa **Guardar cambios** o **Descartar**.

[Captura: matriz de tiempos de traslado]

### 5.8 Bitácora

En **Administración → Bitácora** se consultan las acciones registradas. Se puede filtrar por **Usuario**, **Acción**, **Entidad** y fechas **Desde** y **Hasta**.

[Captura: bitácora con filtros]

### 5.9 Mantenimiento del servidor

Levantar y detener el sistema, abrir el acceso por red, hacer respaldos y restaurarlos se explica en la [Guía de despliegue](despliegue.md). Se recomienda hacer un respaldo antes de cada actualización.

---

## 6. Glosario

| Término | Significado |
|---|---|
| **Rol** | Plan del día: qué unidad y operador realiza cada servicio |
| **Propuesto** | Rol generado que todavía se puede ajustar |
| **Autorizado** | Rol aprobado que ya se usa en la operación |
| **Unidad** | Vehículo con su operador |
| **Encierro** | Zona donde se guarda la unidad |
| **Hora de cita** | Hora en que el operador inicia su jornada |
| **Jornada** | Tiempo de trabajo desde la hora de cita; máximo 9.5 horas |
| **Empalme** | Dos servicios de una unidad que se traslapan o no dejan tiempo de traslado |
| **Zona de término** | Zona donde una unidad puede cerrar su día |
| **No cubierto** | Servicio que no se pudo asignar a ninguna unidad |
| **No show** | El pasajero no se presentó |
| **Mayorista** | Empresa que envía los servicios |

---

## 7. Problemas frecuentes

| Problema | Qué hacer |
|---|---|
| No abre la página | Revisa que estés en la misma red y que la dirección sea correcta. Avisa al administrador |
| «Correo o contraseña incorrectos» | Revisa los datos. Si persiste, pide un cambio de contraseña |
| Me sacó del sistema | La sesión venció. Vuelve a iniciar sesión |
| No veo una opción del menú | Tu rol no tiene acceso a esa pantalla |
| Monitoreo no muestra servicios | El rol de ese día todavía no está autorizado |
| El operador no ve servicios | Revisa que el rol esté autorizado y que su cuenta esté vinculada |
| Un hotel no se reconoce al importar | El administrador debe darlo de alta o corregir el nombre |
| El mapa no carga | El equipo necesita internet para los mapas. El resto del sistema sigue funcionando |
