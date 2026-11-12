// Carga de los datos que necesita el motor (unidades y parámetros). La usan la
// generación del rol y la revisión manual, para que las dos revisen con las
// mismas reglas y los mismos datos (una sola fuente de verdad).
import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { crearTiempo } from '../motor/algoritmo.js';
import type {
  Modalidad,
  ParametrosMotor,
  ServicioMotor,
  UnidadMotor,
} from '../motor/tipos.js';
import { aMinutos, horaAMinutos } from './conversion.js';

/** Cliente de Prisma o cliente de una transacción. */
export type ClientePrisma = Prisma.TransactionClient;

export interface DatosMotor {
  unidades: UnidadMotor[];
  parametros: ParametrosMotor;
  /** Matriz "origen-destino" → minutos (para el verificador independiente). */
  matriz: Map<string, number>;
  /** Nombre de cada zona por id (para los mensajes). */
  nombreZona: Map<number, string>;
}

/** Fila de servicio con lo que usa el motor. */
export interface FilaServicio {
  id: number;
  folio: string;
  fechaHora: Date;
  modalidad: string;
  pasajeros: number;
  zonaOrigenId: number;
  zonaDestinoId: number;
}

/** Servicio de la base en minutos desde las 00:00 de Cancún del día. */
export const aServicioMotor = (
  inicioDia: Date,
  s: FilaServicio,
): ServicioMotor => ({
  id: s.id,
  folio: s.folio,
  hora: aMinutos(inicioDia, s.fechaHora),
  modalidad: s.modalidad as Modalidad,
  pasajeros: s.pasajeros,
  origen: s.zonaOrigenId,
  destino: s.zonaDestinoId,
});

/**
 * Unidades (vehículo con su operador) y parámetros del motor. Responde 400 si
 * falta un parámetro, si el encierro de una unidad no es una zona o si la
 * matriz no tiene algún tiempo que el motor necesita.
 */
export async function cargarDatosMotor(
  prisma: ClientePrisma,
  servicios: { zonaOrigenId: number; zonaDestinoId: number }[],
): Promise<DatosMotor> {
  const [vehiculos, zonas, tiempos, filas] = await Promise.all([
    // Un vehículo sin operador no participa.
    prisma.vehiculo.findMany({
      where: { operador: { isNot: null } },
      include: { operador: true },
    }),
    prisma.zona.findMany(),
    prisma.tiempoTraslado.findMany(),
    prisma.parametroOperacion.findMany(),
  ]);
  const valor = (clave: string) => {
    const fila = filas.find((p) => p.clave === clave);
    if (!fila) throw new BadRequestException(`Falta el parámetro ${clave}`);
    return fila.valor;
  };
  const zonaPorNombre = new Map(zonas.map((z) => [z.nombre.toLowerCase(), z]));
  const nombreZona = new Map(zonas.map((z) => [z.id, z.nombre]));

  const unidades: UnidadMotor[] = vehiculos.flatMap((v) => {
    const operador = v.operador;
    if (!operador) return [];
    // Participa si el vehículo está DISPONIBLE y su operador está disponible
    // y tiene hora de cita (sin hora de cita no participa).
    const disponible =
      v.estado === 'DISPONIBLE' &&
      operador.disponible &&
      operador.horaCita !== null;
    const encierro = zonaPorNombre.get(v.encierroBase.toLowerCase());
    if (disponible && !encierro) {
      throw new BadRequestException(
        `El encierro base de ${v.numeroEconomico} ("${v.encierroBase}") no es una zona del catálogo`,
      );
    }
    const unidad: UnidadMotor = {
      vehiculoId: v.id,
      numeroEconomico: v.numeroEconomico,
      capacidad: v.capacidad,
      operadorId: operador.id,
      disponible,
      cita: operador.horaCita ? horaAMinutos(operador.horaCita) : 0,
      encierro: encierro?.id ?? 0,
    };
    return [unidad];
  });

  // La matriz debe tener todos los tiempos entre las zonas que se usarán:
  // encierros, orígenes y destinos de los servicios del día. Incluye el
  // regreso en vacío del destino de cada servicio al encierro (zona de término).
  const matriz = new Map(
    tiempos.map((t) => [`${t.zonaOrigenId}-${t.zonaDestinoId}`, t.minutos]),
  );
  const usadas = [
    ...new Set([
      ...unidades.filter((u) => u.disponible).map((u) => u.encierro),
      ...servicios.flatMap((s) => [s.zonaOrigenId, s.zonaDestinoId]),
    ]),
  ];
  const faltantes = usadas.flatMap((o) =>
    usadas
      .filter((d) => !matriz.has(`${o}-${d}`))
      .map((d) => `${nombreZona.get(o)} → ${nombreZona.get(d)}`),
  );
  if (faltantes.length) {
    throw new BadRequestException({
      message: `La matriz de tiempos está incompleta: faltan ${faltantes.length} combinaciones`,
      faltantes,
      error: 'Bad Request',
      statusCode: 400,
    });
  }

  return {
    unidades,
    matriz,
    nombreZona,
    parametros: {
      anticipacion: {
        PRIVADO: Number(valor('anticipacion.PRIVADO')),
        COMPARTIDO: Number(valor('anticipacion.COMPARTIDO')),
        GRUPO: Number(valor('anticipacion.GRUPO')),
      },
      jornadaMaxima: Number(valor('jornada_maxima_horas')) * 60,
      penalizacionCarga: Number(valor('motor.penalizacion_carga_min')),
      zonasTermino: new Set(
        zonas.filter((z) => z.esZonaTermino).map((z) => z.id),
      ),
      tiempo: crearTiempo(matriz),
    },
  };
}
