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

import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ButtonComponent } from '../../../ui/button/button.component';

import {
  CellTemplateDirective,
  ColumnDef,
  DataTableComponent,
  HasPermissionDirective,
} from '../../../shared';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { NotesService, NoteData } from '../../../api';
import { I18N, TranslatePipe } from '../../../core/adapters';
import { DialogService } from '../../../core/services/dialog.service';
import { NotificationService } from '../../../core/services/notification.service';

/**
 * The notes recorded against a group.
 *
 * Notes are the group's audit trail in practice — why it was formed, why a member left, what was
 * agreed at a meeting — so a failed load must not be presentable as "no notes yet". `hasError`
 * gives the table a retry instead of an empty state (see issue #223).
 *
 * Deletion confirms through {@link DialogService}, not `window.confirm`. The native box cannot be
 * translated, cannot be styled, and is unreachable to the e2e suite; the same substitution is
 * tracked for the pre-existing call sites in issues #229–#232.
 */
@Component({
  selector: 'app-group-notes-list',
  standalone: true,
  imports: [
    RouterModule,
    DatePipe,
    TranslatePipe,
    DataTableComponent,
    CellTemplateDirective,
    HasPermissionDirective,
    TooltipDirective,
    ButtonComponent,
  ],
  template: `
    <div class="tab-actions">
      <app-button
        type="button"
        intent="primary"
        data-testid="group-add-note"
        icon="add-outline"
        [link]="[basePath(), groupId(), 'notes', 'create']"
        *appHasPermission="'CREATE_GROUPNOTE'"
      >
        {{ 'GROUPS.ADD_NOTE' | appTranslate }}
      </app-button>
    </div>

    <app-data-table
      [data]="notes()"
      [columns]="columns"
      [isLoading]="isLoading()"
      [hasError]="hasError()"
      (retry)="loadNotes()"
      [localLogic]="true"
    >
      <ng-template appCellTemplate="createdOn" let-row>
        {{ row.createdOn | date: 'medium' }}
      </ng-template>

      <ng-template appCellTemplate="actions" let-row>
        <div class="action-buttons">
          <app-button
            type="button"
            emphasis="quiet"
            intent="primary"
            icon="create-outline"
            [link]="[basePath(), groupId(), 'notes', 'edit', row.id]"
            *appHasPermission="'UPDATE_GROUPNOTE'"
            [appTooltip]="'COMMON.EDIT' | appTranslate"
            [label]="'COMMON.EDIT' | appTranslate"
          />
          <app-button
            type="button"
            emphasis="quiet"
            intent="danger"
            icon="trash-outline"
            (click)="onDelete(row.id)"
            *appHasPermission="'DELETE_GROUPNOTE'"
            [appTooltip]="'COMMON.DELETE' | appTranslate"
            [label]="'COMMON.DELETE' | appTranslate"
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
export class GroupNotesListComponent implements OnInit {
  readonly groupId = input.required<number>();
  /**
   * Where the add and edit links point.
   *
   * A center's notes live under the *groups* resource — `/centers/{id}/notes` answers 404
   * "Note does not support resource centers" — so the center view reuses this component with the
   * center's id, and only the links need to stay inside `/centers`.
   */
  readonly basePath = input<string>('/groups');

  private readonly noteService = inject(NotesService);
  private readonly dialogService = inject(DialogService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);

  readonly notes = signal<NoteData[]>([]);
  readonly isLoading = signal(false);
  readonly hasError = signal(false);

  columns: ColumnDef[] = [
    { key: 'note', label: 'COMMON.NOTE' },
    { key: 'createdByUsername', label: 'GROUPS.CREATED_BY' },
    { key: 'createdOn', label: 'GROUPS.CREATED_ON' },
    { key: 'actions', label: 'COMMON.ACTIONS' },
  ];

  ngOnInit(): void {
    this.loadNotes();
  }

  loadNotes(): void {
    this.isLoading.set(true);
    this.noteService.getResourceTypeResourceIdNotes('groups', this.groupId()).subscribe({
      next: (data) => {
        this.notes.set(data ?? []);
        this.hasError.set(false);
        this.isLoading.set(false);
      },
      error: () => {
        this.hasError.set(true);
        this.isLoading.set(false);
      },
    });
  }

  async onDelete(noteId: number): Promise<void> {
    const confirmed = await this.dialogService.confirm({
      title: this.i18n.translate('GROUPS.DELETE_NOTE'),
      message: this.i18n.translate('GROUPS.CONFIRM_DELETE_NOTE'),
      destructive: true,
    });
    if (!confirmed) return;

    this.noteService
      .deleteResourceTypeResourceIdNotesNoteId('groups', this.groupId(), noteId)
      .subscribe({
        next: () => {
          void this.notifications.success(this.i18n.translate('GROUPS.NOTE_DELETED'));
          this.loadNotes();
        },
        // No toast: errorInterceptor already raises one with the platform's message.
        error: () => undefined,
      });
  }
}
