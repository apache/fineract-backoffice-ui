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

import { Component, OnInit, inject, signal } from '@angular/core';

import { Router } from '@angular/router';
import { I18N, ROLE_API, TranslatePipe } from '../../../core/adapters';
import type { Role } from '../../../core/adapters';
import { DialogService } from '../../../core/services/dialog.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  DataTableComponent,
  ColumnDef,
  CellTemplateDirective,
  StatusBadgeComponent,
} from '../../../shared';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { ButtonComponent } from '../../../ui/button/button.component';

@Component({
  selector: 'app-roles-list',
  standalone: true,
  imports: [
    TranslatePipe,
    DataTableComponent,
    CellTemplateDirective,
    StatusBadgeComponent,
    ButtonComponent,
    HasPermissionDirective,
    TooltipDirective,
  ],
  template: `
    <app-data-table
      title="nav.roles"
      helpTextKey="HELP.ROLES_DESC"
      createButtonLabel="ROLES.CREATE"
      createPermission="CREATE_ROLE"
      [columns]="columns"
      [data]="roles()"
      [totalRecords]="roles().length"
      [showSearch]="true"
      [localLogic]="true"
      (create)="onCreateRole()"
    >
      <ng-template appCellTemplate="status" let-role>
        <app-status-badge
          [status]="role.disabled ? 'Disabled' : 'Active'"
          [attr.data-testid]="'role-status-' + role.id"
        ></app-status-badge>
      </ng-template>

      <ng-template appCellTemplate="actions" let-role>
        <app-button
          type="button"
          intent="primary"
          emphasis="quiet"
          [label]="'COMMON.EDIT' | appTranslate"
          icon="create-outline"
          [attr.data-testid]="'role-edit-' + role.id"
          [appTooltip]="'COMMON.EDIT' | appTranslate"
          (click)="onEditRole(role)"
          *appHasPermission="'UPDATE_ROLE'"
        />
        @if (role.disabled) {
          <app-button
            type="button"
            intent="secondary"
            emphasis="quiet"
            [label]="'ROLES.ENABLE' | appTranslate"
            icon="checkmark-circle-outline"
            [attr.data-testid]="'role-enable-' + role.id"
            [appTooltip]="'ROLES.ENABLE' | appTranslate"
            (click)="onSetEnabled(role, true)"
            *appHasPermission="'ENABLE_ROLE'"
          />
        } @else {
          <app-button
            type="button"
            intent="secondary"
            emphasis="quiet"
            [label]="'ROLES.DISABLE' | appTranslate"
            icon="close-circle-outline"
            [attr.data-testid]="'role-disable-' + role.id"
            [appTooltip]="'ROLES.DISABLE' | appTranslate"
            (click)="onSetEnabled(role, false)"
            *appHasPermission="'DISABLE_ROLE'"
          />
        }
        <app-button
          type="button"
          intent="danger"
          emphasis="quiet"
          [label]="'COMMON.DELETE' | appTranslate"
          icon="trash-outline"
          [attr.data-testid]="'role-delete-' + role.id"
          [appTooltip]="'COMMON.DELETE' | appTranslate"
          (click)="onDeleteRole(role)"
          *appHasPermission="'DELETE_ROLE'"
        />
      </ng-template>
    </app-data-table>
  `,
})
export class RolesListComponent implements OnInit {
  private readonly roleApi = inject(ROLE_API);
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'COMMON.NAME', sortable: true },
    { key: 'description', label: 'COMMON.DESCRIPTION', sortable: true },
    { key: 'status', label: 'COMMON.STATUS', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly roles = signal<Role[]>([]);

  ngOnInit(): void {
    this.loadRoles();
  }

  private loadRoles(): void {
    this.roleApi.list().subscribe({
      next: (roles) => this.roles.set(roles),
      error: (err) => console.error('Failed to load roles', err),
    });
  }

  onCreateRole(): void {
    this.router.navigate(['/security/roles/create']);
  }

  onEditRole(role: Role): void {
    this.router.navigate(['/security/roles/edit', role.id]);
  }

  /**
   * Switches a role off, or back on.
   *
   * Confirmed first, and not as a destructive action: disabling is reversible, and the platform
   * stops offering the role to new users while it is off. Nothing is deleted.
   */
  onSetEnabled(role: Role, enabled: boolean): void {
    void this.dialogs
      .confirm({
        title: this.i18n.translate(enabled ? 'ROLES.ENABLE' : 'ROLES.DISABLE'),
        message: this.i18n.translate(enabled ? 'ROLES.CONFIRM_ENABLE' : 'ROLES.CONFIRM_DISABLE', {
          name: role.name,
        }),
      })
      .then((confirmed) => {
        if (!confirmed) return;
        this.roleApi.setEnabled(role.id, enabled).subscribe({
          next: () => {
            void this.notifications.success(this.i18n.translate('COMMON.SUCCESS'));
            this.loadRoles();
          },
          error: () => undefined,
        });
      });
  }

  /**
   * Deletes a role.
   *
   * The platform refuses while any user still holds it, and that refusal is the useful message —
   * `errorInterceptor` reports a domain-rule 403 in the platform's own words, so the user is
   * told the role is still assigned rather than that something went wrong.
   */
  onDeleteRole(role: Role): void {
    void this.dialogs
      .confirm({
        title: this.i18n.translate('COMMON.DELETE'),
        message: this.i18n.translate('ROLES.CONFIRM_DELETE', { name: role.name }),
        destructive: true,
      })
      .then((confirmed) => {
        if (!confirmed) return;
        this.roleApi.delete(role.id).subscribe({
          next: () => {
            void this.notifications.success(this.i18n.translate('COMMON.SUCCESS'));
            this.loadRoles();
          },
          error: () => undefined,
        });
      });
  }
}
