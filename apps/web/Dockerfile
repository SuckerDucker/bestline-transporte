# Frontend de producción: Vite compila los archivos y Nginx los sirve.
FROM node:24-bookworm-slim AS compilacion
WORKDIR /app
COPY package.json package-lock.json ./
# Si la red se corta, se repite hasta 5 veces aprovechando la caché de npm.
RUN --mount=type=cache,id=npm-web,target=/root/.npm,sharing=locked \
  sh -c 'for intento in 1 2 3 4 5; do npm ci --no-audit --no-fund --maxsockets=4 --fetch-retries=5 --fetch-retry-maxtimeout=120000 && exit 0; echo "npm ci falló (intento $intento), se reintenta"; sleep 10; done; exit 1'
COPY . .
# Ruta relativa: funciona igual desde localhost que desde la IP de la laptop.
ENV VITE_API_URL=/api
RUN npm run build

FROM nginx:1.28-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-seguridad.conf /etc/nginx/seguridad.conf
COPY --from=compilacion /app/dist /usr/share/nginx/html
EXPOSE 80
