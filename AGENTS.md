<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Single-salon-per-account: every table has `owner_id default auth.uid()` with owner-only RLS — keeps each signed-in account's data isolated without a roles system.
- App screens live under `src/routes/_authenticated/` and query the database from the browser client via TanStack Query (`src/lib/db.ts`) — RLS is the security boundary, so no server functions are needed for CRUD.
- Closing a comanda goes through the `close_order` database function — keeps total, revenue entry, stock deduction and appointment completion atomic.
- Stock levels change only via `stock_movements` inserts (trigger updates `products.stock`) — keeps an audit trail.
- Commission % is copied onto each `order_items` row at insert time — later catalog price/% changes don't alter past commissions.
- Master (audit) access is the `master` role in `user_roles`, granted only by `claim_master()` to the one confirmed authorised e-mail — no credentials in code.
- Audit trail rows are written client-side via `logAudit` into `audit_logs` (insert-own, master-read) — keeps logging simple without server functions.
- Keep mobile density in the shared AppShell and mobile CSS; tables use mobile-table with data-label cells to retain every field without horizontal scrolling.
- Public home screenshots use browser-intercepted fictional data and CDN asset pointers, never live customer records; desktop viewport sizing is scoped to the public home so authenticated screens retain their layout.
- The public home route `/` never redirects or navigates on load (signed in or not); `src/routes/home-no-redirect.test.ts` guards this — customers share and bookmark the root address.
