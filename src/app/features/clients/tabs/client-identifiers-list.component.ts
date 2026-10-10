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

import { inject, input, signal, Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { TranslatePipe } from '../../../core/adapters';
import {
  DataTableComponent,
  ColumnDef,
  HasPermissionDirective,
  CellTemplateDirective,
} from '../../../shared';
import { ClientIdentifierService, ClientIdentifierData } from '../../../api';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { ButtonComponent } from '../../../ui/button/button.component';

@Component({
  selector: 'app-client-identifiers-list',
  standalone: true,
  imports: [
    RouterModule,
    TranslatePipe,
    DataTableComponent,
    HasPermissionDirective,
    CellTemplateDirective,
    ButtonComponent,
    TooltipDirective,
  ],
  template: `
    <div class="tab-actions">
      <app-button
        type="button"
        intent="primary"
        [link]="['/clients', clientId(), 'identifiers', 'create']"
        icon="add-outline"
        *appHasPermission="'CREATE_CLIENTIDENTIFIER'"
        >{{ 'CLIENTS.ADD_IDENTIFIER' | appTranslate }}</app-button
      >
    </div>

    <app-data-table
      [data]="identifiers()"
      [columns]="columns"
      [isLoading]="isLoading()"
      [localLogic]="true"
    >
      <ng-template appCellTemplate="actions" let-row>
        <div class="action-buttons">
          <app-button
            type="button"
            intent="primary"
            emphasis="quiet"
            [label]="'COMMON.EDIT' | appTranslate"
            [link]="['/clients', clientId(), 'identifiers', 'edit', row.id]"
            icon="create-outline"
            *appHasPermission="'UPDATE_CLIENTIDENTIFIER'"
            [appTooltip]="'COMMON.EDIT' | appTranslate"
          />
          <app-button
            type="button"
            intent="danger"
            emphasis="quiet"
            [label]="'COMMON.DELETE' | appTranslate"
            icon="trash-outline"
            (click)="onDelete(row.id)"
            *appHasPermission="'DELETE_CLIENTIDENTIFIER'"
            [appTooltip]="'COMMON.DELETE' | appTranslate"
          />
        </div>
      </ng-template>
    </app-data-table>
  `,
  styles: [
    `
      .tab-actions {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 16px;
      }
      .action-buttons {
        display: flex;
        gap: 8px;
      }
    `,
  ],
})
export class ClientIdentifiersListComponent implements OnInit {
  readonly clientId = input.required<number>();

  private readonly identifierService = inject(ClientIdentifierService);
  private readonly router = inject(Router);

  readonly identifiers = signal<ClientIdentifierData[]>([]);
  readonly isLoading = signal<boolean>(false);

  columns: ColumnDef[] = [
    {
      key: 'documentType.name',
      label: 'CLIENTS.DOCUMENT_TYPE',
    },
    {
      key: 'documentKey',
      label: 'CLIENTS.DOCUMENT_KEY',
    },
    {
      key: 'description',
      label: 'COMMON.DESCRIPTION',
    },
    {
      key: 'status',
      label: 'COMMON.STATUS',
    },
    {
      key: 'actions',
      label: 'COMMON.ACTIONS',
    },
  ];

  ngOnInit(): void {
    this.loadIdentifiers();
  }

  loadIdentifiers(): void {
    this.isLoading.set(true);
    this.identifierService.getClientsClientIdIdentifiers(this.clientId()).subscribe({
      next: (data) => {
        this.identifiers.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load client identifiers', err);
        this.isLoading.set(false);
      },
    });
  }

  onDelete(id: number): void {
    if (confirm('Are you sure you want to delete this identifier?')) {
      this.identifierService
        .deleteClientsClientIdIdentifiersIdentifierId(this.clientId(), id)
        .subscribe({
          next: () => this.loadIdentifiers(),
          error: (err) => console.error('Failed to delete identifier', err),
        });
    }
  }
}
