/**
 * Seed de desarrollo.
 *
 * IMPORTANTE: TODOS LOS DATOS DE ESTE ARCHIVO SON DE EJEMPLO.
 * No son datos reales de Best Line Travel Agency: nombres de hoteles, operadores,
 * vehículos, folios, vuelos, tiempos de traslado y parámetros son ficticios o
 * aproximados y solo sirven para probar el sistema. Las coordenadas de las zonas
 * son aproximadas.
 *
 * El único dato que no está aquí es el usuario ADMINISTRADOR: su correo y su
 * contraseña se leen de apps/api/.env (ADMIN_EMAIL, ADMIN_PASSWORD) y la
 * contraseña se guarda cifrada con bcrypt.
 *
 * Se puede ejecutar varias veces: usa upsert (crear o actualizar) para no duplicar.
 * Ejecutar con: npx prisma db seed
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import {
  EstadoVehiculo,
  ModalidadServicio,
  type Hotel,
  type Mayorista,
  PrismaClient,
  RolUsuario,
  TipoServicio,
} from '../src/generated/prisma/client.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Fecha de operación de ejemplo (zona horaria America/Cancun = UTC-05:00 todo el año).
const FECHA_EJEMPLO = '2026-11-10';
const OFFSET_CANCUN = '-05:00';

// ───────────── Zonas (coordenadas aproximadas, de ejemplo) ─────────────
// "clave" se usa solo para armar las claves de los parámetros; no es una columna.
const ZONAS = [
  {
    clave: 'AEROPUERTO_CUN',
    nombre: 'Aeropuerto CUN',
    latitud: 21.0365,
    longitud: -86.8771,
    esZonaTermino: true,
  },
  {
    clave: 'ZONA_HOTELERA',
    nombre: 'Zona Hotelera',
    latitud: 21.11,
    longitud: -86.763,
    esZonaTermino: true,
  },
  {
    clave: 'CENTRO_CANCUN',
    nombre: 'Centro Cancún',
    latitud: 21.1619,
    longitud: -86.8515,
    esZonaTermino: false,
  },
  {
    clave: 'COSTA_MUJERES',
    nombre: 'Costa Mujeres',
    latitud: 21.236,
    longitud: -86.806,
    esZonaTermino: false,
  },
  {
    clave: 'PUERTO_MORELOS',
    nombre: 'Puerto Morelos',
    latitud: 20.8468,
    longitud: -86.8755,
    esZonaTermino: false,
  },
  {
    clave: 'PLAYA_DEL_CARMEN',
    nombre: 'Playa del Carmen',
    latitud: 20.6296,
    longitud: -87.0739,
    esZonaTermino: false,
  },
  {
    clave: 'TULUM',
    nombre: 'Tulum',
    latitud: 20.2114,
    longitud: -87.4654,
    esZonaTermino: false,
  },
  {
    clave: 'AEROPUERTO_TQO',
    nombre: 'Aeropuerto TQO',
    latitud: 20.0856,
    longitud: -87.5967,
    esZonaTermino: true,
  },
] as const;

type ClaveZona = (typeof ZONAS)[number]['clave'];

// ───────────── Matriz de tiempos de traslado (minutos, de ejemplo) ─────────────
// Tiempo base entre cada par de zonas (en el orden de ZONAS). Para que la matriz
// sea distinta por sentido, al tiempo base se le suman 5 minutos cuando el viaje
// va "hacia atrás" en la lista (por ejemplo, Tulum -> Aeropuerto CUN).
const TIEMPO_BASE: Partial<
  Record<ClaveZona, Partial<Record<ClaveZona, number>>>
> = {
  AEROPUERTO_CUN: {
    ZONA_HOTELERA: 25,
    CENTRO_CANCUN: 20,
    COSTA_MUJERES: 40,
    PUERTO_MORELOS: 25,
    PLAYA_DEL_CARMEN: 50,
    TULUM: 100,
    AEROPUERTO_TQO: 120,
  },
  ZONA_HOTELERA: {
    CENTRO_CANCUN: 20,
    COSTA_MUJERES: 45,
    PUERTO_MORELOS: 45,
    PLAYA_DEL_CARMEN: 70,
    TULUM: 120,
    AEROPUERTO_TQO: 140,
  },
  CENTRO_CANCUN: {
    COSTA_MUJERES: 30,
    PUERTO_MORELOS: 35,
    PLAYA_DEL_CARMEN: 65,
    TULUM: 115,
    AEROPUERTO_TQO: 135,
  },
  COSTA_MUJERES: {
    PUERTO_MORELOS: 60,
    PLAYA_DEL_CARMEN: 90,
    TULUM: 140,
    AEROPUERTO_TQO: 160,
  },
  PUERTO_MORELOS: { PLAYA_DEL_CARMEN: 35, TULUM: 85, AEROPUERTO_TQO: 105 },
  PLAYA_DEL_CARMEN: { TULUM: 60, AEROPUERTO_TQO: 80 },
  TULUM: { AEROPUERTO_TQO: 30 },
};
const TIEMPO_MISMA_ZONA = 10;
const RECARGO_SENTIDO_INVERSO = 5;

function minutosTraslado(origen: number, destino: number): number {
  if (origen === destino) return TIEMPO_MISMA_ZONA;
  const [a, b] = origen < destino ? [origen, destino] : [destino, origen];
  const base = TIEMPO_BASE[ZONAS[a].clave]?.[ZONAS[b].clave];
  if (base === undefined) {
    throw new Error(
      `Falta tiempo base entre ${ZONAS[a].nombre} y ${ZONAS[b].nombre}`,
    );
  }
  return origen < destino ? base : base + RECARGO_SENTIDO_INVERSO;
}

// ───────────── Hoteles (nombres genéricos, de ejemplo) ─────────────
const HOTELES: {
  nombre: string;
  zona: ClaveZona;
  latitud: number;
  longitud: number;
}[] = [
  {
    nombre: 'Hotel Ejemplo ZH 1',
    zona: 'ZONA_HOTELERA',
    latitud: 21.1335,
    longitud: -86.7465,
  },
  {
    nombre: 'Hotel Ejemplo ZH 2',
    zona: 'ZONA_HOTELERA',
    latitud: 21.0905,
    longitud: -86.7725,
  },
  {
    nombre: 'Hotel Ejemplo Centro 1',
    zona: 'CENTRO_CANCUN',
    latitud: 21.1605,
    longitud: -86.8475,
  },
  {
    nombre: 'Hotel Ejemplo Costa Mujeres 1',
    zona: 'COSTA_MUJERES',
    latitud: 21.2405,
    longitud: -86.8025,
  },
  {
    nombre: 'Hotel Ejemplo Puerto Morelos 1',
    zona: 'PUERTO_MORELOS',
    latitud: 20.8505,
    longitud: -86.8735,
  },
  {
    nombre: 'Hotel Ejemplo Playa 1',
    zona: 'PLAYA_DEL_CARMEN',
    latitud: 20.6335,
    longitud: -87.0705,
  },
  {
    nombre: 'Hotel Ejemplo Playa 2',
    zona: 'PLAYA_DEL_CARMEN',
    latitud: 20.6205,
    longitud: -87.0785,
  },
  {
    nombre: 'Hotel Ejemplo Tulum 1',
    zona: 'TULUM',
    latitud: 20.2075,
    longitud: -87.4605,
  },
];

// ───────────── Flota (de ejemplo) ─────────────
const VEHICULOS = [
  ...Array.from({ length: 5 }, () => ({ tipo: 'Van', capacidad: 10 })),
  ...Array.from({ length: 3 }, () => ({ tipo: 'Sprinter', capacidad: 19 })),
  ...Array.from({ length: 2 }, () => ({ tipo: 'Autobús', capacidad: 40 })),
].map((v, i) => ({
  ...v,
  numeroEconomico: `BL-${String(i + 1).padStart(2, '0')}`,
  // Una unidad en mantenimiento para que el motor tenga un caso que descartar.
  estado: i === 9 ? EstadoVehiculo.MANTENIMIENTO : EstadoVehiculo.DISPONIBLE,
  encierroBase: 'Encierro Centro Cancún (ejemplo)',
}));

// ───────────── Operadores (genéricos, de ejemplo) ─────────────
const OPERADORES = Array.from({ length: 10 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return {
    nombre: `Operador Ejemplo ${n}`,
    licencia: `LIC-EJEMPLO-${n}`,
    telefono: `998-000-00${n}`,
    // Un operador no disponible para probar ese caso.
    disponible: i !== 9,
  };
});

// ───────────── Generador pseudoaleatorio con semilla fija ─────────────
// Así el seed produce siempre los mismos 60 servicios (resultados reproducibles).
function crearAleatorio(semilla: number) {
  let estado = semilla;
  return (min: number, max: number): number => {
    estado = (estado * 1103515245 + 12345) % 2147483648;
    return min + (estado % (max - min + 1));
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

  // 4) Parámetros de operación
  const parametros: { clave: string; valor: string; descripcion: string }[] = [
    {
      clave: 'hora_cita',
      valor: '05:00',
      descripcion:
        'Valor de ejemplo: hora de cita de los operadores (HH:mm, America/Cancun)',
    },
    {
      clave: 'jornada_maxima_horas',
      valor: '9.5',
      descripcion:
        'Valor de ejemplo: jornada máxima en horas desde la hora de cita',
    },
  ];
  for (const tipo of Object.values(TipoServicio)) {
    // Valores de ejemplo: LLEGADA = 0 minutos; SALIDA y TRASLADO = 15 minutos.
    const minutos = tipo === TipoServicio.LLEGADA ? 0 : 15;
    for (const zona of ZONAS) {
      parametros.push({
        clave: `anticipacion.${tipo}.${zona.clave}`,
        valor: String(minutos),
        descripcion: `Valor de ejemplo: minutos de anticipación para ${tipo} con origen en ${zona.nombre}`,
      });
    }
  }
  for (const p of parametros) {
    await prisma.parametroOperacion.upsert({
      where: { clave: p.clave },
      update: p,
      create: p,
    });
  }

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
  const hoteles: Hotel[] = [];
  for (const { zona, ...hotel } of HOTELES) {
    const datos = { ...hotel, zonaId: idZona[zona] };
    const existente = await prisma.hotel.findFirst({
      where: { nombre: hotel.nombre },
    });
    hoteles.push(
      existente
        ? await prisma.hotel.update({
            where: { id: existente.id },
            data: datos,
          })
        : await prisma.hotel.create({ data: datos }),
    );
  }

  // 7) Vehículos
  for (const v of VEHICULOS) {
    await prisma.vehiculo.upsert({
      where: { numeroEconomico: v.numeroEconomico },
      update: v,
      create: v,
    });
  }

  // 8) Operadores (sin columna única: se busca por nombre)
  for (const op of OPERADORES) {
    const existente = await prisma.operador.findFirst({
      where: { nombre: op.nombre },
    });
    if (existente)
      await prisma.operador.update({ where: { id: existente.id }, data: op });
    else await prisma.operador.create({ data: op });
  }

  // 9) Servicios: 60 servicios del 2026-11-10
  // Reparto de ejemplo por tipo (sentido) y modalidad:
  //   LLEGADA:  10 PRIVADO, 10 COMPARTIDO, 4 GRUPO  (24)
  //   SALIDA:   10 PRIVADO, 10 COMPARTIDO, 4 GRUPO  (24)
  //   TRASLADO:  6 PRIVADO,  3 COMPARTIDO, 3 GRUPO  (12)
  const reparto: [TipoServicio, ModalidadServicio, number][] = [
    [TipoServicio.LLEGADA, ModalidadServicio.PRIVADO, 10],
    [TipoServicio.LLEGADA, ModalidadServicio.COMPARTIDO, 10],
    [TipoServicio.LLEGADA, ModalidadServicio.GRUPO, 4],
    [TipoServicio.SALIDA, ModalidadServicio.PRIVADO, 10],
    [TipoServicio.SALIDA, ModalidadServicio.COMPARTIDO, 10],
    [TipoServicio.SALIDA, ModalidadServicio.GRUPO, 4],
    [TipoServicio.TRASLADO, ModalidadServicio.PRIVADO, 6],
    [TipoServicio.TRASLADO, ModalidadServicio.COMPARTIDO, 3],
    [TipoServicio.TRASLADO, ModalidadServicio.GRUPO, 3],
  ];
  const azar = crearAleatorio(20261110);
  const zonaDeHotel = (h: Hotel) => h.zonaId;
  // Los hoteles de Tulum usan el aeropuerto TQO; los demás, el aeropuerto CUN.
  const aeropuertoDe = (h: Hotel) =>
    h.zonaId === idZona.TULUM ? idZona.AEROPUERTO_TQO : idZona.AEROPUERTO_CUN;
  const aeropuertos = [idZona.AEROPUERTO_CUN, idZona.AEROPUERTO_TQO];

  // Pasajeros según la modalidad (rangos de ejemplo). Los grupos pueden superar
  // la capacidad de una van, lo que sirve para probar la regla de capacidad.
  const pasajerosPorModalidad = (m: ModalidadServicio): number =>
    m === ModalidadServicio.PRIVADO
      ? azar(1, 6)
      : m === ModalidadServicio.COMPARTIDO
        ? azar(4, 12)
        : azar(15, 35);

  let consecutivo = 0;
  for (const [tipo, modalidad, cantidad] of reparto) {
    for (let i = 0; i < cantidad; i++) {
      consecutivo++;
      const mayorista = mayoristas[consecutivo % 2];
      const prefijo = mayorista.nombre === 'TUI' ? 'TUI' : 'NEX';
      const hotel = hoteles[azar(0, hoteles.length - 1)];
      // Hora entre 05:30 y 20:00, en múltiplos de 5 minutos.
      const fechaHora = horaCancun(330 + azar(0, 174) * 5);

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
      const pasajeros = pasajerosPorModalidad(modalidad);

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
