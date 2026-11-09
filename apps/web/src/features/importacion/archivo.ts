// Revisión del archivo en el navegador (la API lo vuelve a revisar).

export const TAMANO_MAXIMO = 5 * 1024 * 1024
const EXTENSIONES = ['.xlsx', '.csv']

/** Error del archivo elegido (extensión o tamaño), o null si se puede enviar. */
export function revisarArchivo(archivo: File): string | null {
  const nombre = archivo.name.toLowerCase()
  if (!EXTENSIONES.some((e) => nombre.endsWith(e))) return 'Solo se aceptan archivos .xlsx o .csv'
  if (archivo.size > TAMANO_MAXIMO) return 'El archivo supera el máximo de 5 MB'
  return null
}
