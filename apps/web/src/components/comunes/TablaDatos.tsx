import type { ReactNode } from 'react'

export interface Columna<T> {
  encabezado: string
  celda: (fila: T) => ReactNode
  alineacion?: 'izquierda' | 'derecha'
}

interface Props<T> {
  columnas: Columna<T>[]
  filas: T[] | undefined
  clave: (fila: T) => string | number
  cargando: boolean
  error?: string | null
  mensajeVacio: string
}

/** Tabla genérica para los catálogos, con estados de carga, error y vacío. */
export function TablaDatos<T>({ columnas, filas, clave, cargando, error, mensajeVacio }: Props<T>) {
  const mensaje = error ?? (cargando && !filas ? 'Cargando…' : filas?.length === 0 ? mensajeVacio : null)

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columnas.map((c) => (
              <th
                key={c.encabezado}
                scope="col"
                className={`px-4 py-3 font-medium text-slate-600 ${
                  c.alineacion === 'derecha' ? 'text-right' : 'text-left'
                }`}
              >
                {c.encabezado}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {mensaje ? (
            <tr>
              <td
                colSpan={columnas.length}
                className={`px-4 py-8 text-center ${error ? 'text-red-600' : 'text-slate-500'}`}
              >
                {mensaje}
              </td>
            </tr>
          ) : (
            filas?.map((fila) => (
              <tr key={clave(fila)} className="hover:bg-slate-50">
                {columnas.map((c) => (
                  <td
                    key={c.encabezado}
                    className={`px-4 py-3 text-slate-700 ${c.alineacion === 'derecha' ? 'text-right' : ''}`}
                  >
                    {c.celda(fila)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
