#!/bin/sh
# Arranque de la API en producción. Si un paso falla, el contenedor se detiene
# y no atiende peticiones con una base a medio preparar.
set -eu

echo "Aplicando migraciones..."
./node_modules/.bin/prisma migrate deploy

echo "Revisando la carga inicial..."
node dist-seed/prisma/seed-produccion.js

echo "Iniciando la API..."
# exec: Node recibe directamente la señal de apagado de Docker.
exec node dist/main.js
