<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# ADR 0006: A boundary around the generated OpenAPI client

## Context

`src/app/api` is 145,000 lines of TypeScript — 155 services and 1,476 models — regenerated from
`api-spec/fineract.json` by `openapi-generator`. It is the only dependency in this repository
that can change without anyone here deciding to change it: the spec follows Fineract's release
cadence (ADR 0002 syncs it automatically), and the generator follows its own.

Measured on `d976842b`, 463 files outside `src/app/api` import it, 278 of them feature
components. There is no mapping layer: a component injects `ClientsService`, receives
`GetClientsClientIdResponse`, and binds that shape straight into its template. The generated
client _is_ this application's domain model.

Two previous decisions already cover part of this, and it is worth being precise about which
part, because the gap between them is what this ADR is for.

- **ADR 0001** made generated _names_ deterministic by preprocessing `operationId`s. Before it,
  one spec bump renamed methods and broke 137 call sites across 63 components. It also
  explicitly rejected a hand-written facade that would rename ~54 services — a permanently
  maintained indirection whose only job was friendlier names.
- **`scripts/check-api-surface.mjs`** records which generated operations the application calls,
  so an endpoint disappearing upstream produces one diagnostic naming the operation and its
  callers, rather than a compile error per call site.

Between them, a _generator_ bump and an endpoint _removal_ are handled. What is not handled is a
change to an emitted **shape**: a field becoming optional, an enum gaining a member, a response
nesting one level deeper, a numeric id widening. Names stay stable, `check-api-surface` still
passes, and the change lands on every file that binds that shape — today, up to 463 of them.

## Decision

Treat generated code as disposable, and make the cost of coupling to it visible and
non-increasing.

1. `local/no-generated-api-import` reports any import that resolves into `src/app/api` from
   outside the designated locations. Matching is on the resolved path, not the specifier, so
   `'../../api'` and `'../api/model/getClientsResponse'` are caught alike regardless of the
   importing file's depth.
2. The designated locations are `src/app/core/adapters/api/**` — the adapters that map generated
   types onto application models, and their specs — and `src/app/app.config.ts`, which
   configures `BASE_PATH` rather than calling anything.
3. The existing 475 violations are seeded into `eslint-suppressions.json`, which this repository
   documents as only ever shrinking. Nothing breaks on adoption; the count cannot grow.
4. Where a screen is migrated, it depends on an application-level contract and model —
   `LoanApi`, `Loan` — implemented by an adapter that calls the generated client and maps its
   response. Add these **selectively**, for domains where the shape is actually consumed widely
   or is known to move. A contract whose only content is a rename of a generated method is the
   facade ADR 0001 rejected, and is still rejected.

Five domains are migrated so far. Three were chosen because each had a defect the generated type
could not prevent: accounting closures (a field read that no payload contains), offices (a
date typed `string` that arrives as `[y, m, d]`, plus two fields the type never declares) and
loans (a status `value` the type does not declare, which a template was comparing against
English display text as control flow — so a non-English platform offered neither Approve nor
Disburse). Entity notes was chosen on reach rather than on a defect — its payload agrees with the
generated type, but it is consumed from client, group, loan and savings screens, and the
`resourceType` path segment was a bare `string` in both the client and the component. Loan
transactions came with the loan domain: one payload that the generated client models with two
mutually inconsistent types, and a `date` declared `string` that arrives as an array. Staff and
holidays came with offices, which is how Fineract models them — all three are scoped by office —
and holidays carry three array dates where the type says `string`, plus an update endpoint that
accepts seven fields its request type does not declare.

Staff are the instructive one, because the generated type is **right** there: `joiningDate` is
declared `string` and really is one. The application distrusted it anyway and ran the value
through the array converter, which answers `'-'` for a string, so the staff edit form displayed
a dash instead of a date. Two endpoints in the same Organization area encode dates two different
ways, and nothing in the type says which. That is the case for converting once at a boundary
rather than for trusting or distrusting any particular declaration. All five
are written up in `DOCS/ADAPTERS.md`; issue #653 records the shape disagreements. The baseline
stands at 444 after them.

