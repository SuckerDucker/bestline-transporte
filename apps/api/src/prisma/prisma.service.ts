import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Cliente de Prisma compartido por toda la API.
 *
 * La sesión con PostgreSQL se fuerza a UTC: el adaptador envía y lee las fechas
 * como texto en UTC sin zona; si el servidor usara otra zona (America/Cancun en el
 * contenedor) las horas quedarían desfasadas 5 h. La conversión a America/Cancun
 * se hace al mostrar los datos.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        options: '-c timezone=UTC',
      }),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
