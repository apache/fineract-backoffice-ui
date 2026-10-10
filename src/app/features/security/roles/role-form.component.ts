/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSpinner,
  IonTextarea,
} from '@ionic/angular/standalone';
import { I18N, ROLE_API, TranslatePipe } from '../../../core/adapters';
import type { RolePermission } from '../../../core/adapters';
import { ConfigService } from '../../../core/services/config.service';
import { DialogService } from '../../../core/services/dialog.service';
import { NavigationConfigService } from '../../../core/services/navigation-config.service';

/** A permission row as the roles endpoint reports it, narrowed to the fields this screen uses. */
/**
 * What the form holds while it is being filled. Its own shape rather than `RoleDraft`, which
 * describes a valid submission; a form in progress has neither field yet.
 */
interface RoleFormModel {
  name: string;
  description: string;
}

/**
 * Sorts a freshly built array of codes, alphabetically.
 *
 * The one place in this file that sorts. `Array#toSorted` would be the obvious call, but the
 * project targets ES2022, where it does not exist; every array reaching here is a new one built
 * by `filter`/`Object.keys`, so sorting it in place mutates nothing a caller can observe.
 */
function sortedCodes(codes: string[]): string[] {
  // eslint-disable-next-line unicorn/no-array-sort -- see above; ES2022 has no toSorted
  return codes.sort();
}

/** One navigation destination in the impact preview, already translated for display. */
interface NavImpactEntry {
  route: string;
  label: string;
  groupLabel?: string;
}

/**
 * Creates and edits system roles and their permissions.
 *
 * The permission matrix on its own answers "which codes does this role hold", which is not the
 * question an administrator is actually asking. They are asking what the people in this role
 * will be able to *do* — and a Fineract permission code is several steps removed from that.
 * So alongside the matrix this screen keeps a running preview of the pending change: the codes
 * added and removed, and, more usefully, the navigation destinations the role gains or loses
 * as a result. The preview is computed by {@link NavigationConfigService} running the same
 * gates the sidebar runs, with the pending selection substituted for the signed-in user's
 * permissions, so it cannot drift from what the sidebar will actually show.
 */
