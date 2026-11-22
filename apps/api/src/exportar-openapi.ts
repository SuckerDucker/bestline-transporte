// Exporta el documento OpenAPI a docs/api/openapi.json sin levantar el servidor
// ni conectarse a la base (modo preview de NestJS). Uso: npm run openapi
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { crearDocumentoOpenApi } from './configurar-app.js';

const destino = resolve(process.cwd(), '../../docs/api/openapi.json');
const app = await NestFactory.create(AppModule, {
  preview: true,
  logger: false,
});
app.setGlobalPrefix('api');
const documento = crearDocumentoOpenApi(app);
mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, `${JSON.stringify(documento, null, 2)}\n`);
console.log(`OpenAPI exportado: ${Object.keys(documento.paths).length} rutas`);
await app.close();
