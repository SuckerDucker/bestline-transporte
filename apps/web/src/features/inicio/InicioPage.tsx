import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/contexto'
import { NOMBRE_ROL } from '../../auth/tipos'
import { opcionesPara } from '../../layout/menu'

/** Pantalla de bienvenida con accesos a las secciones permitidas para el rol. */
export function InicioPage() {
  const { usuario } = useAuth()
  if (!usuario) return null
  const secciones = opcionesPara(usuario.rol).filter((o) => o.ruta !== '/')

  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-800">Hola, {usuario.nombre}</h1>
      <p className="mt-1 text-sm text-slate-500">
        Entraste como <strong>{NOMBRE_ROL[usuario.rol]}</strong>.
      </p>

      {secciones.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {secciones.map((s) => (
            <Link
              key={s.ruta}
              to={s.ruta}
              className="rounded-lg border border-slate-200 bg-white p-5 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-400"
            >
              {s.etiqueta}
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-8 rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Aquí aparecerán tus servicios asignados cuando esté listo el rol diario.
        </p>
      )}
    </section>
  )
}
