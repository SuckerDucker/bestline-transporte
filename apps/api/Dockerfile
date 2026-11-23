# API de producción (NestJS + Prisma) en cuatro etapas: la imagen final solo
# lleva lo necesario para correr y se ejecuta con un usuario sin privilegios.
FROM node:24-bookworm-slim AS base
WORKDIR /app
COPY package.json package-lock.json ./

# 1) Todas las dependencias, para compilar.
# Si la red se corta a mitad de una descarga, npm ci falla aunque tenga
# reintentos: por eso se repite hasta 5 veces, aprovechando lo que ya quedó en
# la caché. "locked" hace que las dos instalaciones no descarguen a la vez.
FROM base AS dependencias
RUN --mount=type=cache,id=npm-api,target=/root/.npm,sharing=locked \
  sh -c 'for intento in 1 2 3 4 5; do npm ci --no-audit --no-fund --maxsockets=4 --fetch-retries=5 --fetch-retry-maxtimeout=120000 && exit 0; echo "npm ci falló (intento $intento), se reintenta"; sleep 10; done; exit 1'

# 2) Cliente de Prisma, API y seed de producción.
FROM dependencias AS compilacion
COPY . .
# prisma generate no se conecta: solo necesita que la URL tenga formato válido.
RUN DATABASE_URL="postgresql://compilacion:compilacion@localhost:5432/compilacion" npx prisma generate \
  && npm run build \
  && npm run build:seed

# 3) Solo dependencias de ejecución (incluye la CLI de Prisma para migrate deploy).
FROM base AS produccion-deps
RUN --mount=type=cache,id=npm-api,target=/root/.npm,sharing=locked \
  sh -c 'for intento in 1 2 3 4 5; do npm ci --omit=dev --no-audit --no-fund --maxsockets=4 --fetch-retries=5 --fetch-retry-maxtimeout=120000 && exit 0; echo "npm ci falló (intento $intento), se reintenta"; sleep 10; done; exit 1'

# 4) Imagen final.
FROM node:24-bookworm-slim
# Prisma necesita OpenSSL para aplicar las migraciones.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --chown=node:node package.json prisma.config.ts ./
COPY --chown=node:node --from=produccion-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=compilacion /app/dist ./dist
COPY --chown=node:node --from=compilacion /app/dist-seed ./dist-seed
COPY --chown=node:node prisma/schema.prisma ./prisma/schema.prisma
COPY --chown=node:node prisma/migrations ./prisma/migrations
COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod 755 docker-entrypoint.sh
USER node
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
