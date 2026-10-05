/**
 * Verificación de los paneles contra el backend real.
 *
 * Camina por la API lo que hace cada usuario: login, resumen, panel del
 * admin, listado de cuentas, agenda del médico, turno propio del paciente y
 * el flujo de recepción de buscar paciente a leer su ficha. No mockea nada:
 * sirve para confirmar que front y backend hablan el mismo idioma, que es
 * donde se rompen las cosas cuando un serializer cambia un nombre de campo.
 *
 * Las cuentas vienen de `python manage.py datos_demo --si`. Se pueden
 * sobreescribir por variable de entorno para probar contra otro entorno:
 *
 *   API_URL=http://localhost:8000 VERIFICAR_ADMIN_EMAIL=... npm run verificar:paneles
 *
 * Uso: npm run verificar:paneles
 */

const BASE = process.env.API_URL ?? 'http://127.0.0.1:8000'

// Cuentas de desarrollo. La contraseña es la que genera `datos_demo`, no una
// clave real: este script corre contra la base local.
const admin = {
  email: process.env.VERIFICAR_ADMIN_EMAIL ?? 'admin.dev@clinica.com',
  password: process.env.VERIFICAR_ADMIN_PASSWORD ?? 'Clinica2026!Local',
}

let fallos = 0
let pruebas = 0

function ok(nombre, detalle = '') {
  pruebas++
  console.log(`  OK   ${nombre}${detalle ? ` -- ${detalle}` : ''}`)
}

function falla(nombre, detalle) {
  pruebas++
  fallos++
  console.log(`  FALLA ${nombre} -- ${detalle}`)
}

// Salir con 1: el comando se usa en consola y en pipeline. Con 0 siempre, un
// rojo en la salida se lee como que salió bien.
process.on('unhandledRejection', (e) => {
  console.error('\nError no controlado:', e)
  process.exit(1)
})

async function pedir(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    data = null
  }
  return { status: response.status, data }
}

console.log(`Verificando paneles contra ${BASE}\n`)

/**
 * Login con manejo del 429.
 *
 * El login tiene throttle por IP (10 cada 15 minutos por defecto, `DRF_THROTTLE_LOGIN`)
 * y este script entra cuatro veces por corrida. Correrlo dos o tres veces seguidas
 * lo agota, y un 429 acá no dice nada del código: es el entorno. Se corta con un
 * mensaje claro en vez de Largar veinte fallas que parece un bug del panel.
 */
async function entrar(cuenta) {
  const r = await pedir('/api/auth/login', { method: 'POST', body: cuenta })
  if (r.status === 429) {
    console.log('')
    console.log(`Throttle de login: ${cuenta.email} dio 429.`)
    console.log('Se agotó el límite por IP (DRF_THROTTLE_LOGIN, 10 por 15 minutos).')
    console.log('Esperá a que se libere la ventana o subilo en el .env del backend:')
    console.log('  DRF_THROTTLE_LOGIN=200')
    process.exit(1)
  }
  if (r.status !== 200) return null
  return r.data.tokens.access
}

console.log('Sesión')
const token = await entrar(admin, 'admin')
if (!token) {
  console.log('')
  console.log('No se puede seguir sin sesión. ¿Está el backend arriba?')
  console.log('Si es la primera vez, cargá datos: python manage.py datos_demo --si')
  process.exit(1)
}
ok('login de admin', admin.email)

console.log('\nPanel de administración')
const resumen = await pedir('/api/panel/resumen', { token })
if (resumen.status === 200 && resumen.data.rol === 'admin') {
  ok('resumen', `${resumen.data.usuarios} usuarios, ${resumen.data.especialidades} especialidades`)
} else {
  falla('resumen', `HTTP ${resumen.status}`)
}

const usuarios = await pedir('/api/auth/usuarios', { token })
if (usuarios.status === 200 && Array.isArray(usuarios.data)) {
  const admins = usuarios.data.filter((u) => u.rol === 'admin')
  ok('listado de cuentas', `${usuarios.data.length} cuentas, ${admins.length} admin`)
  if (admins.length === 0) falla('hay admins visibles', 'el listado no muestra ninguno')
} else {
  falla('listado de cuentas', `HTTP ${usuarios.status}`)
}

