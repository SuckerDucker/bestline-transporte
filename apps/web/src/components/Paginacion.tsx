interface Props {
  pagina: number
  limite: number
  total: number
  alCambiar: (pagina: number) => void
}

/** Controles de "anterior / siguiente" con el total de registros. */
export function Paginacion({ pagina, limite, total, alCambiar }: Props) {
  const paginas = Math.max(1, Math.ceil(total / limite))
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
      <span>
        {total} registro{total === 1 ? '' : 's'} · Página {pagina} de {paginas}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => alCambiar(pagina - 1)}
          disabled={pagina <= 1}
          className="boton-secundario"
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={() => alCambiar(pagina + 1)}
          disabled={pagina >= paginas}
          className="boton-secundario"
        >
          Siguiente
        </button>
      </div>
    </div>
  )
}
