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
import { RouterModule } from '@angular/router';
import { ENTITY_NOTES_API, TranslatePipe } from '../../../core/adapters';
import { DatePipe } from '@angular/common';
import {
  DataTableComponent,
  ColumnDef,
  HasPermissionDirective,
  CellTemplateDirective,
} from '../../../shared';
import type { EntityNote } from '../../../core/adapters';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { ButtonComponent } from '../../../ui/button/button.component';

@Component({
  selector: 'app-client-notes-list',
  standalone: true,
  imports: [
    RouterModule,
    TranslatePipe,
    DataTableComponent,
    HasPermissionDirective,
    CellTemplateDirective,
    DatePipe,
    ButtonComponent,
    TooltipDirective,
  ],
  template: `
    <div class="tab-actions">
      <app-button
        type="button"
        intent="primary"
        [link]="['/clients', clientId(), 'notes', 'create']"
        icon="add-outline"
        *appHasPermission="'CREATE_CLIENTNOTE'"
        >{{ 'CLIENTS.ADD_NOTE' | appTranslate }}</app-button
      >
    </div>

    <app-data-table
      [data]="notes()"
      [columns]="columns"
      [isLoading]="isLoading()"
      [localLogic]="true"
    >
      <ng-template appCellTemplate="createdOn" let-row>
        {{ row.createdOn | date: 'medium' }}
      </ng-template>

      <ng-template appCellTemplate="actions" let-row>
        <div class="action-buttons">
          <app-button
            type="button"
            intent="primary"
            emphasis="quiet"
            [label]="'COMMON.EDIT' | appTranslate"
            [link]="['/clients', clientId(), 'notes', 'edit', row.id]"
            icon="create-outline"
            *appHasPermission="'UPDATE_CLIENTNOTE'"
            [appTooltip]="'COMMON.EDIT' | appTranslate"
          />
          <app-button
            type="button"
            intent="danger"
            emphasis="quiet"
            [label]="'COMMON.DELETE' | appTranslate"
            icon="trash-outline"
            (click)="onDelete(row.id)"
            *appHasPermission="'DELETE_CLIENTNOTE'"
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
export class ClientNotesListComponent implements OnInit {
  readonly clientId = input.required<number>();

  private readonly notesApi = inject(ENTITY_NOTES_API);

  readonly notes = signal<EntityNote[]>([]);
  readonly isLoading = signal<boolean>(false);

  columns: ColumnDef[] = [
    {
      key: 'note',
      label: 'COMMON.NOTE',
    },
    {
      key: 'createdByUsername',
      label: 'CLIENTS.CREATED_BY',
    },
    {
      key: 'createdOn',
      label: 'CLIENTS.CREATED_ON',
    },
    {
      key: 'actions',
      label: 'COMMON.ACTIONS',
    },
  ];

  ngOnInit(): void {
    this.loadNotes();
  }

  loadNotes(): void {
    this.isLoading.set(true);
    this.notesApi.list('clients', this.clientId()).subscribe({
      next: (data: EntityNote[]) => {
        this.notes.set(data);
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        console.error('Failed to load client notes', err);
        this.isLoading.set(false);
      },
    });
  }

  onDelete(id: number): void {
    if (confirm('Are you sure you want to delete this note?')) {
      this.notesApi.remove('clients', this.clientId(), id).subscribe({
        next: () => this.loadNotes(),
        error: (err) => console.error('Failed to delete note', err),
      });
    }
  }
}
