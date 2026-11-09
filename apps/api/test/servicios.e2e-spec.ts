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

interface Pagina {
  total: number;
  datos: { folio: string; zonaOrigen: { nombre: string } }[];
}

describe('Servicios y mayoristas (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenSupervisor: string;
  let tokenOperador: string;
  let costa: number;

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    await limpiarBase(prisma);
    await crearUsuario(
      prisma,
      'supervisor@prueba.local',
      RolUsuario.SUPERVISOR,
    );
    await crearUsuario(prisma, 'operador@prueba.local', RolUsuario.OPERADOR);
    tokenSupervisor = await obtenerToken(app, 'supervisor@prueba.local');
    tokenOperador = await obtenerToken(app, 'operador@prueba.local');

    const zona = (nombre: string) =>
      prisma.zona.create({
        data: { nombre, latitud: 21, longitud: -87, esZonaTermino: true },
      });
    const cun = (await zona('Aeropuerto CUN')).id;
    costa = (await zona('Costa Mujeres')).id;
    const zh = (await zona('Zona Hotelera')).id;
    const nexus = (
      await prisma.mayorista.create({ data: { nombre: 'Nexus Tours' } })
    ).id;
    const tui = (await prisma.mayorista.create({ data: { nombre: 'TUI' } })).id;

    const base = { pasajeros: 4, hotelId: null, vuelo: null };
    await prisma.servicio.createMany({
      data: [
        // 23:30 del 5 de noviembre en Cancún (04:30 del 6 en UTC): cuenta el día 5.
        {
          ...base,
          folio: 'S-1',
          localizador: 'L',
          mayoristaId: nexus,
          tipo: 'LLEGADA',
          modalidad: 'PRIVADO',
          fechaHora: new Date('2026-11-06T04:30:00Z'),
          zonaOrigenId: cun,
          zonaDestinoId: costa,
        },
        {
          ...base,
          folio: 'S-2',
          localizador: 'L',
          mayoristaId: nexus,
          tipo: 'SALIDA',
          modalidad: 'GRUPO',
          fechaHora: new Date('2026-11-05T12:00:00Z'),
          zonaOrigenId: costa,
          zonaDestinoId: cun,
        },
        {
          ...base,
          folio: 'S-3',
          localizador: 'L',
          mayoristaId: tui,
          tipo: 'TRASLADO',
          modalidad: 'COMPARTIDO',
          fechaHora: new Date('2026-11-05T15:00:00Z'),
          zonaOrigenId: zh,
          zonaDestinoId: zh,
        },
        // 00:30 del 6 de noviembre en Cancún: ya no es del día 5.
        {
          ...base,
          folio: 'S-4',
          localizador: 'L',
          mayoristaId: tui,
          tipo: 'LLEGADA',
          modalidad: 'PRIVADO',
          fechaHora: new Date('2026-11-06T05:30:00Z'),
          zonaOrigenId: cun,
          zonaDestinoId: zh,
        },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const consultar = (query: string, token = tokenSupervisor) =>
    request(app.getHttpServer())
      .get(`/api/servicios${query}`)
      .set('Authorization', `Bearer ${token}`);

  it('200: los servicios de un día de Cancún, ordenados por hora', async () => {
    const pagina = (await consultar('?fecha=2026-11-05').expect(200))
      .body as Pagina;
    expect(pagina.datos.map((s) => s.folio)).toEqual(['S-2', 'S-3', 'S-1']);
  });

  it('200: filtros por zona (origen o destino), tipo, modalidad y estado', async () => {
    const porZona = (await consultar(`?zonaId=${costa}`).expect(200))
      .body as Pagina;
    expect(porZona.datos.map((s) => s.folio)).toEqual(['S-2', 'S-1']);

    const combinados = (
      await consultar(
        '?tipo=LLEGADA&modalidad=PRIVADO&estado=PENDIENTE',
      ).expect(200)
    ).body as Pagina;
    expect(combinados.total).toBe(2);
    expect(combinados.datos[0].zonaOrigen.nombre).toBe('Aeropuerto CUN');
  });

  it('400: filtros inválidos', async () => {
    await consultar('?fecha=05/11/2026').expect(400);
    await consultar('?tipo=TOUR').expect(400);
  });

  it('403: el OPERADOR no consulta servicios', () => {
    return consultar('', tokenOperador).expect(403);
  });

  it('401: sin token', () => {
    return request(app.getHttpServer()).get('/api/servicios').expect(401);
  });

  it('200: lista de mayoristas por nombre (cualquier rol)', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/api/mayoristas')
      .set('Authorization', `Bearer ${tokenOperador}`)
      .expect(200);
    expect(
      (respuesta.body as { nombre: string }[]).map((m) => m.nombre),
    ).toEqual(['Nexus Tours', 'TUI']);
  });
});
