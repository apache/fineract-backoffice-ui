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

# Code Style Guide

This project follows strict engineering standards to ensure high-quality, maintainable code.

## General Principles

- **Strict Mode**: TypeScript strict mode is mandatory.
- **Standalone Components**: Use the Angular standalone component model. There are no NgModules.
- **Immutability**: Prefer immutable data patterns and `readonly` properties.
- **Signal-First**: Use Angular Signals for state management where appropriate.

## Architecture

- **Core**: Contains singleton services, interceptors, and application-wide utilities.
- **Shared**: Contains reusable components, pipes, and directives.
- **Features**: Domain-specific components organized by feature area (e.g., `clients`, `loans`).
- **Layout**: Contains top-level layout components like the header and sidebar.

## Naming Conventions

- **Components**: `kebab-case.component.ts` (e.g., `user-profile.component.ts`).
- **Services**: `kebab-case.service.ts` (e.g., `client-data.service.ts`).
- **Interfaces/Models**: `kebab-case.model.ts` (e.g., `client-summary.model.ts`).

---

## UI Components: Ionic

The UI layer is **Ionic** (`@ionic/angular` v8). Ionic is configured in `mode: 'md'`
(`src/app/app.config.ts`), so components render in Material Design styling.

> Angular Material has been removed entirely, and `npm run lint` fails on any import of it.
> The table below records vendor equivalents for UI implementations. New feature/shared code
> uses the app-owned boundary described below.
> `@angular/cdk` is retained and is fine to use for unstyled primitives (`cdk-table`, virtual
> scroll, a11y) — the shared data table is built on it.

### UI boundary

New UI dependencies belong in `src/app/ui/`. Prefer its app-owned primitives; direct Ionic
imports in existing features are a lint migration baseline. See
[ADR 0005](DOCS/adr/0005-ui-boundary.md) for component, form-value, theme and browser-test
contracts. Implementations inside `ui/` may use Ionic as described below; CDK behavioural
primitives such as `app-tabs` do not need it.

### Importing Ionic components inside UI implementations

Always import individual components from the **standalone** entry point and list them in the
component's own `imports` array. Never use `IonicModule`.

```ts
import { IonButton, IonIcon } from '@ionic/angular/standalone';

@Component({
  standalone: true,
  imports: [TranslateModule, IonButton, IonIcon],
  // ...
})
```

### Component equivalents

| Material (removed)                    | Ionic equivalent                                                         |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `mat-card`                            | `ion-card` / `ion-card-header` / `ion-card-title` / `ion-card-content`   |
| `mat-form-field` + `matInput`         | `ion-item fill="outline"` + `ion-label position="stacked"` + `ion-input` |
| `mat-select` / `mat-option`           | `ion-select` / `ion-select-option`                                       |
| `button mat-button`                   | `ion-button`                                                             |
| `button mat-icon-button` + `mat-icon` | `ion-button fill="clear"` + `ion-icon slot="icon-only"`                  |
| `mat-checkbox` / `mat-slide-toggle`   | `ion-checkbox` / `ion-toggle`                                            |
| `mat-spinner`                         | `ion-spinner`                                                            |
| `mat-progress-bar`                    | `ion-progress-bar`                                                       |
| `mat-datepicker`                      | `ion-datetime-button` + `ion-modal` + `ion-datetime` (see below)         |
| `matTooltip`                          | `[attr.title]`, or `[attr.aria-label]` on icon-only controls             |
| `MatSnackBar`                         | `NotificationService` (see below)                                        |
| `MatDialog`                           | `DialogService` (see below)                                              |
| `mat-table` + `mat-paginator`         | the shared `app-data-table`, or `cdk-table` + `app-paginator` directly   |

Ionic has **no tooltip component**. Use `[attr.title]` for hover text and always give icon-only
buttons an `[attr.aria-label]`.

### Date pickers

```html
<ion-item fill="outline">
  <ion-label position="stacked">{{ 'TELLERS.START_DATE' | translate }}</ion-label>
  <ion-datetime-button datetime="start-date-picker"></ion-datetime-button>
  <ion-modal [keepContentsMounted]="true">
    <ng-template>
      <ion-datetime
        id="start-date-picker"
        data-testid="start-date-picker"
        presentation="date"
        (ionChange)="onStartDateChange($event)"
      ></ion-datetime>
    </ng-template>
  </ion-modal>
</ion-item>
```

