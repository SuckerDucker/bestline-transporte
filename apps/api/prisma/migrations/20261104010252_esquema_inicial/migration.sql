-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMINISTRADOR', 'COORDINADOR', 'SUPERVISOR', 'OPERADOR');

-- CreateEnum
CREATE TYPE "TipoServicio" AS ENUM ('LLEGADA', 'SALIDA', 'TRASLADO');

-- CreateEnum
CREATE TYPE "ModalidadServicio" AS ENUM ('PRIVADO', 'COMPARTIDO', 'GRUPO');

-- CreateEnum
CREATE TYPE "EstadoServicio" AS ENUM ('PENDIENTE', 'PROGRAMADO', 'EN_RUTA', 'EN_SERVICIO', 'COMPLETADO', 'CANCELADO', 'INCIDENCIA');

-- CreateEnum
CREATE TYPE "EstadoRol" AS ENUM ('PROPUESTO', 'AUTORIZADO');

-- CreateEnum
CREATE TYPE "MotivoRechazo" AS ENUM ('CAPACIDAD', 'EMPALME', 'JORNADA', 'ZONA_TERMINO', 'SIN_UNIDAD');

-- CreateEnum
CREATE TYPE "EstadoVehiculo" AS ENUM ('DISPONIBLE', 'MANTENIMIENTO', 'BAJA');

