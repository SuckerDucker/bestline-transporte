/**
 * Carga inicial de producción: catálogos y UN administrador. No crea usuarios
 * de prueba, servicios, importaciones ni roles.
 *
 * Solo trabaja con la base vacía (sin usuarios): corre en cada arranque de la
 * API, pero después de la primera vez no hace nada. Así nunca restablece una
 * contraseña ni deshace lo que el administrador cambió en los catálogos.
 * Todo va en una transacción: si algo falla, la base queda vacía y se reintenta.
 */
import bcrypt from 'bcrypt';
import {
  type PrismaClient,
  RolUsuario,
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

export interface AdminInicial {
  nombre: string;
  email: string;
  password: string;
}

const MAYORISTAS = ['TUI', 'Nexus Tours'];

/** Devuelve true si cargó los datos y false si la base ya estaba inicializada. */
export async function sembrarProduccion(
  prisma: PrismaClient,
  admin: AdminInicial,
): Promise<boolean> {
  if ((await prisma.usuario.count()) > 0) return false;
  const passwordHash = await bcrypt.hash(admin.password, 10);

  await prisma.$transaction(
    async (tx) => {
      await tx.usuario.create({
        data: {
          nombre: admin.nombre,
          email: admin.email.trim().toLowerCase(),
          passwordHash,
          rol: RolUsuario.ADMINISTRADOR,
        },
      });

      const idZona = {} as Record<ClaveZona, number>;
      for (const { clave, ...zona } of ZONAS) {
        idZona[clave] = (await tx.zona.create({ data: zona })).id;
      }
      await tx.tiempoTraslado.createMany({
        data: ZONAS.flatMap((origen, o) =>
          ZONAS.map((destino, d) => ({
            zonaOrigenId: idZona[origen.clave],
            zonaDestinoId: idZona[destino.clave],
            minutos: minutosTraslado(o, d),
          })),
        ),
      });

      await tx.parametroOperacion.createMany({ data: PARAMETROS });
      await tx.mayorista.createMany({
        data: MAYORISTAS.map((nombre) => ({ nombre })),
      });
      await tx.hotel.createMany({
        data: [...HOTELES, ...HOTELES_LAYOUT].map(({ zona, ...hotel }) => ({
          ...hotel,
          zonaId: idZona[zona],
        })),
      });

      for (const { numeroEconomico, ...operador } of OPERADORES) {
        const datos = VEHICULOS.find(
          (v) => v.numeroEconomico === numeroEconomico,
        );
        if (!datos) throw new Error(`No existe la unidad ${numeroEconomico}`);
        const vehiculo = await tx.vehiculo.create({ data: datos });
        await tx.operador.create({
          data: { ...operador, vehiculoId: vehiculo.id },
        });
      }
    },
    { timeout: 30_000 },
  );
  return true;
}
