import type { INestApplication } from '@nestjs/common';
import { jest } from '@jest/globals';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { RolUsuario } from '../src/generated/prisma/client.js';
import { verificarRol } from '../src/motor/verificador.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import {
  crearApp,
  crearUsuario,
  limpiarBase,
  obtenerToken,
} from './utilidades-e2e.js';

const DIA = '2026-11-10';
/** 00:00 del 10/11/2026 en Cancún (UTC−5). */
const INICIO_DIA = new Date('2026-11-10T05:00:00Z');
interface Resumen {
  servicios: number;
  asignados: number;
  noCubiertos: number;
  unidadesUsadas: number;
  tiempoMs: number;
  porMotivo: Record<string, number>;
}

describe('Motor de asignación: roles (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const token: Partial<Record<RolUsuario, string>> = {};
  const zona: Record<string, number> = {};

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    await limpiarBase(prisma);
    for (const rol of Object.values(RolUsuario)) {
      const email = `${rol.toLowerCase()}@prueba.local`;
      await crearUsuario(prisma, email, rol);
      token[rol] = await obtenerToken(app, email);
    }
    // Zonas (CUN y ZH de término), matriz completa y parámetros.
    for (const [nombre, termino] of [
      ['Aeropuerto CUN', true],
      ['Zona Hotelera', true],
      ['Centro Cancún', false],
      ['Tulum', false],
    ] as const) {
      zona[nombre] = (
        await prisma.zona.create({
          data: { nombre, latitud: 21, longitud: -87, esZonaTermino: termino },
        })
      ).id;
    }
    const ids = Object.values(zona);
    await prisma.tiempoTraslado.createMany({
      data: ids.flatMap((o) =>
        ids.map((d) => ({
          zonaOrigenId: o,
          zonaDestinoId: d,
          minutos:
            o === d ? 10 : o === zona.Tulum || d === zona.Tulum ? 100 : 30,
        })),
      ),
    });
    await prisma.parametroOperacion.createMany({
      data: [
        ['hora_cita.bloque_matutino', '04:00-05:00'],
        ['hora_cita.bloque_vespertino', '12:00-13:00'],
        ['jornada_maxima_horas', '9.5'],
        ['anticipacion.PRIVADO', '10'],
        ['anticipacion.COMPARTIDO', '20'],
        ['anticipacion.GRUPO', '30'],
        ['motor.penalizacion_carga_min', '15'],
      ].map(([clave, valor]) => ({ clave, valor, descripcion: clave })),
    });
    // Cuatro unidades: dos vans disponibles, una en mantenimiento y una cuyo
    // operador no tiene hora de cita (no participa en el rol).
    for (const [n, estado, horaCita] of [
      [1, 'DISPONIBLE', '04:00'],
      [2, 'DISPONIBLE', '04:00'],
      [3, 'MANTENIMIENTO', '04:00'],
      [4, 'DISPONIBLE', null],
    ] as const) {
      const v = await prisma.vehiculo.create({
        data: {
          numeroEconomico: `BL-0${n}`,
          tipo: 'Van',
          capacidad: 14,
          estado,
          encierroBase: 'Centro Cancún',
        },
      });
      await prisma.operador.create({
        data: {
          nombre: `Operador ${n}`,
          licencia: `L-${n}`,
          telefono: '998-000-0000',
          vehiculoId: v.id,
          horaCita,
        },
      });
    }
    const mayorista = await prisma.mayorista.create({
      data: { nombre: 'Nexus Tours' },
    });
    const servicio = (
      folio: string,
      minutos: number,
      origen: string,
      destino: string,
      pasajeros = 4,
      dia = INICIO_DIA,
    ) => ({
      mayoristaId: mayorista.id,
      folio,
      localizador: 'L',
      tipo: 'TRASLADO' as const,
      modalidad: 'PRIVADO' as const,
      fechaHora: new Date(dia.getTime() + minutos * 60_000),
      pasajeros,
      zonaOrigenId: zona[origen],
      zonaDestinoId: zona[destino],
    });
    await prisma.servicio.createMany({
      data: [
        servicio('S-1', 300, 'Aeropuerto CUN', 'Zona Hotelera'),
        servicio('S-2', 320, 'Aeropuerto CUN', 'Zona Hotelera'),
        servicio('S-3', 420, 'Zona Hotelera', 'Aeropuerto CUN'),
        servicio('S-4', 480, 'Aeropuerto CUN', 'Zona Hotelera', 30), // CAPACIDAD
        servicio('S-5', 900, 'Aeropuerto CUN', 'Zona Hotelera'), // JORNADA
        // Otro día, para la prueba de rollback de un rol nuevo.
        servicio(
          'O-1',
          300,
          'Aeropuerto CUN',
          'Zona Hotelera',
          4,
          new Date('2026-11-11T05:00:00Z'),
        ),
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const generar = (
    fecha: string,
    rol: RolUsuario | null = RolUsuario.COORDINADOR,
  ) => {
    const peticion = request(app.getHttpServer())
      .post('/api/roles/generar')
      .send({ fecha });
    return rol
      ? peticion.set('Authorization', `Bearer ${token[rol]}`)
      : peticion;
  };
  const conteo = async () => ({
    roles: await prisma.rolDiario.count(),
    asignaciones: await prisma.asignacion.count(),
    noCubiertos: await prisma.servicioNoCubierto.count(),
  });

  it('201: genera y guarda el rol PROPUESTO; los servicios siguen PENDIENTE', async () => {
    const respuesta = await generar(DIA).expect(201);
    const { resumen, reemplazado, rol } = respuesta.body as {
      resumen: Resumen;
      reemplazado: boolean;
      rol: { id: number; estado: string };
    };

    expect(reemplazado).toBe(false);
    expect(rol.estado).toBe('PROPUESTO');
    expect(resumen).toMatchObject({
      servicios: 5,
      asignados: 3,
      noCubiertos: 2,
      unidadesDisponibles: 2,
      porMotivo: { CAPACIDAD: 1, JORNADA: 1 },
    });
    expect(await conteo()).toEqual({
      roles: 1,
      asignaciones: 3,
      noCubiertos: 2,
    });
    expect(
      await prisma.servicio.count({ where: { estado: 'PENDIENTE' } }),
    ).toBe(6);

    const registro = await prisma.bitacora.findFirstOrThrow({
      where: { entidad: 'rol_diario', entidadId: rol.id },
    });
    expect(registro.accion).toMatch(
      /^CREAR: 2026-11-10: 3 asignados, 2 no cubiertos, \d+ ms$/,
    );
  });

  it('lo guardado cumple todas las restricciones (verificador independiente)', async () => {
    const [servicios, vehiculos, asignaciones, noCubiertos, tiempos] =
      await Promise.all([
        prisma.servicio.findMany({ where: { folio: { startsWith: 'S-' } } }),
        prisma.vehiculo.findMany({ include: { operador: true } }),
        prisma.asignacion.findMany({ orderBy: { orden: 'asc' } }),
        prisma.servicioNoCubierto.findMany(),
        prisma.tiempoTraslado.findMany(),
      ]);
    const minutos = (d: Date) =>
      Math.round((d.getTime() - INICIO_DIA.getTime()) / 60_000);
    const citas: Record<string, number> = { '04:00': 240 };
    const violaciones = verificarRol(
      {
        servicios: servicios.map((s) => ({
          id: s.id,
          folio: s.folio,
          hora: minutos(s.fechaHora),
          modalidad: s.modalidad,
          pasajeros: s.pasajeros,
          origen: s.zonaOrigenId,
          destino: s.zonaDestinoId,
        })),
        unidades: vehiculos.map((v) => ({
          vehiculoId: v.id,
          numeroEconomico: v.numeroEconomico,
          capacidad: v.capacidad,
          operadorId: v.operador!.id,
          disponible:
            v.estado === 'DISPONIBLE' && v.operador!.horaCita !== null,
          cita: citas[v.operador!.horaCita ?? '04:00'],
          encierro: zona['Centro Cancún'],
        })),
        anticipacion: { PRIVADO: 10, COMPARTIDO: 20, GRUPO: 30 },
        jornadaMaxima: 570,
        zonasTermino: new Set([zona['Aeropuerto CUN'], zona['Zona Hotelera']]),
        matriz: new Map(
          tiempos.map((t) => [
            `${t.zonaOrigenId}-${t.zonaDestinoId}`,
            t.minutos,
          ]),
        ),
      },
      {
        asignaciones: vehiculos.map((v) => ({
          vehiculoId: v.id,
          servicios: asignaciones
            .filter((a) => a.vehiculoId === v.id)
            .map((a) => ({
              id: a.servicioId,
              inicio: minutos(a.inicioEfectivo),
              liberacion: minutos(a.liberacion),
            })),
        })),
        noCubiertos: noCubiertos.map((n) => n.servicioId),
      },
    );
    expect(violaciones).toEqual([]);
  });

  it('200: consulta el rol agrupado por unidad y los no cubiertos (SUPERVISOR)', async () => {
    const rol = await request(app.getHttpServer())
      .get(`/api/roles/${DIA}`)
      .set('Authorization', `Bearer ${token.SUPERVISOR}`)
      .expect(200);
    const cuerpo = rol.body as {
      resumen: Resumen;
      unidades: {
        vehiculo: { numeroEconomico: string };
        asignaciones: { orden: number }[];
      }[];
    };
    expect(cuerpo.resumen).toEqual({
      servicios: 5,
      asignados: 3,
      noCubiertos: 2,
      unidadesUsadas: 2,
    });
    expect(cuerpo.unidades.map((u) => u.vehiculo.numeroEconomico)).toEqual([
      'BL-01',
      'BL-02',
    ]);
    for (const u of cuerpo.unidades) {
      expect(u.asignaciones.map((a) => a.orden)).toEqual(
        u.asignaciones.map((_, i) => i + 1),
      );
    }

    const noCubiertos = await request(app.getHttpServer())
      .get(`/api/roles/${DIA}/no-cubiertos`)
      .set('Authorization', `Bearer ${token.SUPERVISOR}`)
      .expect(200);
    expect(
      (
        noCubiertos.body as { motivo: string; servicio: { folio: string } }[]
      ).map((n) => [n.servicio.folio, n.motivo]),
    ).toEqual([
      ['S-4', 'CAPACIDAD'],
      ['S-5', 'JORNADA'],
    ]);
  });

  it('201: regenerar un rol PROPUESTO lo reemplaza sin duplicar nada', async () => {
    const antes = await prisma.rolDiario.findFirstOrThrow();
    const respuesta = await generar(DIA, RolUsuario.ADMINISTRADOR).expect(201);

    expect(respuesta.body).toMatchObject({
      reemplazado: true,
      rol: { id: antes.id },
    });
    expect(await conteo()).toEqual({
      roles: 1,
      asignaciones: 3,
      noCubiertos: 2,
    });
    const registros = await prisma.bitacora.findMany({
      where: { entidad: 'rol_diario' },
      orderBy: { id: 'asc' },
    });
    expect(registros.map((r) => r.accion.split(':')[0])).toEqual([
      'CREAR',
      'ACTUALIZAR',
    ]);
  });

  it('si falla el guardado no queda nada a medias (se deshace toda la transacción)', async () => {
    const antes = await conteo();
    const original = prisma.$transaction.bind(prisma);
    // El último paso (bitácora) falla: lo ya escrito en la transacción se deshace.
    const espia = jest.spyOn(prisma, '$transaction').mockImplementation(((
      fn: (tx: unknown) => Promise<unknown>,
    ) =>
      original((tx) =>
        fn(
          new Proxy(tx, {
            get: (destino, propiedad) =>
              propiedad === 'bitacora'
                ? { create: () => Promise.reject(new Error('Falla simulada')) }
                : Reflect.get(destino, propiedad),
          }),
        ),
      )) as never);
    try {
      // Reemplazo del rol del 10/11 y rol nuevo del 11/11.
      await generar(DIA).expect(500);
      await generar('2026-11-11').expect(500);
    } finally {
      espia.mockRestore();
    }
    expect(await conteo()).toEqual(antes);
    expect(
      await prisma.rolDiario.count({
        where: { fecha: new Date('2026-11-11T00:00:00Z') },
      }),
    ).toBe(0);
  });

  it('400: sin servicios PENDIENTE en la fecha y fecha inválida', async () => {
    const sinServicios = await generar('2026-12-25').expect(400);
    expect(sinServicios.body).toMatchObject({
      message: 'No hay servicios PENDIENTE el 2026-12-25',
    });
    await generar('10/11/2026').expect(400);
    await request(app.getHttpServer())
      .get('/api/roles/2026-13-40')
      .set('Authorization', `Bearer ${token.COORDINADOR}`)
      .expect(400);
  });

  it('404: no hay rol de esa fecha', () => {
    return request(app.getHttpServer())
      .get('/api/roles/2026-12-25/no-cubiertos')
      .set('Authorization', `Bearer ${token.COORDINADOR}`)
      .expect(404);
  });

  it('403: SUPERVISOR y OPERADOR no generan; OPERADOR no consulta', async () => {
    await generar(DIA, RolUsuario.SUPERVISOR).expect(403);
    await generar(DIA, RolUsuario.OPERADOR).expect(403);
    await request(app.getHttpServer())
      .get(`/api/roles/${DIA}`)
      .set('Authorization', `Bearer ${token.OPERADOR}`)
      .expect(403);
  });

  it('401: sin token', () => {
    return generar(DIA, null).expect(401);
  });

  it('409: no se regenera un rol AUTORIZADO', async () => {
    await prisma.rolDiario.updateMany({ data: { estado: 'AUTORIZADO' } });
    const respuesta = await generar(DIA).expect(409);
    expect(respuesta.body).toMatchObject({
      message:
        'El rol del 2026-11-10 ya está AUTORIZADO; no se puede volver a generar',
    });
    expect(await prisma.asignacion.count()).toBe(3);
  });
});
