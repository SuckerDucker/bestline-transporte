/** Clases de un input o select según si tiene error. */
export const claseEntrada = (conError: boolean) =>
  `mt-1 block w-full rounded-md border px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 ${
    conError
      ? 'border-red-500 focus:ring-red-200'
      : 'border-slate-300 focus:border-slate-500 focus:ring-slate-200'
  }`
