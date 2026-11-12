import type { INestApplication } from '@nestjs/common';
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
const minutos = (d: Date) =>
  Math.round((d.getTime() - INICIO_DIA.getTime()) / 60_000);
const horaAMinutos = (h: string) => {
  const [hh, mm] = h.split(':').map(Number);
  return hh * 60 + mm;
};

interface Opcion {
  vehiculoId: number;
  numeroEconomico: string;
  actual: boolean;
  valido: boolean;
  motivo?: string;
  detalle?: string;
  posicion?: number;
}

describe('Revisión y autorización del rol (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const token: Partial<Record<RolUsuario, string>> = {};
  const zona: Record<string, number> = {};
  const vehiculo: Record<string, number> = {};
  const servicio: Record<string, number> = {};
  let mayoristaId: number;

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    await limpiarBase(prisma);
    for (const rol of Object.values(RolUsuario)) {
      const email = `${rol.toLowerCase()}@prueba.local`;
      await crearUsuario(prisma, email, rol);
      token[rol] = await obtenerToken(app, email);
    }
    for (const [nombre, termino] of [
      ['Aeropuerto CUN', true],
      ['Zona Hotelera', true],
      ['Centro Cancún', false],
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
          minutos: o === d ? 10 : 30,
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
    // Tres vans con cita 04:00 y BL-04, cuyo operador aún no tiene hora de
    // cita (no participa: DISPONIBILIDAD).
    for (const [n, horaCita] of [
      [1, '04:00'],
      [2, '04:00'],
      [3, '04:00'],
      [4, null],
    ] as const) {
      await crearUnidad(n, horaCita);
    }
    mayoristaId = (
      await prisma.mayorista.create({ data: { nombre: 'Nexus Tours' } })
    ).id;
    for (const [folio, hora, origen, destino, pasajeros] of [
      ['S-1', 300, 'Aeropuerto CUN', 'Zona Hotelera', 4],
      ['S-2', 320, 'Aeropuerto CUN', 'Zona Hotelera', 4],
      ['S-3', 420, 'Zona Hotelera', 'Aeropuerto CUN', 4],
      ['S-4', 480, 'Aeropuerto CUN', 'Zona Hotelera', 30], // CAPACIDAD
      ['S-5', 900, 'Aeropuerto CUN', 'Zona Hotelera', 4], // JORNADA
    ] as const) {
      servicio[folio] = (
        await prisma.servicio.create({
          data: {
            mayoristaId,
            folio,
            localizador: 'L',
            tipo: 'TRASLADO',
            modalidad: 'PRIVADO',
            fechaHora: new Date(INICIO_DIA.getTime() + hora * 60_000),
            pasajeros,
            zonaOrigenId: zona[origen],
            zonaDestinoId: zona[destino],
          },
        })
      ).id;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  async function crearUnidad(n: number, horaCita: string | null) {
    const v = await prisma.vehiculo.create({
      data: {
        numeroEconomico: `BL-0${n}`,
        tipo: 'Van',
        capacidad: 14,
        estado: 'DISPONIBLE',
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
    vehiculo[`BL-0${n}`] = v.id;
  }

  const como = (rol: RolUsuario | null) => {
    // El servidor se toma en cada petición: `app` existe hasta beforeAll.
    const servidor = () => request(app.getHttpServer());
    const auth = (p: request.Test) =>
      rol ? p.set('Authorization', `Bearer ${token[rol]}`) : p;
    return {
      get: (url: string) => auth(servidor().get(`/api/roles/${url}`)),
      patch: (url: string, body: object) =>
        auth(servidor().patch(`/api/roles/${url}`).send(body)),
      post: (url: string, body: object = {}) =>
        auth(servidor().post(`/api/roles/${url}`).send(body)),
    };
  };
  const coord = como(RolUsuario.COORDINADOR);

  /** Asignación guardada del servicio (id y unidad). */
  const asignacionDe = (folio: string) =>
    prisma.asignacion.findFirstOrThrow({
      where: { servicioId: servicio[folio] },
      include: { vehiculo: true },
    });
  const opciones = async (folio: string) =>
    (
      await coord
        .get(`${DIA}/servicios/${servicio[folio]}/opciones`)
        .expect(200)
    ).body as Opcion[];

  /**
   * Verificador independiente sobre lo GUARDADO en la base, con los datos
   * actuales de unidades y matriz. Además, el orden de cada unidad es 1..n.
   */
  async function violaciones() {
    const [servicios, vehiculos, asignaciones, noCubiertos, tiempos] =
      await Promise.all([
        prisma.servicio.findMany(),
        prisma.vehiculo.findMany({ include: { operador: true } }),
        prisma.asignacion.findMany({ orderBy: { orden: 'asc' } }),
        prisma.servicioNoCubierto.findMany(),
        prisma.tiempoTraslado.findMany(),
      ]);
    for (const v of vehiculos) {
      const ordenes = asignaciones
        .filter((a) => a.vehiculoId === v.id)
        .map((a) => a.orden);
      expect(ordenes).toEqual(ordenes.map((_, i) => i + 1));
    }
    return verificarRol(
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
          disponible: v.operador!.horaCita !== null,
          cita: v.operador!.horaCita ? horaAMinutos(v.operador!.horaCita) : 0,
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
  }

  it('genera el rol y GET /roles/:fecha trae unidades (incluidas las vacías), vacío previo y no cubiertos', async () => {
    await coord.post('generar', { fecha: DIA }).expect(201);
    const { body } = await como(RolUsuario.SUPERVISOR).get(DIA).expect(200);
    const rol = body as {
      estado: string;
      autorizadoEn: string | null;
      unidades: {
        vehiculo: { numeroEconomico: string; tipo: string; capacidad: number };
        cita: string;
        finJornada: string;
        asignaciones: {
          vacio: { minutos: number } | null;
          servicio: { zonaOrigenId: number; zonaDestinoId: number };
        }[];
      }[];
      noCubiertos: { motivo: string; servicio: { folio: string } }[];
    };
    expect(rol).toMatchObject({ estado: 'PROPUESTO', autorizadoEn: null });
    // BL-04 no tiene hora de cita: no participa y no tiene servicios.
    expect(rol.unidades.map((u) => u.vehiculo.numeroEconomico)).toEqual([
      'BL-01',
      'BL-02',
      'BL-03',
    ]);
    expect(rol.unidades[0]).toMatchObject({
      vehiculo: { tipo: 'Van', capacidad: 14 },
      cita: '2026-11-10T09:00:00.000Z',
      finJornada: '2026-11-10T18:30:00.000Z',
    });
    // Vacío previo: del encierro (Centro) al primer origen y, después, del
    // destino anterior al siguiente origen (10 min en la misma zona, 30 si no).
    for (const u of rol.unidades) {
      let desde = zona['Centro Cancún'];
      for (const a of u.asignaciones) {
        expect(a.vacio?.minutos).toBe(
          desde === a.servicio.zonaOrigenId ? 10 : 30,
        );
        desde = a.servicio.zonaDestinoId;
      }
    }
    expect(rol.noCubiertos.map((n) => [n.servicio.folio, n.motivo])).toEqual([
      ['S-4', 'CAPACIDAD'],
      ['S-5', 'JORNADA'],
    ]);
    expect(await violaciones()).toEqual([]);
  });

  it('opciones: marca la actual, da motivo a las inválidas y DISPONIBILIDAD a BL-04 (SUPERVISOR puede consultar)', async () => {
    const actual = await asignacionDe('S-3');
    const { body } = await como(RolUsuario.SUPERVISOR)
      .get(`${DIA}/servicios/${servicio['S-3']}/opciones`)
      .expect(200);
    const lista = body as Opcion[];
    expect(lista.filter((o) => o.actual).map((o) => o.vehiculoId)).toEqual([
      actual.vehiculoId,
    ]);
    expect(lista.find((o) => o.numeroEconomico === 'BL-04')).toMatchObject({
      valido: false,
      motivo: 'DISPONIBILIDAD',
    });
    // Primero las válidas.
    const primeraInvalida = lista.findIndex((o) => !o.valido);
    expect(lista.slice(primeraInvalida).every((o) => !o.valido)).toBe(true);
  });

  it('PATCH mueve un servicio a una unidad válida: 200, orden 1..n, bitácora y 0 violaciones', async () => {
    const antes = await asignacionDe('S-3');
    const destino = (await opciones('S-3')).find((o) => o.valido)!;
    const { body } = await coord
      .patch(`${DIA}/asignaciones/${antes.id}`, {
        vehiculoId: destino.vehiculoId,
      })
      .expect(200);

    expect(body).toMatchObject({
      de: antes.vehiculo.numeroEconomico,
      a: destino.numeroEconomico,
      asignacion: { orden: destino.posicion },
    });
    const despues = await asignacionDe('S-3');
    expect(despues.vehiculoId).toBe(destino.vehiculoId);
    expect(despues.orden).toBe(destino.posicion);
    const registro = await prisma.bitacora.findFirstOrThrow({
      where: { entidad: 'asignacion', entidadId: antes.id },
    });
    expect(registro.accion).toBe(
      `ACTUALIZAR: ${DIA}: S-3 de ${antes.vehiculo.numeroEconomico} a ${destino.numeroEconomico}`,
    );
    expect(await violaciones()).toEqual([]);
  });

  it('PATCH 400: empalme con motivo y detalle, misma unidad, y no cambia nada', async () => {
    const s1 = await asignacionDe('S-1');
    const s2 = await asignacionDe('S-2');
    const respuesta = await coord
      .patch(`${DIA}/asignaciones/${s2.id}`, { vehiculoId: s1.vehiculoId })
      .expect(400);
    expect(respuesta.body).toMatchObject({
      motivo: 'EMPALME',
      detalle: `Empalma con el servicio S-1 de 05:00 en ${s1.vehiculo.numeroEconomico}`,
    });
    const misma = await coord
      .patch(`${DIA}/asignaciones/${s2.id}`, { vehiculoId: s2.vehiculoId })
      .expect(400);
    expect(misma.body).toMatchObject({
      message: `El servicio S-2 ya está en ${s2.vehiculo.numeroEconomico}`,
    });
    expect((await asignacionDe('S-2')).vehiculoId).toBe(s2.vehiculoId);
  });

  it('PATCH 400/404: vehiculoId inválido, asignación o vehículo inexistentes', async () => {
    const s2 = await asignacionDe('S-2');
    await coord
      .patch(`${DIA}/asignaciones/${s2.id}`, { vehiculoId: 'BL-01' })
      .expect(400);
    await coord
      .patch(`${DIA}/asignaciones/999999`, { vehiculoId: vehiculo['BL-01'] })
      .expect(404);
    await coord
      .patch(`${DIA}/asignaciones/${s2.id}`, { vehiculoId: 999999 })
      .expect(404);
  });

  it('asignar un no cubierto: 400 CAPACIDAD, JORNADA y DISPONIBILIDAD; 200 cuando la unidad ya tiene cita', async () => {
    const asignar = (folio: string, numero: string) =>
      coord.post(`${DIA}/no-cubiertos/${servicio[folio]}/asignar`, {
        vehiculoId: vehiculo[numero],
      });
    expect((await asignar('S-4', 'BL-01').expect(400)).body).toMatchObject({
      motivo: 'CAPACIDAD',
      detalle: 'S-4 lleva 30 pasajeros y BL-01 tiene capacidad para 14',
    });
    expect((await asignar('S-5', 'BL-01').expect(400)).body).toMatchObject({
      motivo: 'JORNADA',
    });
    expect((await asignar('S-5', 'BL-04').expect(400)).body).toMatchObject({
      motivo: 'DISPONIBILIDAD',
    });

    // Coordinación le registra al operador de BL-04 la cita de las 12:00.
    await prisma.operador.update({
      where: { vehiculoId: vehiculo['BL-04'] },
      data: { horaCita: '12:00' },
    });
    const { body } = await asignar('S-5', 'BL-04').expect(200);
    expect(body).toMatchObject({
      a: 'BL-04',
      asignacion: { vehiculoId: vehiculo['BL-04'], orden: 1 },
    });
    expect(
      await prisma.servicioNoCubierto.findMany({
        select: { servicioId: true },
      }),
    ).toEqual([{ servicioId: servicio['S-4'] }]);
    const registro = await prisma.bitacora.findFirstOrThrow({
      where: { entidad: 'asignacion', accion: { startsWith: 'CREAR' } },
    });
    expect(registro.accion).toBe(
      `CREAR: ${DIA}: S-5 (no cubierto por JORNADA) a BL-04`,
    );
    expect(await violaciones()).toEqual([]);

    // Ya no es un no cubierto.
    await asignar('S-5', 'BL-04').expect(404);
  });

  it('concurrencia: dos movimientos simultáneos que juntos se empalman → uno 200 y otro 400 EMPALME', async () => {
    // BL-05 llega vacía; S-1 y S-2 caben solos en ella, pero no juntos.
    await crearUnidad(5, '04:00');
    const s1 = await asignacionDe('S-1');
    const s2 = await asignacionDe('S-2');
    const destino = { vehiculoId: vehiculo['BL-05'] };
    const respuestas = await Promise.all([
      coord.patch(`${DIA}/asignaciones/${s1.id}`, destino),
      coord.patch(`${DIA}/asignaciones/${s2.id}`, destino),
    ]);
    expect(respuestas.map((r) => r.status).sort((x, y) => x - y)).toEqual([
      200, 400,
    ]);
    expect(
      (respuestas.find((r) => r.status === 400)!.body as { motivo: string })
        .motivo,
    ).toBe('EMPALME');
    expect(
      await prisma.asignacion.count({
        where: { vehiculoId: vehiculo['BL-05'] },
      }),
    ).toBe(1);
    expect(await violaciones()).toEqual([]);
  });

  it('403: SUPERVISOR no mueve, asigna ni autoriza; OPERADOR no consulta opciones. 401 sin token', async () => {
    const sup = como(RolUsuario.SUPERVISOR);
    const s2 = await asignacionDe('S-2');
    const body = { vehiculoId: vehiculo['BL-01'] };
    await sup.patch(`${DIA}/asignaciones/${s2.id}`, body).expect(403);
    await sup
      .post(`${DIA}/no-cubiertos/${servicio['S-4']}/asignar`, body)
      .expect(403);
    await sup.post(`${DIA}/autorizar`).expect(403);
    await como(RolUsuario.OPERADOR)
      .get(`${DIA}/servicios/${servicio['S-2']}/opciones`)
      .expect(403);
    await como(null).post(`${DIA}/autorizar`).expect(401);
  });

  it('autorizar: 200, rol AUTORIZADO con usuario y fecha, asignados PROGRAMADO y bitácora', async () => {
    await coord.post('2026-12-25/autorizar').expect(404);
    const { body } = await coord.post(`${DIA}/autorizar`).expect(200);
    expect(body).toMatchObject({
      rol: { estado: 'AUTORIZADO', fecha: DIA },
      programados: 4,
      noCubiertos: 1,
    });
    const coordinador = await prisma.usuario.findFirstOrThrow({
      where: { rol: 'COORDINADOR' },
    });
    const rol = await prisma.rolDiario.findFirstOrThrow();
    expect(rol.autorizadoPor).toBe(coordinador.id);
    expect(rol.autorizadoEn).toBeInstanceOf(Date);
    expect(
      await prisma.servicio.count({ where: { estado: 'PROGRAMADO' } }),
    ).toBe(4);
    expect(
      (
        await prisma.servicio.findUniqueOrThrow({
          where: { id: servicio['S-4'] },
        })
      ).estado,
    ).toBe('PENDIENTE');
    const registro = await prisma.bitacora.findFirstOrThrow({
      where: { accion: { startsWith: 'AUTORIZAR' } },
    });
    expect(registro).toMatchObject({
      entidad: 'rol_diario',
      entidadId: rol.id,
      accion: `AUTORIZAR: ${DIA}: 4 servicios PROGRAMADO, 1 no cubiertos`,
    });
  });

  it('409 con el rol AUTORIZADO: mover, asignar, autorizar y generar; la consulta sigue funcionando', async () => {
    const s2 = await asignacionDe('S-2');
    const body = { vehiculoId: vehiculo['BL-01'] };
    const mensaje = `El rol del ${DIA} ya está AUTORIZADO; no se puede modificar`;
    expect(
      (await coord.patch(`${DIA}/asignaciones/${s2.id}`, body).expect(409))
        .body,
    ).toMatchObject({ message: mensaje });
    await coord
      .post(`${DIA}/no-cubiertos/${servicio['S-4']}/asignar`, body)
      .expect(409);
    await coord.post(`${DIA}/autorizar`).expect(409);
    await coord.post('generar', { fecha: DIA }).expect(409);
    const { body: rol } = await coord.get(DIA).expect(200);
    expect(rol).toMatchObject({
      estado: 'AUTORIZADO',
      autorizador: { nombre: expect.any(String) },
    });
  });
});
