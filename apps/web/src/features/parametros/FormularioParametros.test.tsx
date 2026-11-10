import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ErrorApi } from '@/api/cliente'
import { aLista, aValores, esquemaParametros, type Parametro } from './esquema'
import { FormularioParametros } from './FormularioParametros'

const PARAMETROS: Parametro[] = [
  { id: 4, clave: 'anticipacion.COMPARTIDO', valor: '20', descripcion: 'Minutos COMPARTIDO' },
  { id: 5, clave: 'anticipacion.GRUPO', valor: '30', descripcion: 'Minutos GRUPO' },
  { id: 6, clave: 'anticipacion.PRIVADO', valor: '10', descripcion: 'Minutos PRIVADO' },
  { id: 1, clave: 'hora_cita.bloque_matutino', valor: '04:00-05:00', descripcion: 'Bloque matutino' },
  { id: 2, clave: 'hora_cita.bloque_vespertino', valor: '12:00-13:00', descripcion: 'Bloque vespertino' },
  { id: 3, clave: 'jornada_maxima_horas', valor: '9.5', descripcion: 'Jornada máxima' },
  { id: 7, clave: 'motor.penalizacion_carga_min', valor: '15', descripcion: 'Penalización por carga' },
]
const validos = aValores(PARAMETROS)
const errorEn = (valores: object) => esquemaParametros.safeParse({ ...validos, ...valores }).error?.issues[0]?.message

describe('esquemaParametros (mismas reglas que la API)', () => {
  it('acepta los valores del seed', () => {
    expect(esquemaParametros.safeParse(validos).success).toBe(true)
  })

  it('bloques de hora de cita en HH:mm-HH:mm con el inicio antes que el fin', () => {
    const bloques = (bloque_matutino: string, bloque_vespertino = '12:00-13:00') => ({
      hora_cita: { bloque_matutino, bloque_vespertino },
    })
    expect(errorEn(bloques('04:00'))).toMatch(/HH:mm-HH:mm/)
    expect(errorEn(bloques('4:00-05:00'))).toMatch(/HH:mm-HH:mm/)
    expect(errorEn(bloques('05:00-04:00'))).toBe('La hora de inicio debe ser antes que la de fin')
    expect(errorEn(bloques('04:00-04:00'))).toBe('La hora de inicio debe ser antes que la de fin')
    expect(errorEn(bloques('00:00-23:59', '12:00-13:30'))).toBeUndefined()
  })

  it('jornada máxima entre 1 y 12 horas', () => {
    expect(errorEn({ jornada_maxima_horas: '0.5' })).toBe('Debe estar entre 1 y 12 horas')
    expect(errorEn({ jornada_maxima_horas: '12.5' })).toBe('Debe estar entre 1 y 12 horas')
    expect(errorEn({ jornada_maxima_horas: 'diez' })).toMatch(/número de horas/)
    expect(errorEn({ jornada_maxima_horas: '12' })).toBeUndefined()
  })

  it('anticipación en minutos enteros de 0 a 120', () => {
    const anticipacion = (PRIVADO: string) => ({ anticipacion: { ...validos.anticipacion, PRIVADO } })
    expect(errorEn(anticipacion('121'))).toBe('Debe estar entre 0 y 120 minutos')
    expect(errorEn(anticipacion('10.5'))).toBe('Ingresa minutos enteros')
    expect(errorEn(anticipacion('0'))).toBeUndefined()
  })

  it('aLista arma el cuerpo de PUT /parametros con las claves de la API', () => {
    expect(aLista(validos, PARAMETROS)).toEqual([
      { clave: 'hora_cita.bloque_matutino', valor: '04:00-05:00' },
      { clave: 'hora_cita.bloque_vespertino', valor: '12:00-13:00' },
      { clave: 'jornada_maxima_horas', valor: '9.5' },
      { clave: 'anticipacion.PRIVADO', valor: '10' },
      { clave: 'anticipacion.COMPARTIDO', valor: '20' },
      { clave: 'anticipacion.GRUPO', valor: '30' },
      { clave: 'motor.penalizacion_carga_min', valor: '15' },
    ])
  })
})

describe('Formulario de parámetros', () => {
  it('muestra los errores de validación y no envía nada', async () => {
    const alGuardar = vi.fn().mockResolvedValue(undefined)
    render(<FormularioParametros parametros={PARAMETROS} soloLectura={false} alGuardar={alGuardar} />)

    await userEvent.clear(screen.getByLabelText('Jornada máxima'))
    await userEvent.type(screen.getByLabelText('Jornada máxima'), '15')
    await userEvent.clear(screen.getByLabelText('Bloque matutino'))
    await userEvent.type(screen.getByLabelText('Bloque matutino'), '05:00-04:00')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Debe estar entre 1 y 12 horas')).toBeInTheDocument()
    expect(screen.getByText('La hora de inicio debe ser antes que la de fin')).toBeInTheDocument()
    expect(screen.getByLabelText('Jornada máxima')).toHaveAttribute('aria-invalid', 'true')
    expect(alGuardar).not.toHaveBeenCalled()
  })

  it('con valores válidos envía todas las claves', async () => {
    const alGuardar = vi.fn().mockResolvedValue(undefined)
    render(<FormularioParametros parametros={PARAMETROS} soloLectura={false} alGuardar={alGuardar} />)

    await userEvent.clear(screen.getByLabelText('Jornada máxima'))
    await userEvent.type(screen.getByLabelText('Jornada máxima'), '10')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await vi.waitFor(() => expect(alGuardar).toHaveBeenCalledTimes(1))
    expect(alGuardar.mock.calls[0][0]).toContainEqual({ clave: 'jornada_maxima_horas', valor: '10' })
    expect(alGuardar.mock.calls[0][0]).toHaveLength(7)
  })

  it('muestra en su campo el error que devuelve la API', async () => {
    const errorApi = new ErrorApi(400, 'jornada_maxima_horas debe ser…', {
      errores: [{ clave: 'jornada_maxima_horas', mensaje: 'debe ser un número de horas entre 1 y 12' }],
    })
    const alGuardar = vi.fn().mockRejectedValue(errorApi)
    render(<FormularioParametros parametros={PARAMETROS} soloLectura={false} alGuardar={alGuardar} />)

    await userEvent.clear(screen.getByLabelText('Jornada máxima'))
    await userEvent.type(screen.getByLabelText('Jornada máxima'), '11')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('El valor debe ser un número de horas entre 1 y 12')).toBeInTheDocument()
  })

  it('en solo consulta los campos no se pueden editar y no hay botones', () => {
    render(<FormularioParametros parametros={PARAMETROS} soloLectura alGuardar={vi.fn()} />)

    expect(screen.getByLabelText('Bloque matutino')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Jornada máxima')).toHaveValue('9.5')
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument()
  })
})
