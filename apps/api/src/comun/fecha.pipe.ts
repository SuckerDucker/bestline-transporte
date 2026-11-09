import { BadRequestException, type PipeTransform } from '@nestjs/common';

/** Valida un parámetro de ruta con formato AAAA-MM-DD y que sea una fecha real. */
export class ParseFechaPipe implements PipeTransform<string, string> {
  transform(valor: string): string {
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
    const fecha = partes
      ? new Date(Date.UTC(+partes[1], +partes[2] - 1, +partes[3]))
      : null;
    if (!fecha || fecha.toISOString().slice(0, 10) !== valor) {
      throw new BadRequestException('fecha debe tener el formato AAAA-MM-DD');
    }
    return valor;
  }
}
