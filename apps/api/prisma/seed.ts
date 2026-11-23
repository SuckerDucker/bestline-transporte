/**
 * Seed de desarrollo.
 *
 * Hay dos clases de datos:
 *
 * 1) VALORES DE OPERACIÓN (indicados por el alumno para la Fase 6):
 *    - capacidad máxima por tipo: Van/Urvan 14, Sprinter 20, Autobús 45;
 *    - anticipación por modalidad: PRIVADO 10, COMPARTIDO 20, GRUPO 30 minutos;
 *    - bloques de hora de cita (confirmados por la empresa): matutino
 *      04:00-05:00 y vespertino 12:00-13:00;
 *    - jornada máxima: 9.5 horas;
 *    - zonas de término: solo Zona Hotelera y Aeropuerto CUN.
 *
 * 2) DATOS DE EJEMPLO: todo lo demás (nombres de operadores y usuarios, que
 *    son inventados; números económicos, folios, vuelos, tiempos de traslado y
 *    los 60 servicios). No son datos reales de Best Line Travel Agency.
 *    Los hoteles son hoteles reales de cada zona, con coordenadas aproximadas
 *    tomadas de OpenStreetMap; solo sirven de referencia en el mapa.
 *    También son de ejemplo: el vehículo de cada operador, la hora exacta de
 *    cita dentro de cada bloque, el encierro base de las unidades (zona
 *    Centro Cancún, supuesto por confirmar) y la penalización de carga del
 *    motor (15 min). La composición de la flota (4 Van/Urvan, 5 Sprinter y 1
 *    Autobús), los dos bloques de 5 operadores, que el autobús (BL-10) trabaje
 *    en el bloque vespertino, la distribución diaria de los servicios por
 *    franja, el primer servicio a partir de las 04:45 y los 2 grupos de más de
 *    20 pasajeros como máximo (los demás de 2 a 12) son reglas confirmadas por
 *    la empresa (Lic. Magalis Casanova): los 60 servicios son datos de ejemplo
 *    construidos con esos parámetros reales.
 *    Los 8 hoteles de HOTELES_LAYOUT son los del archivo de ejemplo anonimizado
 *    de la empresa (docs/ejemplos), para que su importación encuentre los hoteles.
 *
 * Usuarios: el ADMINISTRADOR toma correo y contraseña de apps/api/.env
 * (ADMIN_EMAIL, ADMIN_PASSWORD). Los usuarios de ejemplo de COORDINADOR,
 * SUPERVISOR y OPERADOR usan la contraseña SEED_PASSWORD_EJEMPLO del mismo .env.
 * Todas las contraseñas se guardan cifradas con bcrypt.
 *
 * Se puede ejecutar varias veces: usa upsert (crear o actualizar) para no duplicar.
 * Ejecutar con: npx prisma db seed
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import {
  ModalidadServicio,
  type Hotel,
  type Mayorista,
  PrismaClient,
  RolUsuario,
  TipoServicio,
} from '../src/generated/prisma/client.js';
import {
  type ClaveZona,
  HOTELES,
  HOTELES_LAYOUT,
  minutosTraslado,
  OPERADORES,
  PARAMETROS,
  VEHICULOS,
  ZONAS,
} from './catalogos.js';

// La sesión con PostgreSQL se fuerza a UTC: el adaptador envía las fechas como
// texto en UTC sin zona, y si el servidor usa otra zona (America/Cancun en el
// contenedor) las interpretaría mal (+5 h). timestamptz guarda el instante exacto;
// la conversión a America/Cancun se hace al mostrar los datos.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  options: '-c timezone=UTC',
});
const prisma = new PrismaClient({ adapter });

// Fecha de operación de ejemplo (zona horaria America/Cancun = UTC-05:00 todo el año).
const FECHA_EJEMPLO = '2026-11-10';
const OFFSET_CANCUN = '-05:00';

// ───────────── Generador pseudoaleatorio con semilla fija ─────────────
// Así el seed produce siempre los mismos 60 servicios (resultados reproducibles).
// Algoritmo mulberry32: opera con enteros de 32 bits (Math.imul) y no pierde
// precisión. La versión anterior multiplicaba números que pasaban de 2^53 y los
// bits bajos quedaban en cero, por lo que casi todos los servicios caían en el
// mismo hotel.
function crearAleatorio(semilla: number) {
  let estado = semilla >>> 0;
  return (min: number, max: number): number => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const aleatorio = ((t ^ (t >>> 14)) >>> 0) / 4294967296; // [0, 1)
    return min + Math.floor(aleatorio * (max - min + 1));
  };
}

function horaCancun(minutosDesdeMedianoche: number): Date {
  const h = String(Math.floor(minutosDesdeMedianoche / 60)).padStart(2, '0');
  const m = String(minutosDesdeMedianoche % 60).padStart(2, '0');
  return new Date(`${FECHA_EJEMPLO}T${h}:${m}:00${OFFSET_CANCUN}`);
}

async function main(): Promise<void> {
  // 1) Usuario ADMINISTRADOR desde .env
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminNombre = process.env.ADMIN_NOMBRE ?? 'Administrador';
  if (!adminEmail || !adminPassword) {
    throw new Error('Faltan ADMIN_EMAIL o ADMIN_PASSWORD en apps/api/.env');
  }
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.usuario.upsert({
    where: { email: adminEmail },
    update: {
      nombre: adminNombre,
      passwordHash,
      rol: RolUsuario.ADMINISTRADOR,
      activo: true,
    },
    create: {
      nombre: adminNombre,
      email: adminEmail,
      passwordHash,
      rol: RolUsuario.ADMINISTRADOR,
    },
  });

  // 1b) Un usuario de ejemplo por cada uno de los demás roles
  const passwordEjemplo = process.env.SEED_PASSWORD_EJEMPLO;
  if (!passwordEjemplo) {
    throw new Error('Falta SEED_PASSWORD_EJEMPLO en apps/api/.env');
  }
  const hashEjemplo = await bcrypt.hash(passwordEjemplo, 10);
  const usuariosEjemplo = [
    {
      nombre: 'Laura Méndez',
      email: 'coordinador@bestline.local',
      rol: RolUsuario.COORDINADOR,
    },
    {
      nombre: 'Jorge Ramírez',
      email: 'supervisor@bestline.local',
      rol: RolUsuario.SUPERVISOR,
    },
    {
      // Mismo nombre que el operador 01 del catálogo.
      nombre: 'José Hernández',
      email: 'operador@bestline.local',
      rol: RolUsuario.OPERADOR,
    },
  ];
  for (const u of usuariosEjemplo) {
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: { ...u, passwordHash: hashEjemplo, activo: true },
      create: { ...u, passwordHash: hashEjemplo },
    });
  }

  // 2) Zonas
  const idZona = {} as Record<ClaveZona, number>;
  for (const { clave, ...zona } of ZONAS) {
    const registro = await prisma.zona.upsert({
      where: { nombre: zona.nombre },
      update: zona,
      create: zona,
    });
    idZona[clave] = registro.id;
  }

  // 3) Matriz de tiempos (8 x 8 = 64 registros, incluye misma zona)
  for (let o = 0; o < ZONAS.length; o++) {
    for (let d = 0; d < ZONAS.length; d++) {
      const zonaOrigenId = idZona[ZONAS[o].clave];
      const zonaDestinoId = idZona[ZONAS[d].clave];
      const minutos = minutosTraslado(o, d);
      await prisma.tiempoTraslado.upsert({
        where: { zonaOrigenId_zonaDestinoId: { zonaOrigenId, zonaDestinoId } },
        update: { minutos },
        create: { zonaOrigenId, zonaDestinoId, minutos },
      });
    }
  }

  // 4) Parámetros de operación (valores de operación, ver encabezado)
  const parametros = PARAMETROS;
  for (const p of parametros) {
    await prisma.parametroOperacion.upsert({
      where: { clave: p.clave },
      update: p,
      create: p,
    });
  }
  // Se eliminan las claves de versiones anteriores del seed (hora_cita única y
  // anticipaciones por tipo y zona), que ya no aplican.
  await prisma.parametroOperacion.deleteMany({
    where: { clave: { notIn: parametros.map((p) => p.clave) } },
  });

  // 5) Mayoristas
  const mayoristas: Mayorista[] = [];
  for (const nombre of ['TUI', 'Nexus Tours']) {
    mayoristas.push(
      await prisma.mayorista.upsert({
        where: { nombre },
        update: {},
        create: { nombre },
      }),
    );
  }

  // 6) Hoteles (sin columna única: se busca por nombre para no duplicar)
  const guardarHotel = async ({ zona, ...hotel }: (typeof HOTELES)[number]) => {
    const datos = { ...hotel, zonaId: idZona[zona] };
    const existente = await prisma.hotel.findFirst({
      where: { nombre: hotel.nombre },
    });
    return existente
      ? prisma.hotel.update({ where: { id: existente.id }, data: datos })
      : prisma.hotel.create({ data: datos });
  };
  // Solo los 8 hoteles de HOTELES se usan para generar los servicios de ejemplo.
  const hoteles: Hotel[] = [];
  for (const hotel of HOTELES) hoteles.push(await guardarHotel(hotel));
  for (const hotel of HOTELES_LAYOUT) await guardarHotel(hotel);

  // 7) Vehículos
  for (const v of VEHICULOS) {
    await prisma.vehiculo.upsert({
      where: { numeroEconomico: v.numeroEconomico },
      update: v,
      create: v,
    });
  }

  // 8) Operadores (sin columna única: se busca por nombre) con su vehículo.
  // Primero se sueltan los vehículos del seed para no chocar con el índice
  // único de vehiculo_id al volver a correr el seed.
  const idVehiculo = new Map(
    (
      await prisma.vehiculo.findMany({
        select: { id: true, numeroEconomico: true },
      })
    ).map((v) => [v.numeroEconomico, v.id]),
  );
  await prisma.operador.updateMany({
    where: {
      vehiculoId: {
        in: OPERADORES.map((o) => idVehiculo.get(o.numeroEconomico) ?? -1),
      },
    },
    data: { vehiculoId: null },
  });
  for (const { numeroEconomico, ...op } of OPERADORES) {
    const datos = {
      ...op,
      vehiculoId: idVehiculo.get(numeroEconomico) ?? null,
    };
    const existente = await prisma.operador.findFirst({
      where: { nombre: op.nombre },
    });
    if (existente)
      await prisma.operador.update({
        where: { id: existente.id },
        data: datos,
      });
    else await prisma.operador.create({ data: datos });
  }

  // 8b) El usuario operador@bestline.local es el operador 01 (José Hernández,
  // BL-01): con él entra a "Mi rol". Se busca por correo y por nombre.
  const usuarioOperador = await prisma.usuario.findUniqueOrThrow({
    where: { email: 'operador@bestline.local' },
  });
  await prisma.operador.updateMany({
    where: { usuarioId: usuarioOperador.id },
    data: { usuarioId: null },
  });
  await prisma.operador.updateMany({
    where: { nombre: OPERADORES[0].nombre },
    data: { usuarioId: usuarioOperador.id },
  });

  // 9) Servicios: 60 servicios del 2026-11-10.
  // Datos de ejemplo construidos con los parámetros reales de la empresa
  // (REGLA CONFIRMADA CON LA EMPRESA, distribución diaria):
  //   - mañana (04:00-11:59): 15 a 18 servicios, principalmente SALIDAS de
  //     hotel al aeropuerto con familias (caben en Van o Sprinter);
  //   - mediodía y tarde (12:00-18:59): 30 a 35, el pico, con llegadas de
  //     Norteamérica y Europa y salidas de la tarde;
  //   - noche (19:00-21:45): 8 a 10;
  //   - los grupos de más de 20 pasajeros llegan a partir de las 13:00.
  // REGLA CONFIRMADA CON LA EMPRESA (primer servicio del día): el operador
  // tarda de 30 a 40 min del encierro al primer hotel; los primeros servicios
  // reales son a partir de las 04:45.
  // REGLA CONFIRMADA CON LA EMPRESA (grupos): en un día normal hay 1 o 2
  // grupos de más de 20 pasajeros como máximo (los toma el autobús en la
  // tarde); el resto de los servicios son de 2 a 12 pasajeros. Aquí, 2 grupos
  // grandes (llegadas internacionales después de las 13:00).
  // Se usan 16, 34 y 10. La composición total es la misma de antes:
  //   LLEGADA:  10 PRIVADO, 10 COMPARTIDO, 4 GRUPO  (24)
  //   SALIDA:   10 PRIVADO, 10 COMPARTIDO, 4 GRUPO  (24)
  //   TRASLADO:  6 PRIVADO,  3 COMPARTIDO, 3 GRUPO  (12)
  // La modalidad GRUPO define la anticipación (30 min); como en el archivo de
  // la empresa, un servicio GRUPO puede llevar de 2 a 12 pasajeros.
  // Rango de minutos (desde las 00:00 de Cancún) de cada franja; los grupos
  // grandes empiezan a las 13:00.
  const MANANA = { desde: 285, hasta: 715 }; // 04:45-11:55
  const TARDE = { desde: 720, hasta: 1135 }; // 12:00-18:55
  const TARDE_GRUPOS = { desde: 780, hasta: 1135 }; // 13:00-18:55
  const NOCHE = { desde: 1140, hasta: 1305 }; // 19:00-21:45
  type Franja = { desde: number; hasta: number };
  const { LLEGADA, SALIDA, TRASLADO } = TipoServicio;
  const { PRIVADO, COMPARTIDO, GRUPO } = ModalidadServicio;
  /** true: grupo grande (más de 20 pasajeros). */
  const GRANDE = true;
  const reparto: [Franja, TipoServicio, ModalidadServicio, number, boolean?][] =
    [
      // Mañana (16): sobre todo salidas; sin grupos.
      [MANANA, SALIDA, PRIVADO, 5],
      [MANANA, SALIDA, COMPARTIDO, 5],
      [MANANA, LLEGADA, PRIVADO, 2],
      [MANANA, LLEGADA, COMPARTIDO, 1],
      [MANANA, TRASLADO, PRIVADO, 2],
      [MANANA, TRASLADO, COMPARTIDO, 1],
      // Mediodía y tarde (34): el pico; los 2 grupos grandes desde las 13:00.
      [TARDE, LLEGADA, PRIVADO, 6],
      [TARDE, LLEGADA, COMPARTIDO, 7],
      [TARDE_GRUPOS, LLEGADA, GRUPO, 2, GRANDE],
      [TARDE, LLEGADA, GRUPO, 1],
      [TARDE, SALIDA, PRIVADO, 3],
      [TARDE, SALIDA, COMPARTIDO, 4],
      [TARDE, SALIDA, GRUPO, 4],
      [TARDE, TRASLADO, PRIVADO, 3],
      [TARDE, TRASLADO, COMPARTIDO, 1],
      [TARDE, TRASLADO, GRUPO, 3],
      // Noche (10).
      [NOCHE, LLEGADA, PRIVADO, 2],
      [NOCHE, LLEGADA, COMPARTIDO, 2],
      [NOCHE, LLEGADA, GRUPO, 1],
      [NOCHE, SALIDA, PRIVADO, 2],
      [NOCHE, SALIDA, COMPARTIDO, 1],
      [NOCHE, TRASLADO, PRIVADO, 1],
      [NOCHE, TRASLADO, COMPARTIDO, 1],
    ];
  const azar = crearAleatorio(20261110);
  const zonaDeHotel = (h: Hotel) => h.zonaId;
  // Los hoteles de Tulum usan el aeropuerto TQO; los demás, el aeropuerto CUN.
  const aeropuertoDe = (h: Hotel) =>
    h.zonaId === idZona.TULUM ? idZona.AEROPUERTO_TQO : idZona.AEROPUERTO_CUN;
  const aeropuertos = [idZona.AEROPUERTO_CUN, idZona.AEROPUERTO_TQO];

  // Pasajeros (rangos de ejemplo dentro de la regla de 2 a 12): PRIVADO 2 a
  // 6, COMPARTIDO 4 a 12 y GRUPO 2 a 12; los 2 grupos grandes, 21 a 35
  // (solo caben en el autobús).
  const pasajerosDe = (m: ModalidadServicio, grande: boolean): number =>
    grande
      ? azar(21, 35)
      : m === ModalidadServicio.PRIVADO
        ? azar(2, 6)
        : azar(m === ModalidadServicio.COMPARTIDO ? 4 : 2, 12);

  let consecutivo = 0;
  for (const [franja, tipo, modalidad, cantidad, grande = false] of reparto) {
    for (let i = 0; i < cantidad; i++) {
      consecutivo++;
      const mayorista = mayoristas[consecutivo % 2];
      const prefijo = mayorista.nombre === 'TUI' ? 'TUI' : 'NEX';
      const hotel = hoteles[azar(0, hoteles.length - 1)];
      // Hora dentro de la franja, en múltiplos de 5 minutos.
      const fechaHora = horaCancun(
        franja.desde + azar(0, (franja.hasta - franja.desde) / 5) * 5,
      );

      let zonaOrigenId: number;
      let zonaDestinoId: number;
      let vuelo: string | null = null;

      if (tipo === TipoServicio.LLEGADA) {
        // Del aeropuerto al hotel; lleva número de vuelo.
        zonaOrigenId = aeropuertoDe(hotel);
        zonaDestinoId = zonaDeHotel(hotel);
        vuelo = `EJ${azar(100, 999)}`;
      } else if (tipo === TipoServicio.SALIDA) {
        // Del hotel al aeropuerto; lleva número de vuelo.
        zonaOrigenId = zonaDeHotel(hotel);
        zonaDestinoId = aeropuertoDe(hotel);
        vuelo = `EJ${azar(100, 999)}`;
      } else {
        // TRASLADO: del hotel a otra zona que no sea aeropuerto; sin vuelo.
        zonaOrigenId = zonaDeHotel(hotel);
        const otras = ZONAS.map((z) => idZona[z.clave]).filter(
          (id) => id !== zonaOrigenId && !aeropuertos.includes(id),
        );
        zonaDestinoId = otras[azar(0, otras.length - 1)];
      }
      const pasajeros = pasajerosDe(modalidad, grande);

      const folio = `${prefijo}-${String(consecutivo).padStart(4, '0')}`;
      const localizador = `LOC-EJ-${String(consecutivo).padStart(4, '0')}`;
      const datos = {
        mayoristaId: mayorista.id,
        tipo,
        modalidad,
        fechaHora,
        pasajeros,
        zonaOrigenId,
        zonaDestinoId,
        hotelId: hotel.id,
        vuelo,
      };
      await prisma.servicio.upsert({
        where: { folio_localizador: { folio, localizador } },
        update: datos,
        create: { folio, localizador, ...datos },
      });
    }
  }

  // Comprobaciones de las reglas confirmadas con la empresa.
  const grupoTemprano = await prisma.servicio.findFirst({
    where: {
      importacionId: null,
      pasajeros: { gt: 20 },
      fechaHora: { gte: horaCancun(0), lt: horaCancun(13 * 60) },
    },
  });
  if (grupoTemprano) {
    throw new Error(
      `El servicio ${grupoTemprano.folio} tiene más de 20 pasajeros antes de las 13:00`,
    );
  }
  const delDia = {
    importacionId: null,
    fechaHora: { gte: horaCancun(0), lt: horaCancun(24 * 60) },
  };
  const [antesDe0445, grandes, fueraDeRango] = await Promise.all([
    prisma.servicio.count({
      where: {
        ...delDia,
        fechaHora: { gte: horaCancun(0), lt: horaCancun(285) },
      },
    }),
    prisma.servicio.count({ where: { ...delDia, pasajeros: { gt: 20 } } }),
    prisma.servicio.count({
      where: {
        ...delDia,
        pasajeros: { lte: 20 },
        NOT: { pasajeros: { gte: 2, lte: 12 } },
      },
    }),
  ]);
  if (antesDe0445 > 0) {
    throw new Error(`Hay ${antesDe0445} servicios antes de las 04:45`);
  }
  if (grandes !== 2 || fueraDeRango > 0) {
    throw new Error(
      `Debe haber 2 grupos de más de 20 pasajeros y los demás de 2 a 12 (hay ${grandes} grupos y ${fueraDeRango} fuera de rango)`,
    );
  }
  const autobus = await prisma.vehiculo.findUnique({
    where: { numeroEconomico: 'BL-10' },
    include: { operador: true },
  });
  const cita = autobus?.operador?.horaCita ?? '';
  if (autobus?.tipo !== 'Autobús' || cita < '12:00' || cita > '13:00') {
    throw new Error(
      `El autobús BL-10 debe tener operador con cita en el bloque vespertino (tiene "${cita}")`,
    );
  }

  const conteo = {
    usuarios: await prisma.usuario.count(),
    zonas: await prisma.zona.count(),
    hoteles: await prisma.hotel.count(),
    tiemposTraslado: await prisma.tiempoTraslado.count(),
    parametros: await prisma.parametroOperacion.count(),
    mayoristas: await prisma.mayorista.count(),
    vehiculos: await prisma.vehiculo.count(),
    operadores: await prisma.operador.count(),
    servicios: await prisma.servicio.count(),
  };
  console.log('Seed de ejemplo cargado:', conteo);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
