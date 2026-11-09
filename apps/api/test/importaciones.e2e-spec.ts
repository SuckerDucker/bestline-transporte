import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

const EJEMPLO = resolve(
  process.cwd(),
  '../../docs/ejemplos/Layout_Servicios_Nexus.xlsx',
);
const EJEMPLO_CSV = EJEMPLO.replace('.xlsx', '.csv');

interface Totales {
  total: number;
  validas: number;
  advertencias: number;
  duplicadas: number;
  errores: number;
  importables: number;
  rechazadas: number;
}

describe('Importación de servicios (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const tokens: Partial<Record<RolUsuario, string>> = {};
  let nexus: number;

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    await limpiarBase(prisma);
    for (const rol of Object.values(RolUsuario)) {
      const email = `${rol.toLowerCase()}@prueba.local`;
      await crearUsuario(prisma, email, rol);
      tokens[rol] = await obtenerToken(app, email);
    }
    // Catálogos mínimos: zonas del seed, hoteles del layout y mayoristas.
    const zonas = [
      'Aeropuerto CUN',
      'Zona Hotelera',
      'Costa Mujeres',
      'Puerto Morelos',
      'Playa del Carmen',
    ];
    const idZona: Record<string, number> = {};
    for (const nombre of zonas) {
      idZona[nombre] = (
        await prisma.zona.create({
          data: {
            nombre,
            latitud: 21,
            longitud: -87,
            esZonaTermino: nombre === 'Aeropuerto CUN',
          },
        })
      ).id;
    }
    const hoteles: [string, string][] = [
      ['Planet Hollywood Cancun', 'Costa Mujeres'],
      ['TRS Coral Hotel', 'Costa Mujeres'],
      ['Grand Velas Riviera Maya', 'Puerto Morelos'],
      ['Hotel Xcaret Arte', 'Playa del Carmen'],
      ['Barceló Maya Palace', 'Playa del Carmen'],
      ['Iberostar Selection Cancun', 'Zona Hotelera'],
      ['Hard Rock Hotel Cancun', 'Zona Hotelera'],
      ['Moon Palace Sunrise', 'Zona Hotelera'],
    ];
    await prisma.hotel.createMany({
      data: hoteles.map(([nombre, zona]) => ({
        nombre,
        zonaId: idZona[zona],
        latitud: 21,
        longitud: -87,
      })),
    });
    await prisma.mayorista.create({ data: { nombre: 'TUI' } });
    nexus = (await prisma.mayorista.create({ data: { nombre: 'Nexus Tours' } }))
      .id;
  });

  afterAll(async () => {
    await app.close();
  });

  const subir = (
    ruta: 'vista-previa' | 'confirmar',
    archivo: string | Buffer,
    nombre?: string,
    rol: RolUsuario | null = RolUsuario.COORDINADOR,
  ) => {
    let peticion = request(app.getHttpServer())
      .post(`/api/importaciones/${ruta}`)
      .field('mayoristaId', String(nexus));
    peticion =
      typeof archivo === 'string'
        ? peticion.attach('archivo', archivo)
        : peticion.attach('archivo', archivo, nombre);
    return rol
      ? peticion.set('Authorization', `Bearer ${tokens[rol]}`)
      : peticion;
  };

  it('200: vista previa del ejemplo (.xlsx y .csv) sin guardar nada', async () => {
    for (const archivo of [EJEMPLO, EJEMPLO_CSV]) {
      const respuesta = await subir('vista-previa', archivo).expect(200);
      expect((respuesta.body as { totales: Totales }).totales).toEqual({
        total: 65,
        validas: 30,
        advertencias: 28,
        duplicadas: 2,
        errores: 5,
        importables: 58,
        rechazadas: 7,
      });
    }
    expect(await prisma.servicio.count()).toBe(0);
    expect(await prisma.importacion.count()).toBe(0);
  });

  it('201: confirmar guarda la importación, 58 servicios PENDIENTE y la bitácora', async () => {
    const respuesta = await subir('confirmar', EJEMPLO).expect(201);
    const { importacion } = respuesta.body as {
      importacion: {
        id: number;
        filasValidas: number;
        filasRechazadas: number;
      };
    };

    expect(importacion).toMatchObject({ filasValidas: 58, filasRechazadas: 7 });
    expect(
      await prisma.servicio.count({ where: { importacionId: importacion.id } }),
    ).toBe(58);
    expect(
      await prisma.servicio.count({ where: { estado: 'PENDIENTE' } }),
    ).toBe(58);
    // 06:15 del 05/11/2026 en Cancún = 11:15 UTC.
    const primero = await prisma.servicio.findFirstOrThrow({
      where: { folio: 'NX-15001' },
      include: { zonaOrigen: true, zonaDestino: true, hotel: true },
    });
    expect(primero).toMatchObject({
      tipo: 'SALIDA',
      modalidad: 'COMPARTIDO',
      fechaHora: new Date('2026-11-05T11:15:00.000Z'),
      zonaOrigen: { nombre: 'Costa Mujeres' },
      zonaDestino: { nombre: 'Aeropuerto CUN' },
      hotel: { nombre: 'Planet Hollywood Cancun' },
    });
    const registro = await prisma.bitacora.findFirst({
      where: { entidad: 'importacion', entidadId: importacion.id },
    });
    expect(registro?.accion).toBe(
      'CREAR: Layout_Servicios_Nexus.xlsx: 58 servicios importados, 7 filas rechazadas',
    );
  });

  it('al volver a subir el mismo archivo, todo sale DUPLICADA y confirmar responde 400', async () => {
    const vista = await subir('vista-previa', EJEMPLO_CSV).expect(200);
    expect((vista.body as { totales: Totales }).totales).toMatchObject({
      importables: 0,
      duplicadas: 60,
      errores: 5,
    });

    const respuesta = await subir('confirmar', EJEMPLO_CSV).expect(400);
    expect(respuesta.body).toMatchObject({
      message: 'El archivo no tiene filas válidas para importar',
    });
    expect(await prisma.servicio.count()).toBe(58);
  });

  it('200: historial y detalle con sus servicios (SUPERVISOR)', async () => {
    const historial = await request(app.getHttpServer())
      .get('/api/importaciones')
      .set('Authorization', `Bearer ${tokens.SUPERVISOR}`)
      .expect(200);
    const [importacion] = (historial.body as { datos: { id: number }[] }).datos;
    expect(historial.body).toMatchObject({
      total: 1,
      datos: [
        {
          mayorista: { nombre: 'Nexus Tours' },
          usuario: { nombre: 'Usuario COORDINADOR' },
        },
      ],
    });

    const detalle = await request(app.getHttpServer())
      .get(`/api/importaciones/${importacion.id}`)
      .set('Authorization', `Bearer ${tokens.SUPERVISOR}`)
      .expect(200);
    const servicios = (detalle.body as { servicios: { fechaHora: string }[] })
      .servicios;
    expect(servicios).toHaveLength(58);
    const horas = servicios.map((s) => s.fechaHora);
    expect(horas).toEqual([...horas].sort());
  });

  it('400: encabezado faltante, con la lista de faltantes', async () => {
    const sinHora = Buffer.from(
      'Folio,Localizador,Agencia,Fecha,Tipo de Servicio,Pasajeros,Hotel,Zona,Vuelo\n',
    );
    const respuesta = await subir(
      'vista-previa',
      sinHora,
      'sin_hora.csv',
    ).expect(400);
    expect(respuesta.body).toMatchObject({
      message: 'Faltan encabezados: Hora',
      faltantes: ['Hora'],
    });
  });

  it('400: tipo de archivo no permitido y falta de archivo', async () => {
    await subir('vista-previa', Buffer.from('x'), 'servicios.pdf').expect(400);
    await request(app.getHttpServer())
      .post('/api/importaciones/vista-previa')
      .set('Authorization', `Bearer ${tokens.COORDINADOR}`)
      .field('mayoristaId', String(nexus))
      .expect(400);
  });

  it('conserva los acentos del nombre del archivo', async () => {
    const fila =
      'NX-90001,LOC-1,Nexus Tours,06/11/2026,LLEGADA PRIVADO,3,TRS Coral Hotel,Costa Mujeres,AM1,09:00';
    const contenido = Buffer.from(
      `Folio,Localizador,Agencia,Fecha,Tipo de Servicio,Pasajeros,Hotel,Zona,Vuelo,Hora\n${fila}`,
    );
    const respuesta = await subir(
      'vista-previa',
      contenido,
      'Servicios_Cancún.csv',
    ).expect(200);
    expect(respuesta.body).toMatchObject({ archivo: 'Servicios_Cancún.csv' });
  });

  // Los guards responden antes de leer el archivo; si se adjuntara, el
  // servidor cerraría la conexión a mitad de la subida (ECONNRESET). Por eso
  // estas pruebas envían solo el campo del mayorista.
  const sinArchivo = (rol: RolUsuario | null) => {
    const peticion = request(app.getHttpServer())
      .post('/api/importaciones/vista-previa')
      .field('mayoristaId', String(nexus));
    return rol
      ? peticion.set('Authorization', `Bearer ${tokens[rol]}`)
      : peticion;
  };

  it('403: el SUPERVISOR no importa y el OPERADOR no consulta', async () => {
    await sinArchivo(RolUsuario.SUPERVISOR).expect(403);
    await request(app.getHttpServer())
      .get('/api/importaciones')
      .set('Authorization', `Bearer ${tokens.OPERADOR}`)
      .expect(403);
  });

  it('401: sin token', () => {
    return sinArchivo(null).expect(401);
  });
});