@Component({
  selector: 'app-role-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonBadge,
    IonButton,
    IonIcon,
    IonNote,
    IonSpinner,
    IonInput,
    IonTextarea,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonCheckbox,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode()
                ? ('ROLES.EDIT_ROLE' | appTranslate)
                : ('ROLES.CREATE_ROLE' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #roleForm="ngForm" (ngSubmit)="onSubmit()" class="role-form">
            <ion-item fill="outline" class="full-width">
              <ion-label position="stacked">{{ 'COMMON.NAME' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'COMMON.NAME' | appTranslate"
                name="name"
                [(ngModel)]="role().name"
                required
                [disabled]="isEditMode()"
              ></ion-input>
            </ion-item>

            <ion-item fill="outline" class="full-width">
              <ion-label position="stacked">{{ 'COMMON.DESCRIPTION' | appTranslate }}</ion-label>
              <ion-textarea
                [attr.aria-label]="'COMMON.DESCRIPTION' | appTranslate"
                name="description"
                [(ngModel)]="role().description"
                required
                rows="2"
              ></ion-textarea>
            </ion-item>

            @if (!isEditMode()) {
              <ion-note class="hint">{{
                'ROLES.PERMISSIONS_AFTER_CREATE' | appTranslate
              }}</ion-note>
            }

            @if (isEditMode()) {
              <hr class="divider" />
              <div class="permissions-section">
                <h3>{{ 'ROLES.PERMISSIONS' | appTranslate }}</h3>

                <!-- Impact preview. Rendered above the matrix rather than below it: it is
                     feedback on the edit being made, and 700 checkboxes of scrolling between
                     an action and its consequence is the same as no feedback. -->
                <div class="impact-panel" data-testid="role-impact">
                  <div class="impact-heading">
                    <ion-icon name="eye-outline"></ion-icon>
                    <strong>{{ 'ROLES.IMPACT_TITLE' | appTranslate }}</strong>
                  </div>

                  @if (!rbacEnabled()) {
                    <ion-note class="hint">{{
                      'ROLES.IMPACT_RBAC_DISABLED' | appTranslate
                    }}</ion-note>
                  }

                  @if (!hasPendingChanges()) {
                    <ion-note data-testid="role-impact-none">
                      {{ 'ROLES.IMPACT_NO_CHANGES' | appTranslate }}
                    </ion-note>
                  } @else {
                    <div class="impact-counts">
                      @if (permissionDiff().added.length) {
                        <ion-badge color="success" data-testid="perms-added">
                          {{
                            'ROLES.IMPACT_PERMISSIONS_ADDED'
                              | appTranslate: { count: permissionDiff().added.length }
                          }}
                        </ion-badge>
                      }
                      @if (permissionDiff().removed.length) {
                        <ion-badge color="danger" data-testid="perms-removed">
                          {{
                            'ROLES.IMPACT_PERMISSIONS_REMOVED'
                              | appTranslate: { count: permissionDiff().removed.length }
                          }}
                        </ion-badge>
                      }
                    </div>

                    @if (navImpact().gained.length) {
                      <div class="impact-list gained" data-testid="nav-gained">
                        <span class="impact-list-title">
                          {{ 'ROLES.IMPACT_NAV_GAINED' | appTranslate }}
                        </span>
                        <ul>
                          @for (entry of navImpact().gained; track entry.route) {
                            <li>
                              <ion-icon name="add-circle-outline" color="success"></ion-icon>
                              @if (entry.groupLabel) {
                                <span class="group">{{ entry.groupLabel }} ›</span>
                              }
                              {{ entry.label }}
                            </li>
                          }
                        </ul>
                      </div>
                    }

                    @if (navImpact().lost.length) {
                      <div class="impact-list lost" data-testid="nav-lost">
                        <span class="impact-list-title">
                          {{ 'ROLES.IMPACT_NAV_LOST' | appTranslate }}
                        </span>
                        <ul>
                          @for (entry of navImpact().lost; track entry.route) {
                            <li>
                              <ion-icon name="remove-circle-outline" color="danger"></ion-icon>
                              @if (entry.groupLabel) {
                                <span class="group">{{ entry.groupLabel }} ›</span>
                              }
                              {{ entry.label }}
                            </li>
                          }
                        </ul>
                      </div>
                    }

                    @if (!navImpact().gained.length && !navImpact().lost.length) {
                      <ion-note data-testid="nav-unchanged">
                        {{ 'ROLES.IMPACT_NAV_UNCHANGED' | appTranslate }}
                      </ion-note>
                    }
                  }
                </div>

                <ion-item fill="outline" class="full-width">
                  <ion-label position="stacked">{{
                    'ROLES.FILTER_PERMISSIONS' | appTranslate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'ROLES.FILTER_PERMISSIONS' | appTranslate"
                    name="permissionFilter"
                    [ngModel]="filter()"
                    (ngModelChange)="filter.set($event ?? '')"
                    [ngModelOptions]="{ standalone: true }"
                  ></ion-input>
                </ion-item>

                <div class="matrix-container">
                  @for (group of visibleGroups(); track group.prefix) {
                    <div class="permission-group">
                      <div class="group-header">
                        <strong>{{ group.prefix }}</strong>
                        <div class="group-actions">
                          <ion-button fill="clear" type="button" (click)="toggleGroup(group, true)">
                            {{ 'COMMON.CHECK_ALL' | appTranslate }}
                          </ion-button>
                          <ion-button
                            fill="clear"
                            type="button"
                            (click)="toggleGroup(group, false)"
                          >
                            {{ 'COMMON.UNCHECK_ALL' | appTranslate }}
                          </ion-button>
                        </div>
                      </div>
                      <div class="group-items">
                        @for (perm of group.items; track perm.code) {
                          <div class="permission-item">
                            <!--
                              Labelled and named by the trimmed label, while the model is keyed
                              by the code in Fineract's own spelling. Five codes in the
                              catalogue carry a trailing space; see RolePermission.
                            -->
                            <ion-checkbox
                              [name]="'perm_' + perm.label"
                              [ngModel]="selected()[perm.code]"
                              (ngModelChange)="setPermission(perm.code, $event)"
                            >
                              {{ perm.label }}
                            </ion-checkbox>
                          </div>
                        }
                      </div>
                    </div>
                  } @empty {
                    <ion-note data-testid="no-permissions-match">
                      {{ 'ROLES.NO_PERMISSIONS_MATCH' | appTranslate }}
                    </ion-note>
                  }
                </div>
              </div>
            }

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button color="primary" type="submit" [disabled]="roleForm.invalid || isSaving()">
                @if (isSaving()) {
                  <ion-spinner name="crescent"></ion-spinner>
                  {{ 'COMMON.SAVING' | appTranslate }}
                } @else {
                  {{ 'COMMON.SAVE' | appTranslate }}
                }
              </ion-button>
            </div>
          </form>
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .form-container {
        padding: 24px;
        max-width: 1000px;
        margin: 0 auto;
      }
      .role-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .full-width {
        width: 100%;
      }
      .hint {
        display: block;
        font-size: 13px;
      }
      .permissions-section {
        margin-top: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .impact-panel {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 14px 16px;
        border: 1px solid var(--ion-color-step-150, #e0e0e0);
        border-radius: 6px;
        background: var(--ion-color-step-50, #fafafa);
      }
      .impact-heading {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .impact-counts {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .impact-list-title {
        font-size: 13px;
        font-weight: 600;
      }
      .impact-list ul {
        margin: 6px 0 0;
        padding-left: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .impact-list li {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
      }
      .impact-list .group {
        color: var(--ion-color-medium, #777);
      }
      .matrix-container {
        display: flex;
        flex-direction: column;
        gap: 24px;
        max-height: 600px;
        overflow-y: auto;
        padding: 16px;
        border: 1px solid var(--ion-color-step-150, #eee);
        border-radius: 4px;
      }
      .permission-group {
        display: flex;
        flex-direction: column;
        gap: 12px;
        border-bottom: 1px dashed var(--ion-color-step-150, #eee);
        padding-bottom: 16px;
      }
      .permission-group:last-child {
        border-bottom: none;
      }
      .group-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: var(--ion-color-step-50, #f8f9fa);
        padding: 4px 12px;
        border-radius: 4px;
      }
      .group-actions {
        display: flex;
        gap: 8px;
      }
      .group-actions button {
        font-size: 11px;
        height: 24px;
        line-height: 24px;
        padding: 0 8px;
      }
      .group-items {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 8px;
        padding: 0 12px;
      }
    `,
  ],
})
export class RoleFormComponent implements OnInit {
  private readonly roleApi = inject(ROLE_API);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly navigationConfig = inject(NavigationConfigService);
  private readonly dialogService = inject(DialogService);
  private readonly config = inject(ConfigService);
  private readonly i18n = inject(I18N);

  private readonly LIST_PATH = '/security/roles';

  roleId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly role = signal<RoleFormModel>({ name: '', description: '' });
  readonly permissions = signal<RolePermission[]>([]);

  /** Whether this deployment gates navigation at all — see `AppConfig.rbacEnabled`. */
  readonly rbacEnabled = this.config.rbacEnabled;

  /**
   * The pending selection, keyed by permission code.
   *
   * A signal rather than the plain object it replaced, because the impact preview is derived
   * from it: with a mutated object the panel would only refresh when something else happened
   * to trigger change detection.
   */
  readonly selected = signal<Record<string, boolean>>({});

  /** Codes the role held when the screen loaded — the baseline every diff is taken against. */
  private readonly baseline = signal<ReadonlySet<string>>(new Set<string>());

  /** Free-text filter over permission codes. */
  readonly filter = signal('');

  readonly groupedPermissions = signal<{ prefix: string; items: RolePermission[] }[]>([]);

  /** Groups narrowed by {@link filter}; groups left with no match drop out entirely. */
  readonly visibleGroups = computed(() => {
    const needle = this.filter().trim().toUpperCase();
    if (!needle) {
      return this.groupedPermissions();
    }
    return this.groupedPermissions()
      .map((group) => ({
        prefix: group.prefix,
        items: group.items.filter((perm) => perm.label.toUpperCase().includes(needle)),
      }))
      .filter((group) => group.items.length > 0);
  });

  /**
   * Codes selected right now, in Fineract's own spelling — what the PUT must carry.
   *
   * Not what the navigation preview wants: that compares against the codes routes declare,
   * which are trimmed. `destinationsFor` does that trim, and is the only place that does.
   */
  private readonly selectedCodes = computed(() =>
    Object.entries(this.selected())
      .filter(([, isSelected]) => isSelected)
      .map(([code]) => code),
  );

  /** Codes gained and lost relative to {@link baseline}. */
  readonly permissionDiff = computed(() => {
    const base = this.baseline();
    const selected = new Set(this.selectedCodes());
    return {
      added: sortedCodes([...selected].filter((code) => !base.has(code))),
      removed: sortedCodes([...base].filter((code) => !selected.has(code))),
    };
  });

  readonly hasPendingChanges = computed(
    () => this.permissionDiff().added.length > 0 || this.permissionDiff().removed.length > 0,
  );

  /**
   * Navigation destinations the role gains and loses under the pending selection.
   *
   * Both sides come from the same service the sidebar uses, so this is the sidebar's own answer
   * asked twice rather than a reimplementation of its rules.
   */
  readonly navImpact = computed<{ gained: NavImpactEntry[]; lost: NavImpactEntry[] }>(() => {
    if (!this.hasPendingChanges()) {
      return { gained: [], lost: [] };
    }
    const before = this.destinationsFor([...this.baseline()]);
    const after = this.destinationsFor(this.selectedCodes());
    const beforeRoutes = new Set(before.map((entry) => entry.route));
    const afterRoutes = new Set(after.map((entry) => entry.route));
    return {
      gained: after.filter((entry) => !beforeRoutes.has(entry.route)),
      lost: before.filter((entry) => !afterRoutes.has(entry.route)),
    };
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.roleId = +id;
        this.isEditMode.set(true);
        this.loadRoleData();
      }
    });
  }

  /**
   * The sidebar's own answer for a set of permission codes.
   *
   * Trims on the way in, which is the **read** side of the trailing-space problem and the side
   * where trimming is right: `AuthService.hasPermission()` and every route's `data.permissions`
   * use the trimmed spelling, so a padded code compared against them would match nothing and
   * the preview would under-report what the role gains. Writing a trimmed code back is the
   * other side, and is what `RolePermission` exists to prevent.
   */
  private destinationsFor(codes: string[]): NavImpactEntry[] {
    const trimmed = codes.map((code) => code.trim());
    return this.navigationConfig.navDestinationsForPermissions(trimmed).map((entry) => ({
      route: entry.route,
      label: this.i18n.translate(entry.labelKey),
      groupLabel: entry.groupLabelKey ? this.i18n.translate(entry.groupLabelKey) : undefined,
    }));
  }

  private loadRoleData(): void {
    if (!this.roleId) return;
    this.roleApi.get(this.roleId).subscribe((role) => {
      this.role.set({ name: role.name, description: role.description });
      this.loadPermissions();
    });
  }

  private loadPermissions(): void {
    if (!this.roleId) return;
    this.roleApi.permissions(this.roleId).subscribe((rows) => {
      this.permissions.set(rows);

      const selected: Record<string, boolean> = {};
      for (const row of rows) {
        selected[row.code] = row.selected;
      }
      this.selected.set(selected);
      this.baseline.set(new Set(rows.filter((row) => row.selected).map((row) => row.code)));

      this.groupPermissions();
    });
  }

  private groupPermissions(): void {
    const groups: Record<string, RolePermission[]> = {};
    this.permissions().forEach((perm) => {
      // Grouped by the entity half of the trimmed label: READ_LOAN -> LOAN. The padded code
      // would put a trailing space in the group heading.
      const prefix = perm.label.split('_', 2)[1] || 'GENERAL';
      if (!groups[prefix]) groups[prefix] = [];
      groups[prefix].push(perm);
    });

    this.groupedPermissions.set(
      sortedCodes(Object.keys(groups)).map((prefix) => ({ prefix, items: groups[prefix] })),
    );
  }

  setPermission(code: string, isSelected: boolean): void {
    this.selected.update((current) => ({ ...current, [code]: isSelected }));
  }

  toggleGroup(group: { items: RolePermission[] }, value: boolean): void {
    this.selected.update((current) => {
      const next = { ...current };
      for (const perm of group.items) {
        next[perm.code] = value;
      }
      return next;
    });
  }

  async onSubmit(): Promise<void> {
    if (this.isEditMode() && this.roleId) {
      if (this.hasPendingChanges() && !(await this.confirmPermissionChange())) {
        return;
      }
      this.saveExistingRole(this.roleId);
      return;
    }
    this.createRole();
  }

  /**
   * Restates the pending change before it is written.
   *
   * The matrix makes each individual click cheap, which is exactly why the total is worth
   * showing once: revoking a permission takes effect for everyone in the role, and nothing
   * tells them it happened.
   */
  private confirmPermissionChange(): Promise<boolean> {
    const { added, removed } = this.permissionDiff();
    const { gained, lost } = this.navImpact();

    const details = [
      { label: this.i18n.translate('ROLES.IMPACT_ADDED'), value: String(added.length) },
      { label: this.i18n.translate('ROLES.IMPACT_REMOVED'), value: String(removed.length) },
    ];
    if (gained.length) {
      details.push({
        label: this.i18n.translate('ROLES.IMPACT_NAV_GAINED'),
        value: gained.map((entry) => entry.label).join(', '),
      });
    }
    if (lost.length) {
      details.push({
        label: this.i18n.translate('ROLES.IMPACT_NAV_LOST'),
        value: lost.map((entry) => entry.label).join(', '),
      });
    }

    return this.dialogService.confirm({
      title: this.i18n.translate('ROLES.CONFIRM_PERMISSIONS_TITLE'),
      message: this.i18n.translate('ROLES.CONFIRM_PERMISSIONS_MESSAGE', {
        name: this.role().name ?? '',
      }),
      details,
      destructive: removed.length > 0,
    });
  }

  private saveExistingRole(roleId: number): void {
    this.isSaving.set(true);
    const selected = this.selected();
    // Built from the rows the contract answered, so each key is Fineract's own spelling of the
    // code rather than the label the matrix displays. Handing over the display spelling is what
    // made this request answer 404 for every role; see RolePermission.
    const selection = this.permissions().map((perm) => ({
      code: perm.code,
      selected: selected[perm.code] === true,
    }));

    this.roleApi.update(roleId, { description: this.role().description }).subscribe({
      next: () => {
        this.roleApi.setPermissions(roleId, selection).subscribe({
          next: () => {
            void this.router.navigate([this.LIST_PATH]);
          },
          error: () => this.isSaving.set(false),
        });
      },
      error: () => this.isSaving.set(false),
    });
  }

  /**
   * Creates the role, then opens it for editing rather than returning to the list.
   *
   * `POST /roles` takes a name and a description only — permissions are a separate PUT — so a
   * new role always starts with none. Landing back on the list leaves the administrator to
   * notice that and find the role again; landing on its permission matrix is the next step
   * they were always going to take.
   */
  private createRole(): void {
    this.isSaving.set(true);
    this.roleApi.create(this.role()).subscribe({
      next: (roleId) => {
        void this.router.navigate([this.LIST_PATH, 'edit', roleId]);
      },
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
