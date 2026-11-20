-- Fase 13 (monitoreo): estado NO_SHOW, horas reales del servicio y usuario del operador.
-- AlterEnum
ALTER TYPE "EstadoServicio" ADD VALUE 'NO_SHOW';

-- AlterTable
ALTER TABLE "operador" ADD COLUMN     "usuario_id" INTEGER;

-- AlterTable
ALTER TABLE "servicio" ADD COLUMN     "inicio_real" TIMESTAMPTZ(3),
ADD COLUMN     "termino_real" TIMESTAMPTZ(3);

-- CreateIndex
CREATE UNIQUE INDEX "operador_usuario_id_key" ON "operador"("usuario_id");

-- AddForeignKey
ALTER TABLE "operador" ADD CONSTRAINT "operador_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

