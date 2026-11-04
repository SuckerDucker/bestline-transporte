import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

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
  });

  // Documentación OpenAPI en /api/docs.
  const config = new DocumentBuilder()
    .setTitle('Best Line · API de Operaciones')
    .setDescription(
      'API para la asignación asistida y el monitoreo de servicios de transporte turístico.',
    )
    .setVersion('0.1.0')
    .build();
  const documento = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, documento);
}
