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
const INICIO_DIA = new Date(`${FECHA}T05:00:00Z`);

/**
 * Supertest junta el cuerpo binario (PDF) en un Buffer; sin esto lo trataría
 * como texto.
 */
const binario = (
  res: NodeJS.ReadableStream,
  listo: (error: Error | null, cuerpo: Buffer) => void,
) => {
  const partes: Buffer[] = [];
  res.on('data', (p: Buffer) => partes.push(p));
  res.on('end', () => listo(null, Buffer.concat(partes)));
};

describe('Indicadores y exportación del rol (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const token: Partial<Record<RolUsuario, string>> = {};
  const operador: number[] = [];
  let generadoAlGenerar: Date;
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
    const zona: Record<string, number> = {};
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
    for (const n of [1, 2]) {
      const v = await prisma.vehiculo.create({
        data: {
          numeroEconomico: `BL-0${n}`,
          tipo: 'Van',
          capacidad: 14,
          estado: 'DISPONIBLE',
          encierroBase: 'Centro Cancún',
        },
      });
      operador.push(
        (
          await prisma.operador.create({
            data: {
              nombre: `Operador ${n}`,
              licencia: `LIC-${n}`,
              telefono: '998-000-0000',
              vehiculoId: v.id,
              horaCita: '04:00',
              // El operador 1 es el usuario OPERADOR de la prueba.
              usuarioId: n === 1 ? usuarios.OPERADOR : null,
            },
          })
        ).id,
      );
    }
    const mayorista = await prisma.mayorista.create({
      data: { nombre: 'Nexus Tours' },
    });
    // Cuatro servicios: S-4 (30 pax) no cabe en ninguna van → CAPACIDAD.
    for (const [folio, minuto, pasajeros] of [
      ['S-1', 300, 7],
      ['S-2', 320, 7],
      ['S-3', 420, 14],
      ['S-4', 480, 30],
    ] as const) {
      await prisma.servicio.create({
        data: {
          mayoristaId: mayorista.id,
          folio,
          localizador: 'L',
          tipo: 'LLEGADA',
          modalidad: 'PRIVADO',
          fechaHora: new Date(INICIO_DIA.getTime() + minuto * 60_000),
          pasajeros,
          zonaOrigenId: zona['Aeropuerto CUN'],
          zonaDestinoId: zona['Zona Hotelera'],
        },
      });
    }
    // Rol generado y autorizado por la API real (motor y verificador).
    await api()
      .post('/api/roles/generar')
      .set(con('COORDINADOR'))
      .send({ fecha: FECHA })
      .expect(201);
    generadoAlGenerar = (await prisma.rolDiario.findFirstOrThrow()).generadoEn;
    await api()
      .post(`/api/roles/${FECHA}/autorizar`)
      .set(con('COORDINADOR'))
      .expect(200);
    // Un servicio completado y una incidencia, como en el monitoreo.
    const s1 = await prisma.servicio.findFirstOrThrow({
      where: { folio: 'S-1' },
    });
    await prisma.servicio.update({
      where: { id: s1.id },
      data: { estado: 'COMPLETADO' },
    });
    await prisma.incidencia.create({
      data: {
        servicioId: s1.id,
        usuarioId: usuarios.SUPERVISOR!,
        tipo: 'RETRASO',
        descripcion: 'x',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /indicadores', () => {
    it('200: cobertura, empalmes 0 del verificador, no cubiertos por motivo, completados, incidencias y ocupación', async () => {
      const { body } = await api()
        .get('/api/indicadores')
        .query({ desde: '2026-11-09', hasta: FECHA })
        .set(con('SUPERVISOR'))
        .expect(200);
      expect(body.dias).toHaveLength(2);
      expect(body.dias[0]).toMatchObject({
        fecha: '2026-11-09',
        estadoRol: null,
        servicios: 0,
      });
      const dia = body.dias[1];
      expect(dia).toMatchObject({
        fecha: FECHA,
        estadoRol: 'AUTORIZADO',
        servicios: 4,
        asignados: 3,
        noCubiertos: 1,
        noCubiertosPorMotivo: { CAPACIDAD: 1 },
        cobertura: 75,
        empalmes: 0,
        completados: 1,
        incidencias: 1,
        incidenciasPorTipo: { RETRASO: 1 },
        // (7 + 7 + 14) / 14 / 3
        ocupacion: 0.667,
      });
      expect(body.resumen).toMatchObject({
        diasConRol: 1,
        cobertura: 75,
        empalmes: 0,
      });
    });

    it('tiempo de elaboración: autorizar conserva generado_en y se miden los minutos hasta autorizado_en', async () => {
      const rol = await prisma.rolDiario.findFirstOrThrow();
      expect(rol.generadoEn).toEqual(generadoAlGenerar);
      // Solo en la base de pruebas: un rol generado 25 min antes de autorizarlo.
      await prisma.rolDiario.update({
        where: { id: rol.id },
        data: {
          generadoEn: new Date(rol.autorizadoEn!.getTime() - 25 * 60_000),
        },
      });
      const { body } = await api()
        .get('/api/indicadores')
        .query({ desde: FECHA, hasta: FECHA })
        .set(con('COORDINADOR'))
        .expect(200);
      expect(body.dias[0].tiempoElaboracionMin).toBe(25);
      expect(body.resumen.tiempoElaboracionPromedioMin).toBe(25);
    });

    it('400 con rango inválido; 403 al OPERADOR; 401 sin token', async () => {
      const r = await api()
        .get('/api/indicadores')
        .query({ desde: FECHA, hasta: '2026-11-01' })
        .set(con('COORDINADOR'))
        .expect(400);
      expect(r.body.message).toBe('desde no puede ser posterior a hasta');
      await api()
        .get('/api/indicadores')
        .query({ desde: '10/11/2026', hasta: FECHA })
        .set(con('COORDINADOR'))
        .expect(400);
      await api()
        .get('/api/indicadores')
        .query({ desde: '2026-09-01', hasta: FECHA })
        .set(con('COORDINADOR'))
        .expect(400);
      await api()
        .get('/api/indicadores')
        .query({ desde: FECHA, hasta: FECHA })
        .set(con('OPERADOR'))
        .expect(403);
      await api()
        .get('/api/indicadores')
        .query({ desde: FECHA, hasta: FECHA })
        .expect(401);
    });
  });

  describe('GET /roles/:fecha/exportar', () => {
    it('CSV: content-type text/csv, adjunto con nombre y una fila por servicio asignado', async () => {
      const r = await api()
        .get(`/api/roles/${FECHA}/exportar`)
        .query({ formato: 'csv' })
        .set(con('COORDINADOR'))
        .expect(200);
      expect(r.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(r.headers['content-disposition']).toBe(
        'attachment; filename="rol-2026-11-10.csv"',
      );
      const lineas = r.text.replace(/^﻿/, '').trim().split('\r\n');
      expect(
        lineas[0].startsWith('fecha,unidad,tipo_unidad,operador,cita'),
      ).toBe(true);
      expect(lineas).toHaveLength(4);
    });

    it('PDF: content-type application/pdf y el archivo empieza con %PDF', async () => {
      const r = await api()
        .get(`/api/roles/${FECHA}/exportar`)
        .query({ formato: 'pdf', operadorId: operador[0] })
        .set(con('SUPERVISOR'))
        .buffer(true)
        .parse(binario)
        .expect(200);
      expect(r.headers['content-type']).toBe('application/pdf');
      expect(r.headers['content-disposition']).toBe(
        'attachment; filename="rol-2026-11-10-BL-01.pdf"',
      );
      expect((r.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    });

    it('el OPERADOR exporta el suyo (sin operadorId) y recibe 403 con el de otro', async () => {
      const propio = await api()
        .get(`/api/roles/${FECHA}/exportar`)
        .query({ formato: 'csv' })
        .set(con('OPERADOR'))
        .expect(200);
      expect(propio.headers['content-disposition']).toContain(
        'rol-2026-11-10-BL-01.csv',
      );
      expect(propio.text).not.toContain('Operador 2');

      const ajeno = await api()
        .get(`/api/roles/${FECHA}/exportar`)
        .query({ formato: 'pdf', operadorId: operador[1] })
        .set(con('OPERADOR'))
        .expect(403);
      expect(ajeno.body.message).toBe('Solo puedes exportar tu propio rol');
    });

    it('400 con formato inválido, 404 sin rol y 401 sin token', async () => {
      await api()
        .get(`/api/roles/${FECHA}/exportar`)
        .query({ formato: 'xlsx' })
        .set(con('COORDINADOR'))
        .expect(400);
      await api()
        .get('/api/roles/2026-11-11/exportar')
        .query({ formato: 'csv' })
        .set(con('COORDINADOR'))
        .expect(404);
      await api()
        .get(`/api/roles/${FECHA}/exportar`)
        .query({ formato: 'csv' })
        .expect(401);
    });
  });
});
