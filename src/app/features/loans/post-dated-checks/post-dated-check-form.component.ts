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
import { TranslatePipe } from '../../../core/adapters';
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
  IonSpinner,
} from '@ionic/angular/standalone';
import {
  RepaymentWithPostDatedChecksService,
  GetPostDatedChecks,
  UpdatePostDatedCheckRequest,
} from '../../../api';
import {
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  formatDateToFineract,
  toIsoDate,
} from '../../../core/utils/date-formatter';
import { createPickersReady } from '../../../shared/utils/pickers-ready';

/**
 * Edit-only form for a post-dated check on a loan. Loads the existing check from the
 * loan's post-dated check list and submits the changes via PUT. The loan id and check id
 * are taken from the route.
 */
@Component({
  selector: 'app-post-dated-check-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonButton,
    IonSpinner,
    IonInput,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'POST_DATED_CHECKS.EDIT' | appTranslate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #checkForm="ngForm" (ngSubmit)="onSubmit()" class="check-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'POST_DATED_CHECKS.NAME' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'POST_DATED_CHECKS.NAME' | appTranslate"
                name="name"
                [ngModel]="name()"
                (ngModelChange)="name.set($event)"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'POST_DATED_CHECKS.AMOUNT' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'POST_DATED_CHECKS.AMOUNT' | appTranslate"
                type="number"
                name="amount"
                [ngModel]="amount()"
                (ngModelChange)="amount.set($event)"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'POST_DATED_CHECKS.ACCOUNT_NO' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'POST_DATED_CHECKS.ACCOUNT_NO' | appTranslate"
                type="number"
                name="accountNo"
                [ngModel]="accountNo()"
                (ngModelChange)="accountNo.set($event)"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'POST_DATED_CHECKS.DATE' | appTranslate
              }}</ion-label>
              @if (pickersReady()) {
                <ion-datetime-button datetime="date-picker"></ion-datetime-button>
              }
              <ion-modal [keepContentsMounted]="true">
                <ng-template>
                  <ion-datetime
                    id="date-picker"
                    data-testid="date-picker"
                    presentation="date"
                    name="date"
                    [ngModel]="date()"
                    (ngModelChange)="date.set($event)"
                    required
                  ></ion-datetime>
                </ng-template>
              </ion-modal>
            </ion-item>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="checkForm.invalid || isSaving()"
              >
                @if (isSaving()) {
                  <ion-spinner name="crescent"></ion-spinner>
                  {{ 'COMMON.SAVING' | appTranslate }}
                } @else {
                  {{ 'COMMON.SAVE' | appTranslate }}
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
        max-width: 600px;
        margin: 0 auto;
      }
      .check-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    `,
  ],
})
export class PostDatedCheckFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly checkService = inject(RepaymentWithPostDatedChecksService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  loanId: number | null = null;
  checkId: number | null = null;
  readonly isSaving = signal(false);

  readonly name = signal('');
  readonly amount = signal<number | null>(null);
  readonly accountNo = signal<number | null>(null);
  readonly date = signal<string | null>(null);

  ngOnInit(): void {
    const loanIdParam = this.route.snapshot.paramMap.get('loanId');
    const idParam = this.route.snapshot.paramMap.get('id');
    if (loanIdParam) {
      this.loanId = +loanIdParam;
    }
    if (idParam) {
      this.checkId = +idParam;
      this.load();
    }
  }

  load(): void {
    if (!this.loanId || !this.checkId) return;
    this.checkService.getLoansLoanIdPostdatedchecks(this.loanId).subscribe({
      next: (data: GetPostDatedChecks[]) => {
        const check = (data || []).find((c) => c.id === this.checkId);
        if (check) {
          this.name.set(check.name ?? '');
          this.amount.set(check.amount ?? null);
          this.accountNo.set(check.accountNo ?? null);
          this.date.set(check.date ? toIsoDate(new Date(check.date)) : null);
        }
      },
      error: (err: unknown) => console.error('Failed to load post-dated check', err),
    });
  }

  onSubmit(): void {
    if (!this.loanId || !this.checkId) return;
    this.isSaving.set(true);

    const request: UpdatePostDatedCheckRequest = {
      name: this.name(),
      amount: this.amount() ?? undefined,
      accountNo: this.accountNo() ?? undefined,
      date: formatDateToFineract(this.date()),
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
    };

    this.checkService
      .putLoansLoanIdPostdatedchecksPostDatedCheckId(this.checkId, this.loanId, request)
      .subscribe({
        next: () => this.router.navigate(['/loans', this.loanId, 'post-dated-checks']),
        error: () => this.isSaving.set(false),
      });
  }

  onCancel(): void {
    this.router.navigate(['/loans', this.loanId, 'post-dated-checks']);
  }
}
