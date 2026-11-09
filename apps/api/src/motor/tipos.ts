// Tipos del motor de asignación. Todas las horas están en MINUTOS contados
// desde las 00:00 (hora de Cancún) del día del rol: 06:15 → 375.

export type Modalidad = 'PRIVADO' | 'COMPARTIDO' | 'GRUPO';

/** Restricciones que puede incumplir una unidad, en el orden en que se revisan. */
export const RESTRICCIONES = ['CAPACIDAD', 'EMPALME', 'JORNADA'] as const;
export type Restriccion = (typeof RESTRICCIONES)[number];

/** Motivos de servicio_no_cubierto (enum MotivoRechazo de la base). */
export type Motivo = Restriccion | 'ZONA_TERMINO' | 'SIN_UNIDAD';

export interface ServicioMotor {
  id: number;
  folio: string;
  /** Hora del servicio (minutos). */
  hora: number;
  modalidad: Modalidad;
  pasajeros: number;
  origen: number;
  destino: number;
}

/** Servicio con las horas que calcula el motor. */
export interface ServicioCalculado extends ServicioMotor {
  /** hora − anticipación(modalidad) */
  inicio: number;
  /** hora + tiempo(origen, destino) */
  liberacion: number;
}

export interface UnidadMotor {
  vehiculoId: number;
  numeroEconomico: string;
  capacidad: number;
  operadorId: number;
  /** Vehículo DISPONIBLE y su operador disponible; si no, no participa en el rol. */
  disponible: boolean;
  /** Hora de cita del operador (minutos). */
  cita: number;
  /** Zona del encierro base, de donde sale la unidad. */
  encierro: number;
}

/** Unidad durante la generación: con la secuencia de servicios que lleva. */
export interface UnidadEnRol extends UnidadMotor {
  secuencia: ServicioCalculado[];
}

export interface ParametrosMotor {
  anticipacion: Record<Modalidad, number>;
  /** jornada_maxima_horas en minutos */
  jornadaMaxima: number;
  /** motor.penalizacion_carga_min */
  penalizacionCarga: number;
  /** Zonas donde una unidad puede terminar su último servicio. */
  zonasTermino: ReadonlySet<number>;
  /** Minutos de traslado de una zona a otra (matriz por sentido). */
  tiempo: (origen: number, destino: number) => number;
}

export interface NoCubierto {
  servicio: ServicioCalculado;
  motivo: Motivo;
}

export interface ResultadoRol {
  /** Unidades que participaron, cada una con su secuencia (orden = posición). */
  unidades: UnidadEnRol[];
  noCubiertos: NoCubierto[];
}
