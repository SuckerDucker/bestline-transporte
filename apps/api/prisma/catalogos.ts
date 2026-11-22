/**
 * Catálogos que comparten el seed de desarrollo (seed.ts) y el de producción
 * (sembrar-produccion.ts): zonas, matriz de tiempos, hoteles, flota, operadores
 * y parámetros de operación. Las reglas y qué datos son de ejemplo se explican
 * en el encabezado de seed.ts.
 */
import {
  EstadoVehiculo,
  ModalidadServicio,
} from '../src/generated/prisma/client.js';

// ───────────── Zonas (coordenadas aproximadas, de ejemplo) ─────────────
// "clave" se usa solo para armar las claves de los parámetros; no es una columna.
export const ZONAS = [
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
    // Valor de operación: TQO no es zona de término (solo Zona Hotelera y CUN).
    esZonaTermino: false,
  },
] as const;

export type ClaveZona = (typeof ZONAS)[number]['clave'];

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

export function minutosTraslado(origen: number, destino: number): number {
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

// ───────────── Hoteles (reales, de cada zona; coordenadas de OpenStreetMap) ─────────────
export const HOTELES: {
  nombre: string;
  zona: ClaveZona;
  latitud: number;
  longitud: number;
}[] = [
  {
    nombre: 'Hyatt Ziva Cancun',
    zona: 'ZONA_HOTELERA',
    latitud: 21.1359,
    longitud: -86.7415,
  },
  {
    nombre: 'Kempinski Hotel Cancun',
    zona: 'ZONA_HOTELERA',
    latitud: 21.0932,
    longitud: -86.7682,
  },
  {
    nombre: 'Hotel Plaza Caribe',
    zona: 'CENTRO_CANCUN',
    latitud: 21.1647,
    longitud: -86.827,
  },
  {
    nombre: 'Dreams Playa Mujeres',
    zona: 'COSTA_MUJERES',
    latitud: 21.2619,
    longitud: -86.8149,
  },
  {
    nombre: 'Excellence Riviera Cancun',
    zona: 'PUERTO_MORELOS',
    latitud: 20.8755,
    longitud: -86.8664,
  },
  {
    nombre: 'Grand Hyatt Playa del Carmen',
    zona: 'PLAYA_DEL_CARMEN',
    latitud: 20.6305,
    longitud: -87.0671,
  },
  {
    nombre: 'Paradisus Playa del Carmen',
    zona: 'PLAYA_DEL_CARMEN',
    latitud: 20.6472,
    longitud: -87.0567,
  },
  {
    nombre: 'Azulik Tulum',
    zona: 'TULUM',
    latitud: 20.179,
    longitud: -87.4454,
  },
];

// Hoteles que aparecen en el archivo de ejemplo docs/ejemplos/Layout_Servicios_Nexus.xlsx,
// con la zona que indica el archivo y las coordenadas aproximadas del hotel.
// Grand Velas Riviera Maya (en Playa del Carmen) y Moon Palace Sunrise (al sur
// del aeropuerto) quedan fuera de la zona que les da el archivo; se respeta la
// zona del archivo porque es la que usa la matriz de tiempos.
// Se agregan para que la importación del ejemplo encuentre sus hoteles; no se
// usan para generar los 60 servicios de ejemplo (así esos datos no cambian).
export const HOTELES_LAYOUT: typeof HOTELES = [
  {
    nombre: 'Planet Hollywood Cancun',
    zona: 'COSTA_MUJERES',
    latitud: 21.2902,
    longitud: -86.8183,
  },
  {
    nombre: 'TRS Coral Hotel',
    zona: 'COSTA_MUJERES',
    latitud: 21.2656,
    longitud: -86.8161,
  },
  {
    nombre: 'Grand Velas Riviera Maya',
    zona: 'PUERTO_MORELOS',
    latitud: 20.6739,
    longitud: -87.024,
  },
  {
    nombre: 'Hotel Xcaret Arte',
    zona: 'PLAYA_DEL_CARMEN',
    latitud: 20.5895,
    longitud: -87.1101,
  },
  {
    nombre: 'Barceló Maya Palace',
    zona: 'PLAYA_DEL_CARMEN',
    latitud: 20.4907,
    longitud: -87.2381,
  },
  {
    nombre: 'Iberostar Selection Cancun',
    zona: 'ZONA_HOTELERA',
    latitud: 21.0675,
    longitud: -86.7784,
  },
  {
    nombre: 'Hard Rock Hotel Cancun',
    zona: 'ZONA_HOTELERA',
    latitud: 21.0894,
    longitud: -86.7699,
  },
  {
    nombre: 'Moon Palace Sunrise',
    zona: 'ZONA_HOTELERA',
    latitud: 20.9883,
    longitud: -86.8285,
  },
];

// ───────────── Flota ─────────────
// Las capacidades son las de operación (máximo por tipo: Van 14, Sprinter 20,
// Autobús 45). Números económicos son de ejemplo.
// SUPUESTO POR CONFIRMAR: el encierro base es el nombre de una zona del catálogo
// (de ahí sale cada unidad al inicio del día); todas usan Centro Cancún.
const ENCIERRO_BASE = 'Centro Cancún';
// REGLA CONFIRMADA CON LA EMPRESA (flota): 4 Van/Urvan (14), 5 Sprinter (20)
// y 1 Autobús (45). Todas disponibles. (El caso de una unidad en mantenimiento
// u operador no disponible se prueba en las pruebas unitarias y e2e.)
export const VEHICULOS = [
  ...Array.from({ length: 4 }, () => ({ tipo: 'Van', capacidad: 14 })),
  ...Array.from({ length: 5 }, () => ({ tipo: 'Sprinter', capacidad: 20 })),
  ...Array.from({ length: 1 }, () => ({ tipo: 'Autobús', capacidad: 45 })),
].map((v, i) => ({
  ...v,
  numeroEconomico: `BL-${String(i + 1).padStart(2, '0')}`,
  estado: EstadoVehiculo.DISPONIBLE,
  encierroBase: ENCIERRO_BASE,
}));

// ───────────── Operadores (nombres inventados) ─────────────
// Cada operador maneja el vehículo de su mismo número (Operador 03 → BL-03).
// REGLA CONFIRMADA CON LA EMPRESA: 5 operadores en el bloque matutino
// (04:00-05:00) y 5 en el vespertino (12:00-13:00). Las horas exactas dentro de
// cada bloque son de ejemplo.
const HORAS_CITA = [
  '04:00',
  '04:15',
  '04:30',
  '04:45',
  '05:00',
  '12:00',
  '12:15',
  '12:30',
  '12:45',
  '13:00',
];
const NOMBRES_OPERADORES = [
  'José Hernández',
  'Carlos Martínez',
  'Luis García',
  'Roberto Sánchez',
  'Fernando López',
  'Ricardo Díaz',
  'Alejandro Cruz',
  'Manuel Flores',
  'Javier Morales',
  'Héctor Ramos',
];
export const OPERADORES = NOMBRES_OPERADORES.map((nombre, i) => {
  const n = String(i + 1).padStart(2, '0');
  return {
    nombre,
    licencia: `LIC-QROO-${n}`,
    telefono: `998-000-00${n}`,
    disponible: true,
    horaCita: HORAS_CITA[i],
    numeroEconomico: `BL-${n}`,
  };
});

// ───────────── Parámetros de operación ─────────────
// La anticipación depende solo de la modalidad del servicio.
const ANTICIPACION: Record<ModalidadServicio, number> = {
  PRIVADO: 10,
  COMPARTIDO: 20,
  GRUPO: 30,
};
export const PARAMETROS: {
  clave: string;
  valor: string;
  descripcion: string;
}[] = [
  {
    clave: 'hora_cita.bloque_matutino',
    valor: '04:00-05:00',
    descripcion:
      'Bloque matutino de horas de cita (HH:mm-HH:mm, America/Cancun)',
  },
  {
    clave: 'hora_cita.bloque_vespertino',
    valor: '12:00-13:00',
    descripcion:
      'Bloque vespertino de horas de cita (HH:mm-HH:mm, America/Cancun)',
  },
  {
    clave: 'jornada_maxima_horas',
    valor: '9.5',
    descripcion: 'Jornada máxima en horas desde la hora de cita',
  },
  {
    // Valor de ejemplo: minutos que se suman al costo por cada servicio que
    // la unidad ya tiene, para repartir la carga entre unidades.
    clave: 'motor.penalizacion_carga_min',
    valor: '15',
    descripcion:
      'Minutos de penalización por servicio ya asignado a la unidad (motor)',
  },
  ...Object.values(ModalidadServicio).map((modalidad) => ({
    clave: `anticipacion.${modalidad}`,
    valor: String(ANTICIPACION[modalidad]),
    descripcion: `Minutos de anticipación para servicios ${modalidad}`,
  })),
];
