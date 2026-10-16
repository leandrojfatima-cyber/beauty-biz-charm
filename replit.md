# Running on Replit

- Keep the existing React / TanStack Start / Vite stack and Supabase backend.
- Runtime: Node.js 22. Use `npm ci` to install the locked dependencies.
- Press **Run** to start the `Start application` workflow (`npm run dev`).
- Vite listens on `0.0.0.0:5000`, with proxy hosts allowed.
- `.npmrc` enables legacy peer resolution because npm's default resolver crashes on the imported dependency graph.

## Required connection settings

Add the existing Supabase project's `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Replit Secrets, then restart the workflow. The browser uses these public client settings; never use a service-role key in a `VITE_` setting.

Until these settings are supplied, the public home renders but authentication and database operations do not work. Keep the existing Supabase database and its access policies; do not replace it or run migrations automatically.

The public demo screenshots use the existing Lovable site's public asset URLs. They remain hosted there rather than being copied or regenerated.

## Checks

- `npm test` runs the existing test suite.
- `npm run build` builds the existing production bundle. The imported configuration targets Cloudflare; this is not a Replit publishing configuration.
- Authenticated screens require a real Supabase connection and user session; a public preview alone cannot verify them.