const filtro = await pedir('/api/auth/usuarios?rol=medico', { token })
if (filtro.status === 200) {
  ok('filtro por rol', `${filtro.data.length} médicos`)
} else {
  falla('filtro por rol', `HTTP ${filtro.status}`)
}

const rolMalo = await pedir('/api/auth/usuarios?rol=jefe', { token })
if (rolMalo.status === 400) ok('rol inválido rechazado')
else falla('rol inválido rechazado', `HTTP ${rolMalo.status}`)

const busqueda = await pedir('/api/auth/usuarios?q=admin.dev', { token })
if (busqueda.status === 200 && busqueda.data.length >= 1) {
  ok('búsqueda de cuentas', `${busqueda.data.length} resultados`)
} else {
  falla('búsqueda de cuentas', `HTTP ${busqueda.status}`)
}

console.log('\nEndpoints que usa recepción')
const medicos = await pedir('/api/medicos?con_proximo=1', { token })
if (medicos.status === 200 && 'results' in medicos.data) {
  ok('listado de profesionales', `${medicos.data.count} en total`)
} else {
  falla('listado de profesionales', `HTTP ${medicos.status}`)
}

const especialidades = await pedir('/api/especialidades?todas=1', { token })
if (especialidades.status === 200 && Array.isArray(especialidades.data)) {
  ok('especialidades', `${especialidades.data.length} en total`)
} else {
  falla('especialidades', `HTTP ${especialidades.status}`)
}

const pacientesCorto = await pedir('/api/pacientes?q=a', { token })
if (pacientesCorto.status === 200 && pacientesCorto.data.length === 0) {
  ok('búsqueda corta no revienta', 'sin resultados con 1 letra')
} else {
  falla('búsqueda corta no devuelve nada', `HTTP ${pacientesCorto.status}`)
}

const consultas = await pedir('/api/consultas?estado=abierta', { token })
if (consultas.status === 200 && Array.isArray(consultas.data)) {
  ok('bandeja de consultas', `${consultas.data.length} abiertas`)
} else {
  falla('bandeja de consultas', `HTTP ${consultas.status}`)
}

const cola = await pedir('/api/cola?estado=esperando', { token })
if (cola.status === 200 && Array.isArray(cola.data)) {
  ok('cola de espera', `${cola.data.length} esperando`)
} else {
  falla('cola de espera', `HTTP ${cola.status}`)
}

const hoy = new Date()
const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
const disponibilidad = await pedir(`/api/disponibilidad?fecha=${fecha}`, { token })
if (disponibilidad.status === 200 && Array.isArray(disponibilidad.data.medicos)) {
  ok('disponibilidad', `${disponibilidad.data.medicos.length} profesionales`)
} else {
  falla('disponibilidad', `HTTP ${disponibilidad.status}`)
}

// Cuentas que crea `python manage.py datos_demo --si`.
const contrasenaDemo = process.env.VERIFICAR_PASSWORD ?? 'Clinica2026!Demo'
const paciente = {
  email: process.env.VERIFICAR_PACIENTE_EMAIL ?? 'paciente.ana@correo.local',
  password: contrasenaDemo,
}
const recepcion = {
  email: process.env.VERIFICAR_RECEPCION_EMAIL ?? 'recepcion.demo@clinica.local',
  password: contrasenaDemo,
}
const medico = {
  email: process.env.VERIFICAR_MEDICO_EMAIL ?? 'medico.cardiologia@clinica.local',
  password: contrasenaDemo,
}

