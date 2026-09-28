# clinica_front

Front de la clínica. React + TypeScript + Vite + Tailwind, en español.

Por ahora es el esqueleto de la aplicación: login, registro, verificación de
email, cambio de contraseña y una pantalla principal que dice "Próximamente".
El diseño es provisional y está pensado para cambiar.

## Requisitos

- Node 20 o superior
- pnpm
- El back (`clinica_back`) corriendo en `http://127.0.0.1:8000`

## Puesta en marcha

```bash
pnpm install
pnpm dev
```

Queda en http://localhost:5173. Vite hace proxy de `/api` y `/health` al back,
así que el front siempre habla con el mismo origen y no hay que configurar CORS
en desarrollo.

## Scripts

| Comando          | Qué hace                                        |
| ---------------- | ----------------------------------------------- |
| `pnpm dev`       | Servidor de desarrollo con HMR                  |
| `pnpm build`     | Chequea tipos y compila a `dist/`               |
| `pnpm preview`   | Sirve `dist/` para verificar el build           |
| `pnpm lint`      | Oxlint                                          |
| `pnpm typecheck` | Solo chequea tipos, sin compilar                |

## Variables de entorno

No hace falta ninguna para desarrollo: el proxy ya apunta al back. Si hay que
apuntar a otro lado, se overridea con `VITE_API_URL`.

## Rutas

| Ruta               | Qué hace                                       |
| ------------------ | ---------------------------------------------- |
| `/`                | Principal, protegida                           |
| `/login`           | Login por email y contraseña                   |
| `/registro`        | Alta pública, siempre como paciente           |
| `/verificar`       | Canje del código de 6 dígitos                 |
| `/cambiar-password`| Cambio de contraseña, protegida                |

`/` y `/cambiar-password` redirigen a `/login` si no hay sesión.

## Cómo se guarda la sesión

- El access token vive solo en memoria, en `src/lib/session.ts`. No se escribe
  en `localStorage`, así que un XSS no lo puede leer.
- El refresh token es una cookie HttpOnly que pone el back. El front nunca la
  toca, solo la manda con `credentials: 'include'`.
- Al cargar la app, `AuthProvider` intenta un `POST /api/auth/refresh` para
  recuperar la sesión. Si responde 401, se muestra el login.
- `src/lib/api.ts` reintenta una sola vez ante un 401: refresca el token y
  vuelve a disparar el request. Si el refresh también falla, limpia la sesión.

## Sin SMTP

Si el back no tiene `SMTP_HOST`, el endpoint de registro devuelve `dev_code`
con el código de verificación en claro y también lo imprime en la consola del
servidor. Con SMTP configurado, `dev_code` viene en `null` y el código solo se
envía por email.