That arithmetic is worth stating plainly: seven domains, twenty-five files cleared. 444 files import
the client, and most depend on exactly one generated service, so the work is tractable — but the
distribution is flat. The largest single domain left is nine files. This is a long campaign of
small PRs, not something one change finishes, and the ratchet exists so that it can proceed at
that pace without the number going back up.

A second thing the loan domain showed, which is worth recording for whoever picks the next one:
the files a greedy "clears the most violations" search ranks highest are often pure functions
that merely _name_ generated types in their signatures — `loan-charge-refund.ts`,
`loan-contract-termination.ts`, `loan-delinquency-action.model.ts`. Re-typing those onto
application models does not clear anything on its own, because their callers are the large
components that still hold generated types, so the change cascades into whatever was not being
migrated. Prefer the files that _inject_ a generated service: there the adapter replaces the
dependency outright and the blast radius stops at the file.

Roles and users (`ROLE_API`, `USER_API`) are the strongest evidence for the boundary so far,
because migrating them found a screen that **could not save at all**. Fineract publishes five
permission codes with a trailing space, and `READ_STANDINGINSTRUCTION` exists only in that form.
`role-form.component.ts` trimmed each code on the way in — correctly, because every route's
`data.permissions` uses the trimmed spelling — and then sent the trimmed keys back, so
`PUT /roles/{id}/permissions` answered 404 for every role and every administrator regardless of
which boxes were ticked. Three things kept it hidden: the component's spec mocked the call, the
fixture contained no padded code, and every RBAC e2e spec grants permissions over HTTP through
`seed-api.ts` rather than through the screen. `RolePermission` now carries both spellings and
fixes which one is used where, so the decision is made once at the boundary instead of at each
call site. The baseline stands at 429.

That is the pattern worth generalising: a contract is most valuable where the application was
already normalising a platform quirk, because normalising on the way in and on the way out are
different jobs and a component that does both in one field will get one of them wrong.

This is deliberately not the facade from ADR 0001. It renames nothing, it does not require a
wrapper per service, and it adds no indirection on day one. It is a measurement that fails CI
when it worsens, plus a sanctioned place to put a mapping when a mapping earns its keep.

## Why a rule of its own

`eslint-suppressions.json` counts violations per rule id. `no-restricted-imports` already
carries the Angular Material and `@ngx-translate` backlogs, and `local/no-vendor-ui-import`
carries Ionic's. Seeding 475 more into either would make the boundaries fungible: a file allowed
_n_ violations could drop a generated-client import, add an `@ngx-translate` one, and the
ratchet would not move. `no-vendor-ui-import` exists as a separate rule for exactly this reason,
and its header records the bug that taught it.

## Consequences

- A new file importing the generated client fails CI, with a message naming this ADR.
- The 475 existing imports are legal until migrated, and `--prune-suppressions` removes each
  entry as it goes, so the number only falls.
- Migration is reviewable one domain at a time, which is how Angular Material went from 250
  files to zero here and how Ionic is going from 250 to 227.
- The generated client stays the only thing that talks to Fineract. No second HTTP path, no
  hand-written models duplicating the spec.

## Alternatives considered

- **A contract and mapper per generated service, up front** — rejected: 155 services, most
  called from one screen. That is the indirection ADR 0001 rejected, with a mapping layer added
  on top.
- **`import/no-restricted-paths`** — would work, but its rule id is shared with any future
  `import` plugin path rule, and the per-rule counter is the mechanism that makes the ratchet
  trustworthy.
- **Documentation only** — rejected: the 84% coupling has been documented since ADR 0001 and
  grew by seven files in the week this was written.
- **Do nothing, rely on `check-api-surface.mjs`** — rejected: it tracks which _operations_ are
  called, which is orthogonal. Every operation can still exist while every response shape
  changes.

## References

- [ADR 0001: stable OpenAPI operation ids](0001-stable-openapi-operation-ids.md)
- [ADR 0002: automated Fineract spec sync](0002-automated-fineract-spec-sync.md)
- [ADR 0003: the adapter boundary](0003-adapter-boundary.md)
- [ADR 0005: an application-owned UI and test boundary](0005-ui-boundary.md)
- `eslint-rules/no-generated-api-import.js`
- `scripts/check-api-surface.mjs`
