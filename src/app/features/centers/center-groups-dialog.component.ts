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
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { IonButton, IonCheckbox, IonItem, IonList, IonSearchbar } from '@ionic/angular/standalone';

import { GroupsService } from '../../api';
import { OVERLAY, TranslatePipe } from '../../core/adapters';
import { CenterGroupMember } from './center-detail.model';

export interface CenterGroupsDialogData {
  /** `add` searches the office for candidates; `remove` lists the center's current groups. */
  mode: 'add' | 'remove';
  /** Scopes the candidate search. A center may only hold groups from its own office. */
  officeId?: number;
  /** The center's current groups — the candidate list in `remove` mode. */
  members: CenterGroupMember[];
}

export interface CenterGroupsResult {
  groupMembers: number[];
}

/**
 * Chooses the groups to attach to, or detach from, a center.
 *
 * **Adding** searches `GET /groups?orphansOnly=true`, which is the platform's own filter for
 * groups that do not already belong to a center. That is the right question to ask: a group has at
 * most one parent, so a group listed under another center is not a candidate, and offering it
 * produces a refusal the operator cannot act on. Filtering client-side against this center's own
 * members would not catch groups held by a *different* centre.
 *
 * The search is scoped to the center's office because the platform refuses a group from anywhere
 * else, and is seeded with a blank term so the dialog opens with a page of candidates rather than
 * an empty panel that only fills once the operator guesses a name.
 */
@Component({
  selector: 'app-center-groups-dialog',
  standalone: true,
  imports: [FormsModule, TranslatePipe, IonButton, IonCheckbox, IonItem, IonList, IonSearchbar],
  template: `
    <h2 class="dialog-title">
      {{
        (data().mode === 'add' ? 'CENTERS.ATTACH_GROUPS' : 'CENTERS.DETACH_GROUPS') | appTranslate
      }}
    </h2>
    <div class="dialog-content">
      @if (data().mode === 'add') {
        <ion-searchbar
          data-testid="center-group-search"
          [attr.aria-label]="'CENTERS.SEARCH_GROUPS' | appTranslate"
          [placeholder]="'CENTERS.SEARCH_GROUPS' | appTranslate"
          [debounce]="0"
          (ionInput)="onSearch($any($event).detail.value)"
        ></ion-searchbar>
      }

      <ion-list class="candidate-list">
        @for (candidate of candidates(); track candidate.id) {
          <ion-item>
            <ion-checkbox
              justify="start"
              labelPlacement="end"
              [attr.data-testid]="'center-group-' + candidate.id"
              [checked]="selected().has(candidate.id!)"
              (ionChange)="toggle(candidate.id!)"
            >
              {{ candidate.name }}
              @if (candidate.accountNo) {
                <span class="account-no">({{ candidate.accountNo }})</span>
              }
            </ion-checkbox>
          </ion-item>
        } @empty {
          <p class="field-note" data-testid="center-group-none">
            {{ emptyMessage() | appTranslate }}
          </p>
        }
      </ion-list>
    </div>
    <div class="dialog-actions">
      <ion-button fill="clear" color="medium" (click)="onCancel()">
        {{ 'COMMON.CANCEL' | appTranslate }}
      </ion-button>
      <ion-button
        color="primary"
        data-testid="center-groups-confirm"
        [disabled]="!selected().size"
        (click)="onConfirm()"
      >
        {{ 'COMMON.CONFIRM' | appTranslate }}
      </ion-button>
    </div>
  `,
  styles: [
    `
      .dialog-content {
        min-width: 360px;
      }
      .candidate-list {
        max-height: 320px;
        overflow-y: auto;
      }
      .account-no {
        margin-left: 6px;
        color: var(--text-muted, #6b7280);
        font-size: 12px;
      }
      .field-note {
        margin: 8px 0 0;
        font-size: 12px;
        color: var(--text-muted, #6b7280);
      }
    `,
  ],
})
export class CenterGroupsDialogComponent implements OnInit {
  private readonly overlay = inject(OVERLAY);
  private readonly groupsService = inject(GroupsService);

  readonly data = input.required<CenterGroupsDialogData>();

  readonly candidates = signal<CenterGroupMember[]>([]);
  /** Replaced rather than mutated: under the OnPush default a mutated Set notifies nothing. */
  readonly selected = signal<ReadonlySet<number>>(new Set());

  private readonly searchTerm = new Subject<string>();

  ngOnInit(): void {
    if (this.data().mode === 'remove') {
      this.candidates.set(this.data().members);
      return;
    }

    this.searchTerm
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) =>
          this.groupsService
            // Signature: officeId, staffId, externalId, name, underHierarchy, paged, offset,
            // limit, orderBy, sortOrder, orphansOnly.
            .getGroups(
              this.data().officeId,
              undefined,
              undefined,
              term || undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              true,
            )
            .pipe(catchError(() => of(null))),
        ),
      )
      .subscribe((response) => {
        const rows = response as unknown as
          CenterGroupMember[] | { pageItems?: CenterGroupMember[] } | null;
        // `GET /groups` answers with a bare array unless `paged` is set, and with a page object
        // when it is. Both shapes are handled so this does not depend on that flag staying unset.
        const items = Array.isArray(rows) ? rows : (rows?.pageItems ?? []);
        this.candidates.set(Array.from(items));
      });

    this.searchTerm.next('');
  }

  emptyMessage(): string {
    return this.data().mode === 'add' ? 'CENTERS.NO_GROUPS_FOUND' : 'CENTERS.NO_GROUPS';
  }

  onSearch(term: string | null | undefined): void {
    this.searchTerm.next(term ?? '');
  }

  toggle(groupId: number): void {
    const next = new Set(this.selected());
    if (!next.delete(groupId)) next.add(groupId);
    this.selected.set(next);
  }

  onCancel(): void {
    void this.overlay.dismissModal();
  }

  onConfirm(): void {
    if (!this.selected().size) return;
    void this.overlay.dismissModal<CenterGroupsResult>({ groupMembers: [...this.selected()] });
  }
}
