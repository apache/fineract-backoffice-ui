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
import { PlatformDateService } from '../../core/services/platform-date.service';

import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ACCOUNTING_CLOSURE_API, OFFICE_API, TranslatePipe } from '../../core/adapters';
import type { Office } from '../../core/adapters';
import { HelpIconComponent } from '../../shared';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonDatetime,
  IonDatetimeButton,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
} from '@ionic/angular/standalone';
import { toIsoDate } from '../../core/utils/date-formatter';
import { createPickersReady } from '../../shared/utils/pickers-ready';

/**
 * Component for closing an accounting period for an office.
 */
@Component({
  selector: 'app-accounting-closure-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    HelpIconComponent,
    IonButton,
    IonSpinner,
    IonTextarea,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonSelectOption,
    IonSelect,
    IonDatetime,
    IonDatetimeButton,
    IonInput,
    IonModal,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              (isEdit()
                ? 'ACCOUNTING_CLOSURES.EDIT_COMMENTS'
                : 'ACCOUNTING_CLOSURES.CLOSE_ACCOUNTING_PERIOD'
              ) | appTranslate
            }}
            <app-help-icon [helpTextKey]="'HELP.ACCOUNTING_CLOSURES_DESC'"></app-help-icon>
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #closureForm="ngForm" (ngSubmit)="onSubmit()" class="closure-form">
            <div class="form-grid">
              <!-- Office. Read-only when editing: the PUT body carries comments alone. -->
              @if (isEdit()) {
                <ion-item fill="outline">
                  <ion-label position="stacked">Office</ion-label>
                  <ion-input
                    aria-label="Office"
                    readonly
                    [value]="officeName()"
                    data-testid="closure-office-readonly"
                  ></ion-input>
                </ion-item>
              } @else {
                <ion-item fill="outline">
                  <ion-label position="stacked">Office</ion-label>
                  <ion-select
                    aria-label="Office"
                    interface="popover"
                    name="officeId"
                    [(ngModel)]="request.officeId"
                    required
                  >
                    @for (office of offices(); track office.id) {
                      <ion-select-option [value]="office.id">{{ office.name }}</ion-select-option>
                    }
                  </ion-select>
                </ion-item>
              }

              <!-- Closing Date. Immutable — see AccountingClosureApi.update. -->
              @if (isEdit()) {
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'ACCOUNTING_CLOSURES.CLOSING_DATE' | appTranslate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'ACCOUNTING_CLOSURES.CLOSING_DATE' | appTranslate"
                    readonly
                    [value]="closingDate"
                    data-testid="closure-closing-date-readonly"
                  ></ion-input>
                </ion-item>
              } @else {
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'ACCOUNTING_CLOSURES.CLOSING_DATE' | appTranslate
                  }}</ion-label>
                  @if (pickersReady()) {
                    <ion-datetime-button datetime="closingDate-picker"></ion-datetime-button>
                  }
                  <ion-modal [keepContentsMounted]="true">
                    <ng-template>
                      <ion-datetime
                        id="closingDate-picker"
                        data-testid="closingDate-picker"
                        presentation="date"
                        name="closingDate"
                        [(ngModel)]="closingDate"
                        required
                      ></ion-datetime>
                    </ng-template>
                  </ion-modal>
                </ion-item>
              }

              <!-- Comments -->
              <ion-item fill="outline" class="full-width">
                <ion-label position="stacked">Comments</ion-label>
                <ion-textarea
                  aria-label="Comments"
                  name="comments"
                  [(ngModel)]="request.comments"
                  rows="3"
                ></ion-textarea>
              </ion-item>
            </div>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                Cancel
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="closureForm.invalid || isSaving()"
              >
                @if (isSaving()) {
                  <ion-spinner name="crescent"></ion-spinner>
                  Saving...
                } @else {
                  Close Period
                }
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
        max-width: 800px;
        margin: 0 auto;
      }
      .closure-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
        gap: 16px;
      }
    `,
  ],
})
export class AccountingClosureFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly closureApi = inject(ACCOUNTING_CLOSURE_API);
  private readonly officeApi = inject(OFFICE_API);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  /**
   * Today, as the platform reckons it: the business date when one governs, and the platform's
   * own clock otherwise. Fineract judges "the future" by that reckoning, so a date seeded from
   * `new Date()` is refused whenever the browser runs ahead of it (#758).
   */
  private readonly platformDate = inject(PlatformDateService);

  readonly offices = signal<Office[]>([]);
  /**
   * The form's own state, rather than the generated request shape it used to bind to directly.
   * `dateFormat` and `locale` are gone from here on purpose — how Fineract parses a date is the
   * adapter's business, not this screen's. See ADR 0006.
   */
  request: { officeId?: number; comments: string } = {
    officeId: undefined,
    comments: '',
  };
  closingDate = this.platformDate.today();
  readonly isSaving = signal(false);

  /** True on `closures/edit/:id`, which corrects the comments of a closure already recorded. */
  readonly isEdit = signal(false);
  closureId = 0;
  /** The closed office, for display only: editing cannot move a closure between offices. */
  readonly officeName = signal('');

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.closureId = +id;
      this.isEdit.set(true);
      this.loadClosure();
      // The office options are only needed by the select, which edit mode does not render.
      return;
    }
    this.officeApi.list().subscribe((data: Office[]) => this.offices.set(data));
  }

  /**
   * Loads the closure being corrected.
   *
   * Only the comments are editable, so the office and the closing date are read back for display
   * and never sent again.
   */
  private loadClosure(): void {
    this.closureApi.get(this.closureId).subscribe({
      next: (closure) => {
        this.request = { officeId: closure.officeId, comments: closure.comments ?? '' };
        this.officeName.set(closure.officeName);
        if (closure.closingDate) {
          this.closingDate = closure.closingDate;
        }
      },
      error: (err: unknown) => {
        console.error('Failed to load the accounting closure', err);
      },
    });
  }

  onSubmit() {
    if (this.isEdit()) {
      this.isSaving.set(true);
      this.closureApi.update(this.closureId, this.request.comments).subscribe({
        next: () => this.router.navigate(['/accounting/closures']),
        error: () => this.isSaving.set(false),
      });
      return;
    }

    if (this.request.officeId === undefined) return;
    this.isSaving.set(true);

    this.closureApi
      .create({
        officeId: this.request.officeId,
        closingDate: toIsoDate(this.closingDate),
        comments: this.request.comments,
      })
      .subscribe({
        next: () => this.router.navigate(['/accounting/closures']),
        error: () => this.isSaving.set(false),
      });
  }

  onCancel() {
    this.router.navigate(['/accounting/closures']);
  }
}