console.log('\nCada rol entra a su panel')
const tokens = {}
for (const [rol, cuenta] of [
  ['recepcion', recepcion],
  ['medico', medico],
  ['paciente', paciente],
]) {
  const token = await entrar(cuenta, rol)
  if (!token) {
    falla(`login de ${rol}`, 'si ya corriste datos_demo, mirá el mensaje de arriba')
    continue
  }
  tokens[rol] = token
  ok(`login de ${rol}`, cuenta.email)

  const resumen = await pedir('/api/panel/resumen', { token })
  if (resumen.status === 200 && resumen.data.rol === rol) {
    // Las claves cambian por rol a proposito: no es un error que el paciente
    // no vea `turnos_hoy`. Se muestra lo que corresponda.
    const claves = Object.keys(resumen.data).filter((k) => k !== 'rol')
    ok(`resumen de ${rol}`, claves.map((k) => `${k}=${resumen.data[k]}`).join(', '))
  } else {
    falla(`resumen de ${rol}`, `HTTP ${resumen.status}`)
  }
}

console.log('\nFlujo del paciente')
if (tokens.paciente) {
  const t = tokens.paciente

  const propios = await pedir('/api/turnos/mios', { token: t })
  if (propios.status === 200 && Array.isArray(propios.data)) {
    ok('turnos propios', `${propios.data.length} turnos`)
  } else {
    falla('turnos propios', `HTTP ${propios.status}`)
  }

  const ficha = await pedir('/api/ficha', { token: t })
  if (ficha.status === 200 && ficha.data.alergias !== undefined) {
    ok('ficha propia', `alergias: ${ficha.data.alergias || 'sin datos'}`)
  } else {
    falla('ficha propia', `HTTP ${ficha.status}`)
  }

  const cola = await pedir('/api/cola?estado=esperando', { token: t })
  if (cola.status === 200 && Array.isArray(cola.data)) {
    ok('cola propia', `${cola.data.length} entradas`)
  } else {
    falla('cola propia', `HTTP ${cola.status}`)
  }

  const consultas = await pedir('/api/consultas', { token: t })
  if (consultas.status === 200 && Array.isArray(consultas.data)) {
    ok('consultas propias', `${consultas.data.length} consultas`)
  } else {
    falla('consultas propias', `HTTP ${consultas.status}`)
  }
}

console.log('\nFlujo del médico')
if (tokens.medico) {
  const t = tokens.medico

  const perfil = await pedir('/api/medicos/mi-perfil', { token: t })
  if (perfil.status === 200 && perfil.data.matricula) {
    ok('perfil propio', perfil.data.matricula)

    const agenda = await pedir(`/api/medicos/${perfil.data.id}/agenda`, { token: t })
    if (agenda.status === 200 && Array.isArray(agenda.data)) {
      ok('tramos de agenda', `${agenda.data.length} tramos`)
    } else {
      falla('tramos de agenda', `HTTP ${agenda.status}`)
    }
  } else {
    falla('perfil propio', `HTTP ${perfil.status}`)
  }

  const turnos = await pedir('/api/turnos/mios?periodo=hoy', { token: t })
  if (turnos.status === 200 && Array.isArray(turnos.data)) {
    ok('turnos de hoy', `${turnos.data.length} turnos`)
  } else {
    falla('turnos de hoy', `HTTP ${turnos.status}`)
  }

  const semana = await pedir('/api/turnos/mios?periodo=semana', { token: t })
  if (semana.status === 200 && Array.isArray(semana.data)) {
    ok('turnos de la semana', `${semana.data.length} turnos`)
  } else {
    falla('turnos de la semana', `HTTP ${semana.status}`)
  }
}

