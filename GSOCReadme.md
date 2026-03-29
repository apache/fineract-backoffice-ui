Implemented the navigation and tenant fixes.

In app.routes.ts, I added lazy-loaded protected routes for /features/clients, /features/loans, and /features/organization, so the existing sidebar links now resolve instead of pointing at missing routes. I also added standalone placeholder pages at clients.component.ts, loans.component.ts, and organization.component.ts.

For tenant state, auth.service.ts now initializes currentTenantId from storage/default config, keeps it updated on login, and clears persisted tenant state on logout before resetting the signal to the configured default. system-status.component.ts now reads that real tenant signal instead of showing a hardcoded value.

I also updated the relevant specs in auth.service.spec.ts, system-status.component.spec.ts, and sidebar.component.spec.ts. Verification passed with npm test -- --watch=false --browsers=ChromeHeadless and the suite completed with 29 SUCCESS.
