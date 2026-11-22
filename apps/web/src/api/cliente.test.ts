import { describe, expect, it } from 'vitest'
import { urlApi } from './cliente'

describe('urlApi', () => {
  it('resuelve una base relativa contra el origen de la página (producción)', () => {
    expect(urlApi('/roles', '/api', 'http://192.168.1.50').href).toBe('http://192.168.1.50/api/roles')
    expect(urlApi('/roles', '/api', 'http://localhost').href).toBe('http://localhost/api/roles')
  })

  it('respeta una base absoluta (desarrollo con Vite)', () => {
    expect(urlApi('/roles', 'http://localhost:3000/api', 'http://localhost:5173').href).toBe(
      'http://localhost:3000/api/roles',
    )
  })
})
