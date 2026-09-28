# Cómo trabajamos en este repo

## Ramas

- `main` — lo que está en producción. Nadie commitea directo acá.
- `develop` — donde se integra. Cada PR entra acá.
- `feature/...` — una rama por cosa. `feature/verificar-email`

Flujo: `feature/...` → PR a `develop` → `main` en cada release.

## Antes de abrir un PR

```bash
pnpm lint
pnpm typecheck
pnpm build
```

Los tres tienen que pasar limpios. Un PR que rompe el build no entra.

## Commits

Mensajes en modo imperativo y en inglés, porque el código va en inglés:

```
Add verification code screen
Fix auth context fast refresh warning
```

Tipos que usamos: `Add`, `Fix`, `Refactor`, `Test`, `Docs`, `Chore`.

## Cosas que no se tocan

- **`.env` nunca se commitea.** Todo lo que empieza con `VITE_` va dentro del
  bundle, o sea que es público: no va ninguna clave real en un `VITE_`.
- **El access token solo vive en memoria** (`src/utils/session.ts`). No va a
  `localStorage`: un XSS lo leería. El refresh es una cookie HttpOnly que
  maneja el back, y no hay que tocarla desde acá.
- **`dev_code` solo aparece sin SMTP.** Con SMTP configurado viene en `null` y
  el código se manda solo por email. No hay que meter SMTP en el `.env` del
  front ni relajar la verificación en el back.

## Cosas que aprendimos a la mala

- **Vite 8 escucha en `localhost`, no en `127.0.0.1`.** Si el proxy o un test
  apunta a `127.0.0.1:5173` no conecta.
- **Las cookies no viajan entre `localhost` y `127.0.0.1`.** Son orígenes
  distintos para el navegador: usar siempre el mismo.
- **Si el login falla, el back loguea si el email existe o no** (enmascarado).
  Antes no había forma de distinguir un email mal tipeado de una clave mal
  tipeada.
- El back tiene throttles: 10 logins y 5 registros por 15 minutos. Si ves
  `throttled` no es un bug.

## Levantar en local

Necesita el back corriendo en `http://127.0.0.1:8000`.

```bash
pnpm install
pnpm dev
```

Queda en http://localhost:5173. El proxy de Vite reenvía `/api` y `/health` al
back, así que no hay CORS que configurar en desarrollo.