console.log('\nFlujo de recepción')
if (tokens.recepcion) {
  const t = tokens.recepcion

  // El flujo completo: buscar paciente -> abrir su ficha. La busqueda sale de la
// parte local del email del paciente, asi que funciona con cualquier cuenta.
const busqueda = await pedir(
    `/api/pacientes?q=${encodeURIComponent(paciente.email.split('@')[0])}`,
    { token: t },
  )
  if (busqueda.status === 200 && busqueda.data.length >= 1) {
    const encontrado = busqueda.data[0]
    ok('buscar paciente', `${encontrado.nombre} (${encontrado.id})`)

    const ficha = await pedir(`/api/pacientes/${encontrado.id}/ficha`, { token: t })
    if (ficha.status === 200) ok('leer ficha del paciente', 'ok')
    else falla('leer ficha del paciente', `HTTP ${ficha.status}`)
  } else {
    falla('buscar paciente', `HTTP ${busqueda.status}`)
  }

  const abiertas = await pedir('/api/consultas?estado=abierta', { token: t })
  if (abiertas.status === 200 && abiertas.data.length >= 1) {
    const pendiente = abiertas.data[0]
    const respuesta = await pedir(`/api/consultas/${pendiente.id}/responder`, {
      method: 'POST',
      token: t,
      body: { respuesta: 'Respuesta del script de verificacion.' },
    })
    if (respuesta.status === 200 || respuesta.status === 201) {
      ok('responder consulta abierta', `#${pendiente.id}`)
    } else {
      falla('responder consulta abierta', `HTTP ${respuesta.status}`)
    }
  } else {
    // No hay consulta abierta: no es un fallo del panel, solo no hay nada que
    // responder. Se avisa igual para que quede claro que se salteó.
    ok('responder consulta abierta', 'sin consultas abiertas, no se probó')
  }

  const medicos = await pedir('/api/medicos?disponibles=1', { token: t })
  if (medicos.status === 200 && Array.isArray(medicos.data.results)) {
    ok('profesionales disponibles', `${medicos.data.count} en total`)
    const primero = medicos.data.results[0]
    if (primero) {
      const bloqueos = await pedir(`/api/medicos/${primero.id}/bloqueos`, { token: t })
      if (bloqueos.status === 200 && Array.isArray(bloqueos.data)) {
        ok('bloqueos del profesional', `${bloqueos.data.length} rangos`)
      } else {
        falla('bloqueos del profesional', `HTTP ${bloqueos.status}`)
      }
    } else {
      ok('bloqueos del profesional', 'sin profesionales disponibles')
    }
  } else {
    falla('profesionales disponibles', `HTTP ${medicos.status}`)
  }
}

console.log('\nAislamiento entre roles')
const noAutorizados = [
  ['medico', 'listado de cuentas'],
  ['paciente', 'listado de cuentas'],
  ['recepcion', 'listado de cuentas'],
  ['medico', 'alta de especialidades'],
]
const rutasNoAutorizadas = {
  'listado de cuentas': { path: '/api/auth/usuarios', method: 'GET' },
  'alta de especialidades': { path: '/api/especialidades', method: 'POST' },
}

for (const [rol, que] of noAutorizados) {
  if (!tokens[rol]) continue
  const ruta = rutasNoAutorizadas[que]
  const r = await pedir(ruta.path, {
    method: ruta.method,
    token: tokens[rol],
    body: ruta.method === 'POST' ? { nombre: 'Prueba' } : undefined,
  })
  if (r.status === 403) ok(`${rol} no puede: ${que}`)
  else falla(`${rol} no puede: ${que}`, `HTTP ${r.status} (esperaba 403)`)
}

// El listado global de turnos es de recepcion: el medico y el paciente tienen
// endpoints propios para ver lo suyo.
for (const rol of ['medico', 'paciente']) {
  if (!tokens[rol]) continue
  const r = await pedir('/api/turnos', { token: tokens[rol] })
  if (r.status === 403) ok(`${rol} no puede: listado global de turnos`)
  else falla(`${rol} no puede: listado global de turnos`, `HTTP ${r.status} (esperaba 403)`)
}

console.log('\nPermisos')
const sinToken = await pedir('/api/panel/resumen')
if (sinToken.status === 401) ok('sin token, 401')
else falla('sin token, 401', `HTTP ${sinToken.status}`)

const turnoAjeno = await pedir('/api/turnos/999999', { token })
if ([403, 404].includes(turnoAjeno.status)) ok(`turno inexistente, ${turnoAjeno.status}`)
else falla('turno inexistente', `HTTP ${turnoAjeno.status}`)

console.log(`\n${pruebas - fallos}/${pruebas} pruebas OK`)
if (fallos > 0) {
  console.log(`${fallos} fallaron`)
  process.exit(1)
}