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
import { ROLE_API, TranslatePipe } from '../../../core/adapters';
import type { Role } from '../../../core/adapters';
import { DataTableComponent, ColumnDef, CellTemplateDirective } from '../../../shared';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { ButtonComponent } from '../../../ui/button/button.component';

@Component({
  selector: 'app-roles-list',
  standalone: true,
  imports: [
    TranslatePipe,
    DataTableComponent,
    CellTemplateDirective,
    ButtonComponent,
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
      <ng-template appCellTemplate="actions" let-role>
        <app-button
          type="button"
          intent="primary"
          emphasis="quiet"
          [label]="'COMMON.EDIT' | appTranslate"
          icon="create-outline"
          [appTooltip]="'COMMON.EDIT' | appTranslate"
          (click)="onEditRole(role)"
        />
      </ng-template>
    </app-data-table>
  `,
})
export class RolesListComponent implements OnInit {
  private readonly roleApi = inject(ROLE_API);
  private readonly router = inject(Router);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'COMMON.NAME', sortable: true },
    { key: 'description', label: 'COMMON.DESCRIPTION', sortable: true },
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
}
