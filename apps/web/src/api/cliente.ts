import { leerToken } from '../auth/sesion'

/** URL base de la API (configurable con VITE_API_URL en apps/web/.env). */
const URL_API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

/** Error de la API con su código HTTP y un mensaje listo para mostrar. */
export class ErrorApi extends Error {
  readonly status: number
  /** Cuerpo completo de la respuesta (por ejemplo, los errores por campo o por celda). */
  readonly datos: unknown

  constructor(status: number, mensaje: string, datos: unknown = null) {
    super(mensaje)
    this.status = status
    this.datos = datos
  }
}

type ValorQuery = string | number | boolean | undefined | null

interface OpcionesPeticion {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  cuerpo?: unknown
  query?: Record<string, ValorQuery>
}

// Función que se llama cuando una petición autenticada recibe 401
// (token vencido o usuario desactivado). La registra el AuthProvider.
let alRecibir401: (() => void) | null = null
export function registrarManejador401(manejador: () => void) {
  alRecibir401 = manejador
}

/**
 * Hace una petición a la API: agrega el token, convierte el cuerpo a JSON y
 * transforma las respuestas de error en ErrorApi con el mensaje del servidor.
 */
export async function pedir<T>(ruta: string, opciones: OpcionesPeticion = {}): Promise<T> {
  const url = new URL(URL_API + ruta)
  for (const [clave, valor] of Object.entries(opciones.query ?? {})) {
    if (valor !== undefined && valor !== null && valor !== '') {
      url.searchParams.set(clave, String(valor))
    }
  }

  const token = leerToken()
  const encabezados: Record<string, string> = {}
  // FormData (subida de archivos): el navegador pone el Content-Type multipart.
  const esFormulario = opciones.cuerpo instanceof FormData
  if (opciones.cuerpo !== undefined && !esFormulario) encabezados['Content-Type'] = 'application/json'
  if (token) encabezados.Authorization = `Bearer ${token}`

  let respuesta: Response
  try {
    respuesta = await fetch(url, {
      method: opciones.metodo ?? 'GET',
      headers: encabezados,
      body: esFormulario
        ? (opciones.cuerpo as FormData)
        : opciones.cuerpo !== undefined
          ? JSON.stringify(opciones.cuerpo)
          : undefined,
    })
  } catch {
    throw new ErrorApi(0, 'No se pudo conectar con el servidor. Revisa que la API esté levantada.')
  }

  const datos: unknown = await respuesta.json().catch(() => null)
  if (!respuesta.ok) {
    if (respuesta.status === 401 && token) alRecibir401?.()
    throw new ErrorApi(respuesta.status, mensajeDeError(datos), datos)
  }
  return datos as T
}

/**
 * Descarga un archivo de la API (por ejemplo el rol en CSV o PDF) con el
 * token de la sesión y lo guarda con el nombre que manda el servidor en
 * Content-Disposition. Devuelve ese nombre.
 */
export async function descargar(ruta: string, query: Record<string, ValorQuery> = {}): Promise<string> {
  const url = new URL(URL_API + ruta)
  for (const [clave, valor] of Object.entries(query)) {
    if (valor !== undefined && valor !== null && valor !== '') url.searchParams.set(clave, String(valor))
  }
  const token = leerToken()
  let respuesta: Response
  try {
    respuesta = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  } catch {
    throw new ErrorApi(0, 'No se pudo conectar con el servidor. Revisa que la API esté levantada.')
  }
  if (!respuesta.ok) {
    const datos: unknown = await respuesta.json().catch(() => null)
    if (respuesta.status === 401 && token) alRecibir401?.()
    throw new ErrorApi(respuesta.status, mensajeDeError(datos), datos)
  }
  const nombre = /filename="([^"]+)"/.exec(respuesta.headers.get('Content-Disposition') ?? '')?.[1] ?? 'archivo'
  const enlace = document.createElement('a')
  enlace.href = URL.createObjectURL(await respuesta.blob())
  enlace.download = nombre
  document.body.append(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(enlace.href)
  return nombre
}

/** NestJS manda `message` como texto o como lista de textos (validación). */
function mensajeDeError(datos: unknown): string {
  const mensaje = (datos as { message?: unknown } | null)?.message
  if (Array.isArray(mensaje)) return mensaje.join('. ')
  if (typeof mensaje === 'string') return mensaje
  return 'Ocurrió un error inesperado en el servidor'
}

/** Respuesta paginada de los listados de la API. */
export interface Paginado<T> {
  datos: T[]
  total: number
  pagina: number
  limite: number
}
