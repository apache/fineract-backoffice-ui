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

# Adapters

Day-to-day use of `src/app/core/adapters/`. `DOCS/adr/0003-adapter-boundary.md` records why
the boundary exists; this is what to do at a keyboard.

## The library adapters

| Token      | Import instead of                         | Usually reached through                |
| ---------- | ----------------------------------------- | -------------------------------------- |
| `I18N`     | `TranslateService`, `\| translate`        | directly, or `\| appTranslate`         |
| `OVERLAY`  | `ToastController`, `ModalController`      | `NotificationService`, `DialogService` |
| `STORAGE`  | `localStorage`, `sessionStorage`          | directly                               |
| `DOWNLOAD` | `URL.createObjectURL` + a download anchor | directly                               |

All four resolve without a provider. You inject the token and it works, in the app and in a
TestBed alike.

A fifth boundary, `ADR 0006`, works the same way but answers a different question — see
[The generated API client](#the-generated-api-client) below. The four above isolate a _library_
this application might one day replace. That one isolates a _payload shape_ nobody here
controls.

```ts
import { I18N, STORAGE, DOWNLOAD } from '../../core/adapters';

private readonly i18n = inject(I18N);
private readonly storage = inject(STORAGE);
private readonly download = inject(DOWNLOAD);
```

## Translation

In a template, swap the pipe and its import:

```ts
// before
import { TranslatePipe } from '@ngx-translate/core';
imports: [TranslatePipe],
// {{ 'LOANS.APPROVE' | translate }}

// after
import { TranslatePipe } from '../../core/adapters';
imports: [TranslatePipe],
// {{ 'LOANS.APPROVE' | appTranslate }}
```

In TypeScript, `translate.instant(key)` becomes `i18n.translate(key)`. The language is a
signal (`i18n.currentLang()`), so a template that switches on it re-renders without a
subscription.

`translate()` returns the key itself when there is no translation — never an empty string. A
blank label in a banking UI is indistinguishable from a field with no value, whereas a visible
`LOANS.APPROVE` diagnoses itself.

Use `translateAsync()` when the call runs before the HTTP-loaded catalogue has arrived, which
in practice means bootstrap.

## Overlays

Prefer `NotificationService` and `DialogService` — they sit on `OVERLAY` and carry the
project's duration, styling and `app-dialog` conventions. Reach for `OVERLAY` directly only
when writing something at that level.

```ts
await this.dialogService.open<Result>(MyDialogComponent, { data });

// When you must be able to take the dialog down yourself:
const handle = await this.dialogService.present<boolean>(WarningComponent, undefined, {
  dismissible: false,
});
await handle.dismiss();
```

`dismissible: false` covers backdrop **and** Escape. Ionic splits those across two flags; the
contract has one, because no caller has wanted them to disagree.

## Storage

Every key is declared in `core/adapters/storage/storage-keys.ts`. The type admits nothing
else, so **adding a key means editing that file** — which is the point: it is the reviewable
inventory of what this origin persists (`security.md` §4).

```ts
this.storage.write('session', normalized); // JSON
this.storage.read<UserSession | null>('session', null);
this.storage.writeRaw('tenant', tenantId); // plain string
this.storage.clearScope('session'); // everything tab-scoped
```

Two behaviours worth relying on:

- **Reads never throw.** A value that will not parse reads as absent and you get your
  fallback. `AuthService` previously parsed unguarded, so one bad character in
  `fineract_session` left the app blank at bootstrap with no route to the login page.
- **Writes never throw.** Safari Private Browsing has a zero quota and enterprise policy can
  deny an origin storage outright. Persistence is lost; the tab keeps working.

Choose the scope by lifetime, not by API: `session` is the tab, `device` survives restarts and
is shared across tabs.

## Downloads

```ts
this.download.save(blob, doc?.fileName ?? 'document');
this.download.saveText(csv, 'Report.csv', 'text/csv;charset=utf-8;');
```

Filenames are sanitised, so a server-supplied one can be passed straight through: the basename
is taken (`../../etc/passwd` → `passwd`), characters Windows refuses are replaced, spaces are
kept, and an over-long name is truncated with its extension intact. The object URL is revoked
in a `finally`, so a failure part-way through does not leak it.

## Testing

```ts
import { provideFakeAdapters } from '../../testing/adapters';

const fakes = provideFakeAdapters();
TestBed.configureTestingModule({ providers: [...fakes.providers] });

// assert on what the code asked for, not on what a library rendered
expect(fakes.overlay.lastModal!.dismissible).toBe(false);
expect(fakes.storage.readRaw('theme')).toBe('dark');
expect(fakes.download.lastSaved!.filename).toBe('Report.csv');
```

A spec using the fakes needs neither `provideIonicTesting()` nor a translation catalogue.
Prefer this to mocking `ModalController` or spying on `localStorage`: the fake asserts on the
request the code made, which is the thing the code is responsible for.

## Adding an adapter

Follow the shape of the existing four:

1. `contract.adapter.ts` — the interface, plus an `InjectionToken` with
   `providedIn: 'root'` and a factory pointing at the default implementation.
2. `impl.adapter.ts` — one class, `@Injectable({ providedIn: 'root' })`, importing its
   contract with **`import type`**. The token names the class, so a value import back would
   close a runtime cycle.
3. Export both from `core/adapters/index.ts`.
4. Add the restriction to `eslint.config.js` and record the existing violations with
   `npx eslint src --suppressions-location eslint-suppressions.json --suppress-rule <rule>`.
5. Add a fake to `src/app/testing/adapters.ts`.

State the contract in terms of what the application needs, not what the library offers.
`I18nAdapter` has nine members because that is what a count of the call sites found, not
because `TranslateService` has thirty.

## The generated API client

`src/app/api` is regenerated from Fineract's OpenAPI spec. Importing it outside
`src/app/core/adapters/api/` fails `npm run lint`
(`local/no-generated-api-import`); the 429 imports that already do are recorded in
`eslint-suppressions.json` and that number may only fall. ADR 0006 has the reasoning.

There is still **no facade over the 155 generated services**, and adding one is still rejected.
What the boundary asks for is narrower: when you touch a screen, consider giving its domain a
contract and a mapper, and leave the rest alone.

`accounting-closure.api.ts` is the worked example. The shape of it:

```ts
// What the application means by a closed period — not what the generator emits.
export interface AccountingClosure {
  readonly id: number; // non-optional: the generated type marks everything optional
  readonly closingDate: string | null; // absent is null, never undefined
  readonly isClosed: boolean; // derived once, in a tested mapper
}

export interface AccountingClosureApi {
  list(): Observable<AccountingClosure[]>;
  create(closure: NewAccountingClosure): Observable<void>;
  remove(id: number): Observable<void>;
}

export const ACCOUNTING_CLOSURE_API = new InjectionToken<AccountingClosureApi>(/* … */);
```

Three rules it follows, each for a reason worth repeating:

1. **The model is not the generated type renamed.** Every field on a generated response is
   optional, because the spec marks nothing required. The screen built on
   `GetGlClosureResponse` read an `isClosed` that no payload contains and rendered every closed
   period as "Open" — through an untyped `ng-template` context, so `strictTemplates` could not
   see it. Non-optional fields and `null` for absence are what make that a compile error.
2. **Transport details stay in the adapter.** The closure form used to set `dateFormat` and
   `locale` on the request object, so a screen knew how Fineract parses dates. The adapter owns
   that now.
3. **Specs mock the contract, not the generated service.** A fixture built from a generated type
   inherits the spec's blind spots, and will happily confirm a screen that is broken in a
   browser. Mapping is tested where mapping happens.

### A second example: when the generated type is simply wrong

`office.api.ts` is the same pattern against a worse disagreement. `GetOfficesResponse` declares
`openingDate?: string`; Fineract sends `[2009, 1, 1]`. It also omits `parentId` and `parentName`,
which the payload carries. Issue #653 has the captured responses.

The application already knew, 35 times over — `formatArrayDate()` takes `unknown` because the
declared type cannot be used, fixtures wrote `openingDate: [2026, 6, 16] as unknown as number[]`
to get a realistic value past the compiler, and `offices-list.component.ts` carried a third
inline copy of the conversion. The adapter writes the disagreement down as a type:

```ts
type OfficePayload = Omit<GetOfficesResponse, 'openingDate'> & {
  readonly openingDate?: string | number[]; // declared string, sent as [y, m, d]
  readonly parentId?: number; // sent, never declared
  readonly parentName?: string;
};
```

`Omit` is needed because declaring `string | number[]` on a subtype of a `string` field is not a
legal override — TypeScript stating, correctly, that the generated type and the payload are not
compatible.

`Office.openingDate` is then an ISO string everywhere downstream, and `toIsoFineractDate()`
accepts both forms, so a corrected spec upstream needs no change here. It returns `null` rather
than `formatArrayDate()`'s `'-'`: a placeholder stored as data cannot be sorted or compared, and
it hides the difference between "no opening date" and "a date we failed to read". Turning null
into a dash stays the view's job.

### A third example: reach without a defect

`entity-notes.api.ts` is the one contract here that does _not_ correct a disagreement. Notes
agree with their generated type — `createdOn` is declared `string` and really is an ISO-8601
timestamp with offset, verified against a running instance.

It earns its place on reach and on one type. Notes are read from client, group, loan and savings
screens, and Fineract serves all four from one templated path, `/{resourceType}/{resourceId}/notes`.
Both the generated client and `EntityNotesComponent.resourceType` typed that segment as a bare
`string`, so a typo was a runtime 404 on a tab that rendered empty. `NoteResourceType` is a
closed union of the four values actually used, which makes the same mistake a compile error.

Two things fell out of it that are worth noticing, because they are the kind of thing a contract
quietly fixes:

- `group-note-form` carried a comment explaining why its save had to be `Observable<unknown>` —
  the generated create and update resolve to different response models, and the union of the two
  overload sets has no callable `subscribe`. Both are `Observable<void>` on the contract, so the
  workaround is gone.
- `client-notes-list`'s spec had `createdOn: 1_757_000_000_000` — epoch millis, which is neither
  what the generated type declares nor what Fineract sends. It reached the component through an
  `as unknown as Observable<never>` cast, so nothing checked it. Typed fixtures have to be real.

### A fourth example: one payload, two generated types, both wrong

`loan.api.ts` and `loan-transaction.api.ts` cover the domain with the most consumers, and the
disagreements are the clearest yet. All verified against a running instance.

`GetLoansLoanIdStatus` does not declare `value`, which every loan status carries, and does
declare `description`, which no payload sends. The application had been reaching around it in
eight places, two of them like this:

```ts
return (status as unknown as Record<string, unknown>)?.['value'] === 'Approved';
```

A cast like that is worse than ugly: it compiles whatever the payload does. The day `value`
goes away it keeps compiling, silently answers `false`, and a button stops being offered with
nothing to show why.

The loans list did the same comparison in a template, and that one was a live defect:

```html
@if (loan.status?.value === 'Approved') {
<!-- offers Disburse -->
}
```

`value` comes from a localisable enum, so a platform serving any other locale offered neither
Approve nor Disburse. Nothing caught it: the buttons sit in an `<ng-template appCellTemplate>`
whose `let-loan` context is `any`, so `strictTemplates` never checked a field the generated
model does not declare. `Loan.status` carries Fineract's own flags —
`pendingApproval`, `waitingForDisbursal`, `active` — and the gates read those instead.

**Branch on the flags or the `code`, never on `value`.** `value` is display text, and the model
keeps it under that name only so `StatusLike` in `shared/components/status-badge` still matches.

Transactions show the same thing twice over. The generated client has _two_ types for one
payload: `GetLoansLoanIdLoanTransactionEnumData` declares `value`, and `GetLoansType` — used on
the single-transaction response — does not, declaring `description` instead. `date` is declared
`string` on both and arrives as `[2026, 10, 2]`, which left one dialog converting it twice, two
different ways, both through a cast or an `unknown`. `LoanTransaction.date` is an ISO string and
`type.displayName` is just a string.

One more field worth naming, because it is the kind a cast hides: `GetPaymentTypeOptions`
declares `id`, `name` and `position`, while the payload also carries `description`,
`isCashPayment`, `isSystemDefined` and — on system-defined types only — `codeName`. The
chargeback dialog selects its default payment type by `codeName` and had to write
`(o as { codeName?: string }).codeName` to reach it. That lookup does work today, which is the
point: nothing was checking whether it still would.

### A fifth example: the Organization area, and five copies of one conversion

`staff.api.ts` and `holiday.api.ts` finish what `office.api.ts` started — offices, staff and
holidays are one domain in Fineract's model, all scoped by office — and between them they show
both directions the generated types can be wrong in.

**Holidays** are the familiar direction, three times over. `GetHolidaysResponse` declares
`fromDate`, `toDate` and `repaymentsRescheduledTo` as `string`; all three arrive as
`[year, month, day]`. `description` and `reschedulingType` are sent and not declared at all,
which left the form recovering the rescheduling rule by checking whether a reschedule date
happened to be set. And `PutHolidaysHolidayIdRequest` declares only `name` and `description`
while the endpoint accepts everything the form sends — verified against a running instance,
which answers with the dates in its `changes` block — so the form cast a
`Record<string, unknown>` to a type that declared none of it.

That domain is also where the cost of leaving conversion to each screen became impossible to
miss. Before these adapters, `toIsoFineractDate`'s logic existed in **five** places: the shared
helper, `formatArrayDate` in `core/utils/date-formatter.ts`, a local `formatArrayDate` method on
`holidays-list.component.ts`, `pickerDate` in `holiday-form.component.ts` (the same function
rewritten line for line), and inline in `transaction-detail-dialog.component.ts`. Every one of
them takes `unknown` or widens, because the declared type cannot be used.

**Staff** are the other direction, and worth reading carefully, because the lesson is not the
obvious one. `StaffData` declares `joiningDate?: string` and that is **correct** —
`GET /staff/{id}` really does send a string. But `GET /offices` sends an array for the same kind
of field, so the application distrusted the type that happened to be right:

```ts
this.joiningDate.set(formatArrayDate(data.joiningDate));
```

`formatArrayDate()` answers `'-'` for anything that is not an array, so the staff edit form
displayed a dash where the joining date should be. Its spec passed throughout, on a fixture
that invented `joiningDate: [2026, 1, 5]`.

So the rule is not "trust the generated type" and not "distrust it" — it is that **a screen
cannot tell from the type which encoding it is getting, and should not have to.**
`toIsoFineractDate()` accepts both, and the model is an ISO string either way.

Two things these adapters took off their screens that are worth copying:

- **Blank optional fields.** Sending `mobileNo: ''` is not an omission; Fineract rejects the
  whole submission with "mobileNo must contain only digits", naming a field the user left empty.
  `staff-form` had a `withoutBlanks()` helper for this. The adapter promises it instead, and its
  spec asserts the key is absent rather than merely falsy — an `undefined` under a present key
  would pass a truthiness check while still being a key the adapter said it would not send.
- **Returning what the caller needs.** `OfficeApi.create` answers the new office's id, because
  `create-office-dialog` dismisses with it so the form that opened it can select the office just
  created. A `void` there is invisible to the dialog's own spec, which mocks the contract — it
  took a mutation test on the adapter to catch it.

### A sixth example: reach, and a date the screen was turning into a dash

`teller.api.ts` covers tellers and the cashiers allocated to them. Its generated type is not
wrong about the teller's start date: `GET /tellers` sends `"startDate":"2026-10-02"`, which is
what `GetTellersResponse` declares. The defect was on the screens, in two forms.

- The teller and cashier lists ran that string through an array-only converter. It answers `'-'`
  for anything that is not `[y, m, d]`, so every Start Date column showed a dash.
- The edit form read the start date as an array. `new Date('2026-10-02'[0], '2026-10-02'[1] - 1,
'2026-10-02'[2])` builds 1901-12-02, and the update saved that. Editing any teller moved its
  start date back more than a century, and nothing on screen showed it, because the picker is not
  bound to the field in edit mode.

Both are the same lesson as the staff case above: the screen should not be choosing an encoding.
`mapTeller` and `mapCashier` read either form through `toIsoFineractDate()`, and the edit form
loads the ISO date into a local `Date` and sends back what it was given.

Two things worth copying from it:

- **The contract is wider than the first caller list suggested.** The issue that scoped this
  listed `list`, `get`, `create`, `update`, `listCashiers` and `createCashier`. The cashier
  transaction screens also called the generated client, so the contract carries the template,
  summary, allocation and settlement operations too. A contract that leaves its own domain's
  screens on the generated client is not a boundary.
- **Each endpoint keeps its own date format, and the adapter writes it.** Teller and cashier
  writes send `yyyy-MM-dd`; cash transactions send `dd MMMM yyyy`. Both are declared in
  `fineract-teller.api.ts` beside the call that uses them, because Fineract parses strictly
  against the format it is told.

## What is deliberately not adapted

- **`<ion-*>` components.** They are the UI layer (`AGENTS.md`), 227 files, and migrate one
  component at a time. Only Ionic's imperative controllers are behind the boundary.
- **A contract per generated service.** 155 services, most called from one screen. ADR 0001
  rejected that facade on maintenance cost and ADR 0006 keeps the rejection. A contract earns
  its place by removing a coupling that has cost something.
- **RxJS.** An Angular peer dependency, and wrapping `Observable` would mean wrapping the
  framework.
- **`@angular/cdk`.** Deliberately retained when Angular Material was removed: it is the
  unstyled-primitives package, versioned with Angular itself, and `src/app/ui/` is built on it.
- **`@angular/*` generally.** The framework is not a swappable dependency. ADR 0003 draws the
  boundary around libraries that could be replaced without rewriting the application, and
  Angular is not one of them.
