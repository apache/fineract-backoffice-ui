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
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItem,
  IonLabel,
  IonTextarea,
} from '@ionic/angular/standalone';

import { NotesService } from '../../api';
import { I18N, TranslatePipe } from '../../core/adapters';
import { NotificationService } from '../../core/services/notification.service';

/** Adds or edits a note against a group. */
@Component({
  selector: 'app-group-note-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonTextarea,
    IonButton,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{ (isEditMode ? 'GROUPS.EDIT_NOTE' : 'GROUPS.ADD_NOTE') | appTranslate }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #noteForm="ngForm" (ngSubmit)="onSubmit()" class="note-form">
            <ion-item fill="outline" class="full-width">
              <ion-label position="stacked">{{ 'COMMON.NOTE' | appTranslate }}</ion-label>
              <ion-textarea
                [attr.aria-label]="'COMMON.NOTE' | appTranslate"
                name="note"
                [ngModel]="note()"
                (ngModelChange)="note.set($event)"
                required
                rows="6"
                data-testid="group-note-textarea"
              ></ion-textarea>
            </ion-item>

            <div class="form-actions">
              <ion-button
                fill="clear"
                color="medium"
                type="button"
                (click)="onCancel()"
                data-testid="group-note-cancel"
              >
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="!noteForm.form.valid || isSaving()"
                data-testid="group-note-submit"
              >
                {{ 'COMMON.SAVE' | appTranslate }}
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
        max-width: 600px;
        margin: 0 auto;
      }
      .note-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding-top: 16px;
      }
      .full-width {
        width: 100%;
      }
      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
    `,
  ],
})
export class GroupNoteFormComponent implements OnInit {
  private readonly noteService = inject(NotesService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);

  groupId!: number;
  /**
   * Where cancelling and saving return to. Centers reuse this form because their notes live under
   * the groups resource, and returning them to a group view would be wrong.
   */
  basePath = '/groups';
  noteId?: number;
  isEditMode = false;

  readonly note = signal('');
  /** Guards the submit button, so a slow save cannot be posted twice. */
  readonly isSaving = signal(false);

  ngOnInit(): void {
    this.groupId = Number(this.route.snapshot.paramMap.get('groupId'));
    this.basePath = (this.route.snapshot.data['basePath'] as string) ?? '/groups';
    const noteId = this.route.snapshot.paramMap.get('id');

    if (noteId) {
      this.noteId = Number(noteId);
      this.isEditMode = true;
      this.loadNote();
    }
  }

  private loadNote(): void {
    this.noteService
      .getResourceTypeResourceIdNotesNoteId('groups', this.groupId, this.noteId!)
      .subscribe({
        next: (data) => this.note.set(data.note ?? ''),
        // No toast: errorInterceptor already raises one with the platform's message.
        error: () => undefined,
      });
  }

  onSubmit(): void {
    if (this.isSaving()) return;
    this.isSaving.set(true);

    const request = { note: this.note() };
    // Typed as `Observable<unknown>`: create and update resolve to different response models,
    // and the union of the two overload sets has no callable `subscribe`.
    const save$: Observable<unknown> = this.isEditMode
      ? this.noteService.putResourceTypeResourceIdNotesNoteId(
          'groups',
          this.groupId,
          this.noteId!,
          request,
        )
      : this.noteService.postResourceTypeResourceIdNotes('groups', this.groupId, request);

    save$.subscribe({
      next: () => {
        void this.notifications.success(this.i18n.translate('GROUPS.NOTE_SAVED'));
        this.onCancel();
      },
      // Clearing isSaving is all this owes: errorInterceptor raises the toast, and leaving the
      // flag set would disable the submit button for good after one failure.
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    void this.router.navigate([`${this.basePath}/view`, this.groupId]);
  }
}
