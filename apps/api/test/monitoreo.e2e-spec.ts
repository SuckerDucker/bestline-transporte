import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { RolUsuario } from '../src/generated/prisma/client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import {
  crearApp,
  crearUsuario,
  limpiarBase,
  obtenerToken,
} from './utilidades-e2e.js';

const FECHA = '2026-11-10';
const hora = (h: string) => new Date(`${FECHA}T${h}:00-05:00`);

describe('Monitoreo del día (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const token: Partial<Record<RolUsuario, string>> = {};
  /** Servicios: "propio" es del operador con sesión; "ajeno", de otro operador. */
  const servicio: Record<'propio' | 'ajeno' | 'propuesto', number> = {
    propio: 0,
    ajeno: 0,
    propuesto: 0,
  };
  const api = () => request(app.getHttpServer());
  const con = (rol: RolUsuario) => ({ Authorization: `Bearer ${token[rol]}` });

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    await limpiarBase(prisma);
    const usuarios: Partial<Record<RolUsuario, number>> = {};
    for (const rol of Object.values(RolUsuario)) {
      const email = `${rol.toLowerCase()}@prueba.local`;
      usuarios[rol] = (await crearUsuario(prisma, email, rol)).id;
      token[rol] = await obtenerToken(app, email);
    }
    const [cun, zh] = await Promise.all(
      [
        ['Aeropuerto CUN', true],
        ['Zona Hotelera', true],
      ].map(([nombre, termino]) =>
        prisma.zona.create({
          data: {
            nombre: nombre as string,
            latitud: 21,
            longitud: -87,
            esZonaTermino: termino as boolean,
          },
        }),
      ),
    );
    const mayorista = await prisma.mayorista.create({
      data: { nombre: 'Nexus Tours' },
    });
    const operadores = [];
    for (const n of [1, 2]) {
      const v = await prisma.vehiculo.create({
        data: {
          numeroEconomico: `BL-0${n}`,
          tipo: 'Van',
          capacidad: 14,
          estado: 'DISPONIBLE',
          encierroBase: 'Zona Hotelera',
        },
      });
      operadores.push(
        await prisma.operador.create({
          data: {
            nombre: `Operador ${n}`,
            licencia: `LIC-${n}`,
            telefono: '998-000-0000',
            vehiculoId: v.id,
            horaCita: '12:00',
            // El operador 1 es el usuario OPERADOR de la prueba.
            usuarioId: n === 1 ? usuarios.OPERADOR : null,
          },
        }),
      );
    }
    const crearServicio = (
      folio: string,
      h: string,
      estado: 'PROGRAMADO' | 'PENDIENTE',
    ) =>
      prisma.servicio.create({
        data: {
          mayoristaId: mayorista.id,
          folio,
          localizador: `LOC-${folio}`,
          tipo: 'LLEGADA',
          modalidad: 'PRIVADO',
          fechaHora: hora(h),
          pasajeros: 4,
          zonaOrigenId: cun.id,
          zonaDestinoId: zh.id,
          estado,
        },
      });
    const propio = await crearServicio('NEX-1', '13:00', 'PROGRAMADO');
    const ajeno = await crearServicio('NEX-2', '14:00', 'PROGRAMADO');
    const propuesto = await crearServicio('NEX-3', '15:00', 'PENDIENTE');
    Object.assign(servicio, {
      propio: propio.id,
      ajeno: ajeno.id,
      propuesto: propuesto.id,
    });

    const rol = await prisma.rolDiario.create({
      data: {
        fecha: new Date(`${FECHA}T00:00:00Z`),
        estado: 'AUTORIZADO',
        autorizadoPor: usuarios.COORDINADOR,
        autorizadoEn: new Date(),
      },
    });
    for (const [i, s] of [propio, ajeno].entries()) {
      await prisma.asignacion.create({
        data: {
          rolId: rol.id,
          servicioId: s.id,
          vehiculoId: operadores[i].vehiculoId!,
          operadorId: operadores[i].id,
          orden: 1,
          inicioEfectivo: new Date(s.fechaHora.getTime() - 10 * 60_000),
          liberacion: new Date(s.fechaHora.getTime() + 30 * 60_000),
        },
      });
    }
    // Rol del día siguiente PROPUESTO: no se monitorea.
    await prisma.rolDiario.create({
      data: { fecha: new Date('2026-11-11T00:00:00Z'), estado: 'PROPUESTO' },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET tablero: 200 con servicios, unidad, operador y totales por estado', async () => {
    const { body } = await api()
      .get(`/api/monitoreo/${FECHA}`)
      .set(con('SUPERVISOR'))
      .expect(200);
    expect(
      body.servicios.map(
        (s: {
          servicio: { folio: string };
          vehiculo: { numeroEconomico: string };
        }) => [s.servicio.folio, s.vehiculo.numeroEconomico],
      ),
    ).toEqual([
      ['NEX-1', 'BL-01'],
      ['NEX-2', 'BL-02'],
    ]);
    expect(body.totales.porEstado.PROGRAMADO).toBe(2);
    // El 10/11 ya pasó: los dos PROGRAMADO van retrasados.
    expect(body.totales.retrasados).toBe(2);
  });

  it('GET tablero: 404 sin rol o con rol PROPUESTO; 400 con fecha inválida; 403 al OPERADOR; 401 sin token', async () => {
    await api()
      .get('/api/monitoreo/2026-11-12')
      .set(con('COORDINADOR'))
      .expect(404);
    const { body } = await api()
      .get('/api/monitoreo/2026-11-11')
      .set(con('COORDINADOR'))
      .expect(404);
    expect(body.message).toBe('No hay rol autorizado del 2026-11-11');
    await api()
      .get('/api/monitoreo/10-11-2026')
      .set(con('COORDINADOR'))
      .expect(400);
    await api().get(`/api/monitoreo/${FECHA}`).set(con('OPERADOR')).expect(403);
    await api().get(`/api/monitoreo/${FECHA}`).expect(401);
  });

  it('mis-servicios: el OPERADOR ve solo los suyos; los demás roles reciben 403', async () => {
    const { body } = await api()
      .get(`/api/monitoreo/${FECHA}/mis-servicios`)
      .set(con('OPERADOR'))
      .expect(200);
    expect(body.operador.nombre).toBe('Operador 1');
    expect(
      body.servicios.map(
        (s: { servicio: { folio: string } }) => s.servicio.folio,
      ),
    ).toEqual(['NEX-1']);
    await api()
      .get(`/api/monitoreo/${FECHA}/mis-servicios`)
      .set(con('COORDINADOR'))
      .expect(403);
  });

  it('PATCH estado: el OPERADOR hace el flujo completo en su servicio, con horas reales y bitácora', async () => {
    const ruta = `/api/monitoreo/servicios/${servicio.propio}/estado`;
    for (const estado of ['EN_RUTA', 'EN_SERVICIO', 'COMPLETADO']) {
      const { body } = await api()
        .patch(ruta)
        .set(con('OPERADOR'))
        .send({ estado })
        .expect(200);
      expect(body.estado).toBe(estado);
    }
    const guardado = await prisma.servicio.findUniqueOrThrow({
      where: { id: servicio.propio },
    });
    expect(guardado.inicioReal).toBeInstanceOf(Date);
    expect(guardado.terminoReal).toBeInstanceOf(Date);
    const bitacora = await prisma.bitacora.findMany({
      where: { entidad: 'servicio', entidadId: servicio.propio },
      orderBy: { id: 'asc' },
    });
    expect(bitacora.map((b) => b.accion)).toEqual([
      'CAMBIAR_ESTADO: NEX-1: PROGRAMADO → EN_RUTA',
      'CAMBIAR_ESTADO: NEX-1: EN_RUTA → EN_SERVICIO',
      'CAMBIAR_ESTADO: NEX-1: EN_SERVICIO → COMPLETADO',
    ]);
  });

  it('PATCH estado: 400 con transición inválida y con estado fuera de la lista; no cambia nada', async () => {
    const ruta = `/api/monitoreo/servicios/${servicio.propio}/estado`;
    const { body } = await api()
      .patch(ruta)
      .set(con('COORDINADOR'))
      .send({ estado: 'EN_RUTA' })
      .expect(400);
    expect(body.message).toBe('No se puede pasar de COMPLETADO a EN_RUTA');
    await api()
      .patch(ruta)
      .set(con('COORDINADOR'))
      .send({ estado: 'INCIDENCIA' })
      .expect(400);
    const guardado = await prisma.servicio.findUniqueOrThrow({
      where: { id: servicio.propio },
    });
    expect(guardado.estado).toBe('COMPLETADO');
  });

  it('PATCH estado: 403 al OPERADOR en un servicio ajeno y al pedir NO_SHOW; el supervisor sí marca NO_SHOW con nota', async () => {
    const ruta = `/api/monitoreo/servicios/${servicio.ajeno}/estado`;
    const ajeno = await api()
      .patch(ruta)
      .set(con('OPERADOR'))
      .send({ estado: 'EN_RUTA' })
      .expect(403);
    expect(ajeno.body.message).toBe('Solo puedes actualizar tus servicios');
    await api()
      .patch(ruta)
      .set(con('OPERADOR'))
      .send({ estado: 'NO_SHOW' })
      .expect(403);

    await api()
      .patch(ruta)
      .set(con('SUPERVISOR'))
      .send({ estado: 'NO_SHOW', nota: 'Esperó 45 min en CUN' })
      .expect(200);
    const b = await prisma.bitacora.findFirstOrThrow({
      where: { entidad: 'servicio', entidadId: servicio.ajeno },
    });
    expect(b.accion).toBe(
      'CAMBIAR_ESTADO: NEX-2: PROGRAMADO → NO_SHOW · Esperó 45 min en CUN',
    );
  });

  it('PATCH estado: 404 si el servicio no existe; 400 si no está en un rol autorizado', async () => {
    await api()
      .patch('/api/monitoreo/servicios/9999/estado')
      .set(con('COORDINADOR'))
      .send({ estado: 'EN_RUTA' })
      .expect(404);
    const { body } = await api()
      .patch(`/api/monitoreo/servicios/${servicio.propuesto}/estado`)
      .set(con('COORDINADOR'))
      .send({ estado: 'EN_RUTA' })
      .expect(400);
    expect(body.message).toBe(
      'El servicio NEX-3 no está asignado en un rol autorizado',
    );
  });

  it('incidencias: 201 con bitácora, 400 con tipo inválido, 403 al OPERADOR y lista del día con su unidad', async () => {
    const ruta = `/api/monitoreo/servicios/${servicio.ajeno}/incidencias`;
    const { body } = await api()
      .post(ruta)
      .set(con('SUPERVISOR'))
      .send({
        tipo: 'PASAJERO_NO_SE_PRESENTO',
        descripcion: 'No llegó al punto de encuentro',
      })
      .expect(201);
    expect(body).toMatchObject({
      tipo: 'PASAJERO_NO_SE_PRESENTO',
      usuario: { nombre: 'Usuario SUPERVISOR' },
    });
    await api()
      .post(ruta)
      .set(con('SUPERVISOR'))
      .send({ tipo: 'CHOQUE', descripcion: 'x' })
      .expect(400);
    await api()
      .post(ruta)
      .set(con('SUPERVISOR'))
      .send({ tipo: 'OTRO', descripcion: '' })
      .expect(400);
    await api()
      .post(ruta)
      .set(con('OPERADOR'))
      .send({ tipo: 'OTRO', descripcion: 'x' })
      .expect(403);

    const lista = await api()
      .get(`/api/monitoreo/${FECHA}/incidencias`)
      .set(con('COORDINADOR'))
      .expect(200);
    expect(lista.body).toHaveLength(1);
    expect(lista.body[0]).toMatchObject({
      servicio: { folio: 'NEX-2' },
      vehiculo: { numeroEconomico: 'BL-02' },
    });
    const b = await prisma.bitacora.findFirstOrThrow({
      where: { entidad: 'incidencia' },
    });
    expect(b.accion).toBe('CREAR: NEX-2: PASAJERO_NO_SE_PRESENTO');

    // El tablero cuenta la incidencia en su fila.
    const tablero = await api()
      .get(`/api/monitoreo/${FECHA}`)
      .set(con('COORDINADOR'))
      .expect(200);
    expect(tablero.body.servicios[1].incidencias).toBe(1);
  });
});
