import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toaster } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderizar, usuarioDePrueba } from '@/pruebas/renderizar'
import { BotonesExportar } from './BotonesExportar'

/** fetch simulado que devuelve un archivo (o un error JSON) y guarda la URL pedida. */
function simularDescarga(status = 200) {
  const urls: URL[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: RequestInfo | URL) => {
      urls.push(new URL(String(entrada)))
      if (status !== 200) {
        return new Response(JSON.stringify({ message: 'Solo puedes exportar tu propio rol', statusCode: status }), {
          status,
        })
      }
      const formato = new URL(String(entrada)).searchParams.get('formato')
      return new Response('contenido', {
        headers: { 'Content-Disposition': `attachment; filename="rol-2026-11-10.${formato}"` },
      })
    }),
  )
  return urls
}

describe('BotonesExportar', () => {
  const clics: string[] = []
  beforeEach(() => {
    clics.length = 0
    // jsdom no implementa URL.createObjectURL ni la descarga de un enlace.
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:simulado', revokeObjectURL: () => {} }))
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clics.push(this.download)
    })
  })
  afterEach(() => vi.restoreAllMocks())

  const operadores = [
    { id: 1, etiqueta: 'BL-01 · José Hernández' },
    { id: 2, etiqueta: 'BL-02 · Carlos Martínez' },
  ]

  it('exporta el CSV de todos y luego el PDF de un operador, con el nombre que manda la API', async () => {
    const urls = simularDescarga()
    renderizar(
      <>
        <BotonesExportar fecha="2026-11-10" operadores={operadores} />
        <Toaster />
      </>,
      { usuario: usuarioDePrueba('COORDINADOR') },
    )

    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))
    await waitFor(() => expect(clics).toEqual(['rol-2026-11-10.csv']))
    expect(urls[0].pathname).toBe('/api/roles/2026-11-10/exportar')
    expect(urls[0].searchParams.get('formato')).toBe('csv')
    expect(urls[0].searchParams.has('operadorId')).toBe(false)

    await userEvent.click(screen.getByRole('combobox', { name: 'Operador a exportar' }))
    await userEvent.click(await screen.findByRole('option', { name: 'BL-02 · Carlos Martínez' }))
    await userEvent.click(screen.getByRole('button', { name: 'Exportar PDF' }))
    await waitFor(() => expect(clics).toHaveLength(2))
    expect(urls[1].searchParams.get('formato')).toBe('pdf')
    expect(urls[1].searchParams.get('operadorId')).toBe('2')
    expect(await screen.findByText('rol-2026-11-10.pdf')).toBeInTheDocument()
  })

  it('sin lista de operadores (Mi rol) no muestra el selector y muestra el error de la API', async () => {
    simularDescarga(403)
    renderizar(
      <>
        <BotonesExportar fecha="2026-11-10" />
        <Toaster />
      </>,
      { usuario: usuarioDePrueba('OPERADOR') },
    )
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Exportar PDF' }))
    expect(await screen.findByText('Solo puedes exportar tu propio rol')).toBeInTheDocument()
    expect(clics).toHaveLength(0)
  })
})
