import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { type Peticion, simularApi } from '@/pruebas/api-simulada'
import { renderizar, usuarioDePrueba } from '@/pruebas/renderizar'
import { ImportarPage } from './ImportarPage'

const MAYORISTAS = [
  { id: 2, nombre: 'Nexus Tours' },
  { id: 1, nombre: 'TUI' },
]
const TOTALES = { total: 3, validas: 1, advertencias: 1, duplicadas: 0, errores: 1, importables: 2, rechazadas: 1 }
const VISTA = {
  archivo: 'layout.csv',
  mayorista: MAYORISTAS[0],
  totales: TOTALES,
  avisos: [],
  filas: [{ fila: 2, estado: 'ERROR', mensajes: ['Zona no indicada'], valores: { Folio: 'NX-1' }, servicio: null }],
}
const archivoCsv = (nombre = 'layout.csv') => new File(['Folio,Localizador\n'], nombre, { type: 'text/csv' })

function renderizarPagina(responder: (p: Peticion) => { status?: number; cuerpo: unknown }) {
  const api = simularApi((p) => (p.ruta === '/mayoristas' ? { cuerpo: MAYORISTAS } : responder(p)))
  renderizar(
    <Routes>
      <Route path="/importar" element={<ImportarPage />} />
      <Route path="/importaciones/:id" element={<p>Detalle de la importación</p>} />
    </Routes>,
    { usuario: usuarioDePrueba('COORDINADOR'), ruta: '/importar' },
  )
  return api
}

async function elegirMayoristaYArchivo(archivo = archivoCsv()) {
  await userEvent.click(screen.getByRole('combobox', { name: 'Mayorista' }))
  await userEvent.click(await screen.findByRole('option', { name: 'Nexus Tours' }))
  await userEvent.upload(screen.getByTestId('entrada-archivo'), archivo)
}

describe('Pantalla Importar servicios', () => {
  it('rechaza en el navegador un archivo que no es .xlsx ni .csv', async () => {
    const { peticiones } = renderizarPagina(() => ({ cuerpo: VISTA }))
    // applyAccept: false permite "elegir" un .pdf aunque el input pida .xlsx o .csv.
    const usuario = userEvent.setup({ applyAccept: false })
    await usuario.click(screen.getByRole('combobox', { name: 'Mayorista' }))
    await usuario.click(await screen.findByRole('option', { name: 'Nexus Tours' }))
    await usuario.upload(screen.getByTestId('entrada-archivo'), archivoCsv('servicios.pdf'))

    expect(screen.getByRole('alert')).toHaveTextContent('Solo se aceptan archivos .xlsx o .csv')
    expect(screen.getByRole('button', { name: 'Generar vista previa' })).toBeDisabled()
    expect(peticiones.filter((p) => p.ruta.startsWith('/importaciones'))).toHaveLength(0)
  })

  it('muestra los encabezados faltantes que devuelve la API', async () => {
    renderizarPagina(() => ({
      status: 400,
      cuerpo: { message: 'Faltan encabezados: Zona, Hora', faltantes: ['Zona', 'Hora'], statusCode: 400 },
    }))
    await elegirMayoristaYArchivo()
    await userEvent.click(screen.getByRole('button', { name: 'Generar vista previa' }))

    expect(await screen.findByText('Al archivo le faltan encabezados')).toBeInTheDocument()
    expect(screen.getByText(/Faltan: Zona, Hora/)).toBeInTheDocument()
  })

  it('genera la vista previa y al confirmar envía el mismo archivo y abre el detalle', async () => {
    const { peticiones } = renderizarPagina((p) =>
      p.ruta === '/importaciones/confirmar'
        ? { status: 201, cuerpo: { importacion: { id: 7 }, totales: TOTALES } }
        : { cuerpo: VISTA },
    )
    await elegirMayoristaYArchivo()
    await userEvent.click(screen.getByRole('button', { name: 'Generar vista previa' }))

    expect(await screen.findByText(/Nada se ha guardado todavía/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importación' }))
    expect(await screen.findByText(/Se guardarán 2 servicios en estado PENDIENTE/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importación' }))

    expect(await screen.findByText('Detalle de la importación')).toBeInTheDocument()
    const envios = peticiones.filter((p) => p.ruta.startsWith('/importaciones'))
    expect(envios.map((p) => p.ruta)).toEqual(['/importaciones/vista-previa', '/importaciones/confirmar'])
    for (const envio of envios) {
      const formulario = envio.cuerpo as FormData
      expect(formulario.get('mayoristaId')).toBe('2')
      expect((formulario.get('archivo') as File).name).toBe('layout.csv')
    }
  })
})