The `datetime` attribute on the button must match the `id` on `ion-datetime`, and
`[keepContentsMounted]="true"` is required for the value to bind before first open.

### Events

Ionic emits `CustomEvent`s. Read `detail.value`, and keep a `target.value` fallback — unit tests
dispatch plain DOM events:

```ts
onInput(event: Event): void {
  const value =
    (event as CustomEvent<{ value?: string }>).detail?.value ??
    (event.target as HTMLInputElement)?.value ??
    '';
  // ...
}
```

Bind `(ionInput)` for text entry and `(ionChange)` for selects, toggles and date pickers.

### Icons

Icons are **ionicons**, referenced by kebab-case name:

```html
<ion-icon name="create-outline" slot="icon-only"></ion-icon>
```

Every icon must be registered in `src/app/core/icons.ts`, which `src/bootstrap.ts` passes to
`addIcons()` once at startup. **An unregistered name renders as a blank space, silently.** To add
one, import it from `ionicons/icons` and add an entry to `APP_ICONS`; `icons.spec.ts` guards the
registry's integrity.

### Notifications and dialogs

Inject the services rather than Ionic's controllers directly — they keep durations, placement and
confirm semantics consistent, and they are far easier to mock in tests.

```ts
private readonly notifications = inject(NotificationService);
private readonly dialogService = inject(DialogService);

this.notifications.success(this.translate.instant('CLIENTS.SAVED'));
this.notifications.error(message); // 10s, preserves newlines in stacked API errors

const confirmed = await this.dialogService.confirm({
  title: this.translate.instant('COMMON.DELETE'),
  message: this.translate.instant('LOANS.CONFIRM_DELETE_NOTE'),
  destructive: true,
});
```

### Styling and theming

Design tokens live in `src/styles/_common.scss` (`--primary-color`, `--card-bg`, `--border-color`,
…). `src/styles/_ionic-theme.scss` maps Ionic's `--ion-color-*` and surface variables onto them, so
Ionic components inherit the Fineract palette automatically.

- Style Ionic components through their **CSS custom properties** (`--background`, `--border-radius`,
  `--padding-start`) and shadow **parts** (`::part(message)`) — not by targeting internal classes.
- Prefer the shared tokens over hard-coded colours.
- Dark mode is driven by the `[data-theme='dark']` attribute set by `ThemeService`. Do not
  introduce a second mechanism such as Ionic's `.ion-palette-dark` or a bare
  `prefers-color-scheme` query.
- Component styles are inline in the `styles: []` array. Keep them small — the production build
  errors above **8 kB per component**.

## Formatting and Linting

- **Prettier**: Run `npm run format` to apply formatting; `npm run format:check` in CI.
- **ESLint**: Run `npm run lint`. Note the `sonarjs/void-use` rule — the `void` operator is
  banned, so do not use `void somePromise()` to mark a floating promise.

## Testing

- **Runner**: Vitest (`npm test`). The `jest.config.ts` in the repo root is unused.
- **Unit Tests**: Every service and complex component should have a corresponding `test.ts`.
- **Test Coverage**: Aim for at least 80% statement coverage.
- **Ionic in TestBed**: Components that use Ionic overlays — directly, or via `NotificationService`
  / `DialogService` — need Ionic's providers, or they fail with
  `NG0201: No provider found for _ModalController`:

  ```ts
  import { provideIonicTesting } from '../../testing/ionic-testing';

  TestBed.configureTestingModule({
    imports: [MyComponent, TranslateModule.forRoot()],
    providers: [provideIonicTesting()],
  });
  ```

- **Selectors**: Give interactive elements both an `id` and a `data-testid`. The Playwright suite
  prefers `getByRole`/`getByTestId`; never write assertions against framework-internal classes.

## Internationalization (i18n)

- **No Hardcoded Strings**: All user-facing text must use translation keys and follow the project's
  i18n strategy. Run `npm run i18n:check` to verify translations are complete.
