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
import { TranslateModule } from '@ngx-translate/core';
import { DatePipe } from '@angular/common';
import {
  DataTableComponent,
  ColumnDef,
  HasPermissionDirective,
  CellTemplateDirective,
} from '../../../shared';
import { NotesService, NoteData } from '../../../api';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';

@Component({
  selector: 'app-client-notes-list',
  standalone: true,
  imports: [
    RouterModule,
    TranslateModule,
    DataTableComponent,
    HasPermissionDirective,
    CellTemplateDirective,
    DatePipe,
    IonIcon,
    IonButton,
    TooltipDirective,
  ],
  template: `
    <div class="tab-actions">
      <ion-button
        color="primary"
        [routerLink]="['/clients', clientId(), 'notes', 'create']"
        *appHasPermission="'CREATE_NOTE'"
      >
        <ion-icon name="add-outline"></ion-icon>
        {{ 'CLIENTS.ADD_NOTE' | translate }}
      </ion-button>
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
          <ion-button
            fill="clear"
            color="primary"
            [routerLink]="['/clients', clientId(), 'notes', 'edit', row.id]"
            *appHasPermission="'UPDATE_NOTE'"
            [attr.aria-label]="'COMMON.EDIT' | translate"
            [appTooltip]="'COMMON.EDIT' | translate"
          >
            <ion-icon name="create-outline"></ion-icon>
          </ion-button>
          <ion-button
            fill="clear"
            color="danger"
            (click)="onDelete(row.id)"
            *appHasPermission="'DELETE_NOTE'"
            [attr.aria-label]="'COMMON.DELETE' | translate"
            [appTooltip]="'COMMON.DELETE' | translate"
          >
            <ion-icon name="trash-outline"></ion-icon>
          </ion-button>
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

  private readonly noteService = inject(NotesService);

  readonly notes = signal<NoteData[]>([]);
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
    this.noteService.getResourceTypeResourceIdNotes('clients', this.clientId()).subscribe({
      next: (data: NoteData[]) => {
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
      this.noteService
        .deleteResourceTypeResourceIdNotesNoteId('clients', this.clientId(), id)
        .subscribe({
          next: () => this.loadNotes(),
          error: (err) => console.error('Failed to delete note', err),
        });
    }
  }
}
