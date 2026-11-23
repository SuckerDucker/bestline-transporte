import { INestApplication, ValidationPipe } from '@nestjs/common';
import {
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';

/**
 * Configuración común de la aplicación. Se usa en main.ts y en las pruebas e2e
 * para que ambas levanten la API exactamente igual.
 */
export function configurarApp(app: INestApplication): void {
  // Todas las rutas quedan bajo /api (por ejemplo, /api/health).
  app.setGlobalPrefix('api');

  // Validación global de los DTO:
  // - whitelist: elimina propiedades que no estén declaradas en el DTO.
  // - forbidNonWhitelisted: en lugar de solo eliminarlas, responde 400.
  // - transform: convierte el cuerpo y los parámetros a los tipos del DTO.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Solo el frontend de desarrollo (Vite) puede llamar a la API desde el navegador.
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    // El navegador solo deja leer este encabezado si se expone: trae el
    // nombre del archivo exportado (rol en CSV o PDF).
    exposedHeaders: ['Content-Disposition'],
  });

  // Documentación OpenAPI en /api/docs. En producción se apaga por defecto
  // (SWAGGER_HABILITADO=false) y se enciende solo para consultarla.
  if (swaggerHabilitado()) {
    SwaggerModule.setup('api/docs', app, crearDocumentoOpenApi(app), {
      // Conserva el token al recargar la página de Swagger.
      swaggerOptions: { persistAuthorization: true },
    });
  }
}

/** Swagger queda encendido salvo que la variable diga exactamente "false". */
export function swaggerHabilitado(): boolean {
  return process.env.SWAGGER_HABILITADO !== 'false';
}

/** Documento OpenAPI de la API (también lo usa el exportador a docs/api). */
export function crearDocumentoOpenApi(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Best Line · API de Operaciones')
    .setDescription(
      'API para la asignación asistida y el monitoreo de servicios de transporte turístico.',
    )
    .setVersion('0.2.0')
    // Botón Authorize: se pega el accessToken de POST /api/auth/login.
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    // Orden en que se muestran las secciones.
    .addTag('auth', 'Inicio de sesión y usuario actual')
    .addTag('catálogos', 'Vehículos, operadores, zonas, hoteles y mayoristas')
    .addTag('parámetros', 'Parámetros de operación y matriz de tiempos')
    .addTag('servicios', 'Consulta de los servicios importados')
    .addTag('importaciones', 'Carga de archivos CSV y Excel de los mayoristas')
    .addTag('roles', 'Generación, revisión, autorización y exportación del rol')
    .addTag('rutas', 'Rutas sugeridas por unidad con OSRM')
    .addTag('monitoreo', 'Estados de los servicios e incidencias del día')
    .addTag('indicadores', 'Cobertura, ocupación, incidencias y tiempos')
    .addTag('usuarios', 'Administración de cuentas')
    .addTag('bitácora', 'Consulta de las acciones registradas')
    .addTag('resumen', 'Datos de la pantalla de inicio')
    .addTag('salud', 'Comprobación de la API y de la base de datos')
    .build();
  return SwaggerModule.createDocument(app, config);
}
