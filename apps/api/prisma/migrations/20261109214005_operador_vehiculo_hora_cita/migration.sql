-- AlterTable
ALTER TABLE "operador" ADD COLUMN     "hora_cita" VARCHAR(5),
ADD COLUMN     "vehiculo_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "operador_vehiculo_id_key" ON "operador"("vehiculo_id");

-- AddForeignKey
ALTER TABLE "operador" ADD CONSTRAINT "operador_vehiculo_id_fkey" FOREIGN KEY ("vehiculo_id") REFERENCES "vehiculo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

