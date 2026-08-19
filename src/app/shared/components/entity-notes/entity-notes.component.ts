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
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { NotesService, NoteData } from '../../../api';
import { DialogService } from '../../../core/services/dialog.service';
import { I18N, TranslatePipe } from '../../../core/adapters';
import { IonButton, IonIcon, IonItem, IonLabel, IonTextarea } from '@ionic/angular/standalone';

/**
 * Notes against any Fineract record that has them — clients, groups, loans, savings accounts.
 *
 * Fineract exposes notes under one templated path, `/{resourceType}/{resourceId}/notes`, so this
 * takes the resource type as an input rather than existing once per entity. A per-entity copy is
 * how a savings account ends up with no notes tab while a loan has one.
 *
 * Notes are an append-only audit trail (who said what, when): staff can add and remove entries,
 * but existing note text is not editable in place, so the record stays trustworthy for review.
 */
@Component({
  selector: 'app-entity-notes',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    DatePipe,
    IonIcon,
    IonButton,
    IonTextarea,
    IonItem,
    IonLabel,
  ],
  template: `
    <div class="add-note-row">
      <ion-item fill="outline" class="note-input">
        <ion-label position="stacked">{{ 'NOTES.ADD' | appTranslate }}</ion-label>
        <ion-textarea
          [attr.aria-label]="'NOTES.ADD' | appTranslate"
          rows="2"
          [ngModel]="newNoteText()"
          (ngModelChange)="newNoteText.set($event)"
          name="newNote"
        ></ion-textarea>
      </ion-item>
      <ion-button
        color="primary"
        [disabled]="!newNoteText().trim() || isSaving()"
        (click)="onAddNote()"
      >
        <ion-icon name="add-outline"></ion-icon>
        {{ 'COMMON.SAVE' | appTranslate }}
      </ion-button>
    </div>

    @if (isLoading()) {
      <p class="empty-state">{{ 'COMMON.LOADING' | appTranslate }}</p>
    } @else if (notes().length === 0) {
      <p class="empty-state">{{ 'LOANS.NO_NOTES' | appTranslate }}</p>
    } @else {
      <div class="notes-list">
        @for (note of notes(); track note.id) {
          <div class="note-item">
            <div class="note-text">{{ note.note }}</div>
            <div class="note-meta">
              <span>{{ note.createdByUsername }}</span>
              <span>&middot;</span>
              <span>{{ note.createdOn | date: 'medium' }}</span>
            </div>
            <ion-button
              fill="clear"
              color="danger"
              class="delete-btn"
              (click)="onDeleteNote(note.id!)"
              [attr.aria-label]="'LOANS.DELETE_NOTE' | appTranslate"
            >
              <ion-icon name="trash-outline"></ion-icon>
            </ion-button>
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      .add-note-row {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        margin-bottom: 20px;
      }
      .note-input {
        flex: 1;
      }
      .notes-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .note-item {
        position: relative;
        padding: 12px 40px 12px 16px;
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: 8px;
      }
      .note-text {
        white-space: pre-wrap;
        margin-bottom: 6px;
      }
      .note-meta {
        display: flex;
        gap: 6px;
        font-size: 12px;
        color: var(--text-muted, #7f8c8d);
      }
      .delete-btn {
        position: absolute;
        top: 4px;
        right: 4px;
      }
      .empty-state {
        color: #95a5a6;
        text-align: center;
        padding: 24px;
      }
    `,
  ],
})
export class EntityNotesComponent implements OnInit {
  /** The path segment Fineract knows this entity by: `clients`, `groups`, `loans`, `savings`. */
  readonly resourceType = input.required<string>();
  readonly resourceId = input.required<number>();

  private readonly notesService = inject(NotesService);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);

  readonly notes = signal<NoteData[]>([]);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly newNoteText = signal('');

  ngOnInit(): void {
    this.loadNotes();
  }

  loadNotes(): void {
    this.isLoading.set(true);
    this.notesService
      .getResourceTypeResourceIdNotes(this.resourceType(), this.resourceId())
      .subscribe({
        next: (data) => {
          this.notes.set(data);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Failed to load notes', err);
          this.isLoading.set(false);
        },
      });
  }

  onAddNote(): void {
    const note = this.newNoteText().trim();
    if (!note) return;
    this.isSaving.set(true);
    this.notesService
      .postResourceTypeResourceIdNotes(this.resourceType(), this.resourceId(), { note })
      .subscribe({
        next: () => {
          this.newNoteText.set('');
          this.isSaving.set(false);
          this.loadNotes();
        },
        error: (err) => {
          console.error('Failed to add note', err);
          this.isSaving.set(false);
        },
      });
  }

  onDeleteNote(noteId: number): void {
    this.dialogService
      .confirm({
        title: this.i18n.translate('COMMON.DELETE'),
        message: this.i18n.translate('NOTES.CONFIRM_DELETE'),
        destructive: true,
      })
      .then((confirmed) => {
        if (!confirmed) return;
        this.notesService
          .deleteResourceTypeResourceIdNotesNoteId(this.resourceType(), this.resourceId(), noteId)
          .subscribe({
            next: () => this.loadNotes(),
            error: (err) => console.error('Failed to delete note', err),
          });
      });
  }
}
