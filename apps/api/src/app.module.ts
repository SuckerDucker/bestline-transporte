import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { HotelesModule } from './hoteles/hoteles.module.js';
import { OperadoresModule } from './operadores/operadores.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ResumenModule } from './resumen/resumen.module.js';
import { VehiculosModule } from './vehiculos/vehiculos.module.js';
import { ZonasModule } from './zonas/zonas.module.js';

@Module({
  imports: [
    // Carga las variables de apps/api/.env en process.env para toda la aplicación.
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    HealthModule,
    // Catálogos operativos
    VehiculosModule,
    OperadoresModule,
    ZonasModule,
    HotelesModule,
    // Pantalla de inicio (solo lectura)
    ResumenModule,
  ],
})
export class AppModule {}