-- CreateTable
CREATE TABLE "usuario" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bitacora" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "accion" VARCHAR(50) NOT NULL,
    "entidad" VARCHAR(50) NOT NULL,
    "entidad_id" INTEGER NOT NULL,
    "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bitacora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametro_operacion" (
    "id" SERIAL NOT NULL,
    "clave" VARCHAR(100) NOT NULL,
    "valor" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255) NOT NULL,

    CONSTRAINT "parametro_operacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mayorista" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,

    CONSTRAINT "mayorista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importacion" (
    "id" SERIAL NOT NULL,
    "mayorista_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "archivo" VARCHAR(255) NOT NULL,
    "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filas_validas" INTEGER NOT NULL,
    "filas_rechazadas" INTEGER NOT NULL,

    CONSTRAINT "importacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zona" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "latitud" DECIMAL(9,6) NOT NULL,
    "longitud" DECIMAL(9,6) NOT NULL,
    "es_zona_termino" BOOLEAN NOT NULL,

    CONSTRAINT "zona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "zona_id" INTEGER NOT NULL,
    "latitud" DECIMAL(9,6) NOT NULL,
    "longitud" DECIMAL(9,6) NOT NULL,

    CONSTRAINT "hotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiempo_traslado" (
    "id" SERIAL NOT NULL,
    "zona_origen_id" INTEGER NOT NULL,
    "zona_destino_id" INTEGER NOT NULL,
    "minutos" INTEGER NOT NULL,

    CONSTRAINT "tiempo_traslado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehiculo" (
    "id" SERIAL NOT NULL,
    "numero_economico" VARCHAR(20) NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "capacidad" INTEGER NOT NULL,
    "estado" "EstadoVehiculo" NOT NULL,
    "encierro_base" VARCHAR(100) NOT NULL,

    CONSTRAINT "vehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operador" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "licencia" VARCHAR(30) NOT NULL,
    "telefono" VARCHAR(20) NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "operador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicio" (
    "id" SERIAL NOT NULL,
    "mayorista_id" INTEGER NOT NULL,
    "importacion_id" INTEGER,
    "folio" VARCHAR(30) NOT NULL,
    "localizador" VARCHAR(30) NOT NULL,
    "tipo" "TipoServicio" NOT NULL,
    "modalidad" "ModalidadServicio" NOT NULL,
    "fecha_hora" TIMESTAMPTZ(3) NOT NULL,
    "pasajeros" INTEGER NOT NULL,
    "zona_origen_id" INTEGER NOT NULL,
    "zona_destino_id" INTEGER NOT NULL,
    "hotel_id" INTEGER,
    "vuelo" VARCHAR(15),
    "estado" "EstadoServicio" NOT NULL DEFAULT 'PENDIENTE',

    CONSTRAINT "servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol_diario" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "estado" "EstadoRol" NOT NULL,
    "autorizado_por" INTEGER,
    "generado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rol_diario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignacion" (
    "id" SERIAL NOT NULL,
    "rol_id" INTEGER NOT NULL,
    "servicio_id" INTEGER NOT NULL,
    "vehiculo_id" INTEGER NOT NULL,
    "operador_id" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "inicio_efectivo" TIMESTAMPTZ(3) NOT NULL,
    "liberacion" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "asignacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicio_no_cubierto" (
    "id" SERIAL NOT NULL,
    "rol_id" INTEGER NOT NULL,
    "servicio_id" INTEGER NOT NULL,
    "motivo" "MotivoRechazo" NOT NULL,

    CONSTRAINT "servicio_no_cubierto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidencia" (
    "id" SERIAL NOT NULL,
    "servicio_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "parametro_operacion_clave_key" ON "parametro_operacion"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "mayorista_nombre_key" ON "mayorista"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "zona_nombre_key" ON "zona"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "tiempo_traslado_zona_origen_id_zona_destino_id_key" ON "tiempo_traslado"("zona_origen_id", "zona_destino_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehiculo_numero_economico_key" ON "vehiculo"("numero_economico");

-- CreateIndex
CREATE UNIQUE INDEX "servicio_folio_localizador_key" ON "servicio"("folio", "localizador");

-- CreateIndex
CREATE UNIQUE INDEX "rol_diario_fecha_key" ON "rol_diario"("fecha");

-- AddForeignKey
ALTER TABLE "bitacora" ADD CONSTRAINT "bitacora_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacion" ADD CONSTRAINT "importacion_mayorista_id_fkey" FOREIGN KEY ("mayorista_id") REFERENCES "mayorista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacion" ADD CONSTRAINT "importacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel" ADD CONSTRAINT "hotel_zona_id_fkey" FOREIGN KEY ("zona_id") REFERENCES "zona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiempo_traslado" ADD CONSTRAINT "tiempo_traslado_zona_origen_id_fkey" FOREIGN KEY ("zona_origen_id") REFERENCES "zona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiempo_traslado" ADD CONSTRAINT "tiempo_traslado_zona_destino_id_fkey" FOREIGN KEY ("zona_destino_id") REFERENCES "zona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicio" ADD CONSTRAINT "servicio_mayorista_id_fkey" FOREIGN KEY ("mayorista_id") REFERENCES "mayorista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicio" ADD CONSTRAINT "servicio_importacion_id_fkey" FOREIGN KEY ("importacion_id") REFERENCES "importacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicio" ADD CONSTRAINT "servicio_zona_origen_id_fkey" FOREIGN KEY ("zona_origen_id") REFERENCES "zona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicio" ADD CONSTRAINT "servicio_zona_destino_id_fkey" FOREIGN KEY ("zona_destino_id") REFERENCES "zona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicio" ADD CONSTRAINT "servicio_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_diario" ADD CONSTRAINT "rol_diario_autorizado_por_fkey" FOREIGN KEY ("autorizado_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion" ADD CONSTRAINT "asignacion_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol_diario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion" ADD CONSTRAINT "asignacion_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion" ADD CONSTRAINT "asignacion_vehiculo_id_fkey" FOREIGN KEY ("vehiculo_id") REFERENCES "vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion" ADD CONSTRAINT "asignacion_operador_id_fkey" FOREIGN KEY ("operador_id") REFERENCES "operador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicio_no_cubierto" ADD CONSTRAINT "servicio_no_cubierto_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol_diario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicio_no_cubierto" ADD CONSTRAINT "servicio_no_cubierto_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidencia" ADD CONSTRAINT "incidencia_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidencia" ADD CONSTRAINT "incidencia_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
