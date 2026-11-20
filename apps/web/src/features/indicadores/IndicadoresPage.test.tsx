import { fireEvent, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { esperarPeticion, simularApi } from '@/pruebas/api-simulada'
import { renderizar, usuarioDePrueba } from '@/pruebas/renderizar'
import type { Indicadores, IndicadoresDia } from './api'
import { IndicadoresPage } from './IndicadoresPage'

// Recharts necesita medir el contenedor (jsdom no tiene tamaños): se simula
// con elementos que muestran los datos que recibe cada gráfica.
vi.mock('recharts', () => {
  const Contenedor = ({ children }: { children: ReactNode }) => <div>{children}</div>
  const Grafica =
    (tipo: string) =>
    ({ data }: { data: { etiqueta: string; valor: number }[] }) => (
      <ul data-grafica={tipo}>
        {data.map((d) => (
          <li key={d.etiqueta}>{`${d.etiqueta}=${d.valor}`}</li>
        ))}
      </ul>
    )
  const Nada = () => null
  return {
    ResponsiveContainer: Contenedor,
    BarChart: Grafica('barras'),
    LineChart: Grafica('linea'),
    Bar: Nada,
    Line: Nada,
    XAxis: Nada,
    YAxis: Nada,
    CartesianGrid: Nada,
    Tooltip: Nada,
  }
})

const MOTIVOS = { CAPACIDAD: 2, EMPALME: 14, JORNADA: 0, ZONA_TERMINO: 3, SIN_UNIDAD: 0 }
const INCIDENCIAS = { RETRASO: 1, FALLA_MECANICA: 0, PASAJERO_NO_SE_PRESENTO: 1, CAMBIO_DE_HORA: 0, OTRO: 0 }
const dia = (fecha: string, extra: Partial<IndicadoresDia> = {}): IndicadoresDia => ({
  fecha,
  estadoRol: null,
  servicios: 0,
  asignados: 0,
  noCubiertos: 0,
  noCubiertosPorMotivo: { CAPACIDAD: 0, EMPALME: 0, JORNADA: 0, ZONA_TERMINO: 0, SIN_UNIDAD: 0 },
  cobertura: null,
  empalmes: null,
  completados: 0,
  cancelados: 0,
  noShow: 0,
  incidencias: 0,
  incidenciasPorTipo: { RETRASO: 0, FALLA_MECANICA: 0, PASAJERO_NO_SE_PRESENTO: 0, CAMBIO_DE_HORA: 0, OTRO: 0 },
  ocupacion: null,
  unidades: [],
  ...extra,
})
const DATOS: Indicadores = {
  desde: '2026-11-05',
  hasta: '2026-11-10',
  resumen: {
    dias: 6,
    diasConRol: 2,
    servicios: 118,
    asignados: 87,
    noCubiertos: 31,
    noCubiertosPorMotivo: MOTIVOS,
    cobertura: 73.7,
    empalmes: 0,
    completados: 30,
    cancelados: 1,
    noShow: 1,
    incidencias: 2,
    incidenciasPorTipo: INCIDENCIAS,
    ocupacion: 0.299,
    unidades: [
      { vehiculoId: 1, numeroEconomico: 'BL-01', servicios: 7, ocupacion: 0.479, horasJornadaPromedio: 9.38 },
      { vehiculoId: 10, numeroEconomico: 'BL-10', servicios: 9, ocupacion: 0.126, horasJornadaPromedio: 8.3 },
    ],
  },
  dias: [
    dia('2026-11-05', { estadoRol: 'PROPUESTO', servicios: 58, asignados: 46, noCubiertos: 12, cobertura: 79.3, ocupacion: 0.296 }),
    dia('2026-11-06'),
    dia('2026-11-10', {
      estadoRol: 'AUTORIZADO',
      servicios: 60,
      asignados: 41,
      noCubiertos: 19,
      cobertura: 68.3,
      empalmes: 0,
      completados: 30,
      incidencias: 2,
      ocupacion: 0.302,
    }),
  ],
}

const renderizarPagina = (ruta = '/indicadores?desde=2026-11-05&hasta=2026-11-10') =>
  renderizar(
    <Routes>
      <Route path="/indicadores" element={<IndicadoresPage />} />
    </Routes>,
    { usuario: usuarioDePrueba('COORDINADOR'), ruta },
  )

describe('Indicadores', () => {
  it('pide el rango de la URL y muestra las tarjetas KPI', async () => {
    const { peticiones } = simularApi(() => ({ cuerpo: DATOS }))
    renderizarPagina()

    const kpi = await screen.findByLabelText('Indicadores clave')
    expect(peticiones[0].ruta).toBe('/indicadores')
    expect(peticiones[0].query.get('desde')).toBe('2026-11-05')
    expect(peticiones[0].query.get('hasta')).toBe('2026-11-10')
    expect(kpi).toHaveTextContent('Cobertura73.7 %87 de 118 servicios asignados')
    expect(kpi).toHaveTextContent('Empalmes0')
    expect(within(kpi).getByLabelText('Correcto')).toBeInTheDocument()
    expect(kpi).toHaveTextContent('Completados301 cancelados · 1 no show')
    expect(kpi).toHaveTextContent('Incidencias2Ocupación promedio 29.9 %')
  })

  it('pasa a cada gráfica sus datos: cobertura por día con rol, motivos, ocupación por unidad e incidencias por tipo', async () => {
    simularApi(() => ({ cuerpo: DATOS }))
    renderizarPagina()

    const linea = await screen.findByRole('figure', { name: 'Cobertura por día' })
    // Solo los días con rol (el 06/11 no tiene).
    expect(within(linea).getAllByRole('listitem').map((l) => l.textContent)).toEqual(['05/11=79.3', '10/11=68.3'])
    const motivos = screen.getByRole('figure', { name: 'No cubiertos por motivo' })
    expect(motivos.querySelector('[data-grafica="barras"]')).toHaveTextContent('Empalme=14')
    expect(motivos).toHaveTextContent('Capacidad=2')
    const ocupacion = screen.getByRole('figure', { name: 'Ocupación por unidad' })
    expect(ocupacion.querySelector('[data-grafica="barras"]')?.textContent).toBe('BL-01=47.9BL-10=12.6')
    const incidencias = screen.getByRole('figure', { name: 'Incidencias por tipo' })
    expect(incidencias).toHaveTextContent('Pasajero no se presentó=1')

    const tabla = screen.getByRole('table', { name: 'Indicadores por día' })
    expect(within(tabla).getAllByRole('row')).toHaveLength(3)
    expect(tabla).toHaveTextContent('Propuesto')
  })

  it('cambia el rango desde los campos de fecha', async () => {
    const { peticiones } = simularApi(() => ({ cuerpo: DATOS }))
    renderizarPagina()
    await screen.findByLabelText('Indicadores clave')

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-01' } })
    await esperarPeticion(peticiones, (p) => p.query.get('desde') === '2026-11-01' && p.query.get('hasta') === '2026-11-10')
  })

  it('estado vacío: sin roles en el rango', async () => {
    simularApi(() => ({ cuerpo: { ...DATOS, resumen: { ...DATOS.resumen, diasConRol: 0 }, dias: [] } }))
    renderizarPagina()
    expect(await screen.findByText('No hay roles generados en este rango. Elige otras fechas.')).toBeInTheDocument()
  })

  it('una gráfica sin datos muestra "Sin datos en el rango"', async () => {
    simularApi(() => ({ cuerpo: { ...DATOS, resumen: { ...DATOS.resumen, incidencias: 0 } } }))
    renderizarPagina()
    const incidencias = await screen.findByRole('figure', { name: 'Incidencias por tipo' })
    expect(incidencias).toHaveTextContent('Sin datos en el rango.')
  })

  it('muestra el error de la API (400 con rango inválido)', async () => {
    simularApi(() => ({ status: 400, cuerpo: { message: 'El rango puede tener como máximo 31 días', statusCode: 400 } }))
    renderizarPagina('/indicadores?desde=2026-09-01&hasta=2026-11-10')
    expect(await screen.findByText('El rango puede tener como máximo 31 días')).toBeInTheDocument()
  })

  it('mientras carga muestra esqueletos', () => {
    simularApi(() => new Promise(() => {}))
    renderizarPagina()
    expect(screen.getByLabelText('Cargando indicadores')).toBeInTheDocument()
  })
})
