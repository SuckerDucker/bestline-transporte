// Se ejecuta antes de cada archivo de pruebas e2e (setupFiles de Jest).
// Apunta la API a la base de pruebas para no tocar los datos de desarrollo.
import 'dotenv/config';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error('Falta DATABASE_URL_TEST en apps/api/.env (ver .env.example)');
}
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

// Ninguna prueba e2e debe consultar el OSRM real: se apunta a un puerto local
// cerrado y la suite de rutas reemplaza fetch por uno simulado.
process.env.OSRM_URL = 'http://127.0.0.1:9';
