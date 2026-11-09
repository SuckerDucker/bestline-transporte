// Etiquetas y formato de los registros de la bitácora.

/** Mismas acciones y entidades que la API (apps/api/src/comun/bitacora.ts). */
export const ACCIONES = [
  { valor: 'INICIO_SESION', etiqueta: 'Inicio de sesión' },
  { valor: 'CREAR', etiqueta: 'Crear' },
  { valor: 'ACTUALIZAR', etiqueta: 'Actualizar' },
  { valor: 'DESACTIVAR', etiqueta: 'Desactivar' },
  { valor: 'REACTIVAR', etiqueta: 'Reactivar' },
  { valor: 'CAMBIAR_PASSWORD', etiqueta: 'Cambiar contraseña' },
  { valor: 'ELIMINAR', etiqueta: 'Eliminar' },
]

export const ENTIDADES = [
  { valor: 'usuario', etiqueta: 'Usuario' },
  { valor: 'vehiculo', etiqueta: 'Vehículo' },
  { valor: 'operador', etiqueta: 'Operador' },
  { valor: 'zona', etiqueta: 'Zona' },
  { valor: 'hotel', etiqueta: 'Hotel' },
  { valor: 'parametro_operacion', etiqueta: 'Parámetro' },
  { valor: 'tiempo_traslado', etiqueta: 'Tiempo de traslado' },
  { valor: 'importacion', etiqueta: 'Importación' },
  { valor: 'rol_diario', etiqueta: 'Rol diario' },
]

/** "ACTUALIZAR: 9.5 → 10" → { accion: "ACTUALIZAR", detalle: "9.5 → 10" }. */
export function separarAccion(texto: string): { accion: string; detalle?: string } {
  const separador = texto.indexOf(': ')
  if (separador < 0) return { accion: texto }
  return { accion: texto.slice(0, separador), detalle: texto.slice(separador + 2) }
}

const FORMATO = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Cancun',
  dateStyle: 'medium',
  timeStyle: 'short',
})

/** Fecha y hora en Cancún, por ejemplo "8 nov 2026, 10:04". */
export const formatoFecha = (iso: string) => FORMATO.format(new Date(iso))
