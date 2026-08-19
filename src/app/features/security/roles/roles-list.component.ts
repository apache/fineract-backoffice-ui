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
import { TranslateModule } from '@ngx-translate/core';
import { DataTableComponent, ColumnDef, CellTemplateDirective } from '../../../shared';
import { RolesService, GetRolesResponse } from '../../../api';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';

@Component({
  selector: 'app-roles-list',
  standalone: true,
  imports: [
    TranslateModule,
    DataTableComponent,
    CellTemplateDirective,
    IonIcon,
    IonButton,
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
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'COMMON.EDIT' | translate"
          [appTooltip]="'COMMON.EDIT' | translate"
          (click)="onEditRole(role)"
        >
          <ion-icon name="create-outline"></ion-icon>
        </ion-button>
      </ng-template>
    </app-data-table>
  `,
})
export class RolesListComponent implements OnInit {
  private readonly rolesService = inject(RolesService);
  private readonly router = inject(Router);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'COMMON.NAME', sortable: true },
    { key: 'description', label: 'COMMON.DESCRIPTION', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly roles = signal<GetRolesResponse[]>([]);

  ngOnInit(): void {
    this.loadRoles();
  }

  private loadRoles(): void {
    this.rolesService.getRoles().subscribe({
      next: (data) => {
        this.roles.set(data || []);
      },
      error: (err) => console.error('Failed to load roles', err),
    });
  }

  onCreateRole(): void {
    this.router.navigate(['/security/roles/create']);
  }

  onEditRole(role: GetRolesResponse): void {
    this.router.navigate(['/security/roles/edit', role.id]);
  }
}
