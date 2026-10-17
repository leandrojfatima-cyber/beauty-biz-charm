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

## Executive dashboard (Etapa 12)

Before using `/painel` with the existing Supabase project, apply `supabase/migrations/20261017260000_executive_dashboard_etapa12.sql`. It adds and backfills `salon_id` on products, orders, and order items; the dashboard filters all operational queries by the signed-in owner's salon. Existing owner-only RLS policies remain in force.

The panel reads realized financial transactions, active client subscriptions, closed orders, appointments, and salon catalogs. Subscription MRR is an estimate from active plan prices normalized to a monthly billing cycle; recognized subscription receipts appear separately when transactions are tagged `source = 'assinatura'`. Retention compares completed-appointment clients with the previous window of equal length.

## Checks

- `npm test` runs the existing test suite.
- `npm run build` builds the existing production bundle. The imported configuration targets Cloudflare; this is not a Replit publishing configuration.
- Authenticated screens require a real Supabase connection and user session; a public preview alone cannot verify them.
