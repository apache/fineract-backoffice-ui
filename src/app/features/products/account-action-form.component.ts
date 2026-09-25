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
import { TranslateModule } from '@ngx-translate/core';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonSpinner,
} from '@ionic/angular/standalone';
import { Observable } from 'rxjs';
import {
  SavingsAccountService,
  FixedDepositAccountService,
  RecurringDepositAccountService,
  LoansService,
  StaffService,
  ChargesService,
  LoanChargesService,
  PostLoansLoanIdChargesRequest,
  PostLoansLoanIdRequest,
  StaffData,
  ChargeData,
} from '../../api';
import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  formatDateToFineract,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
} from '../../core/utils/date-formatter';

@Component({
  selector: 'app-account-action-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonSpinner,
    DatePipe,
    CurrencyPipe,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ title | translate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          @if (accountDetails()) {
            <div class="account-summary-panel">
              <div class="summary-grid">
                <div class="summary-item">
                  <span class="label">{{ 'COMMON.ACCOUNT_NO' | translate }}:</span>
                  <span class="value">{{ accountDetails()!['accountNo'] }}</span>
                </div>
                <div class="summary-item">
                  <span class="label">{{ 'COMMON.NAME' | translate }}:</span>
                  <span class="value">{{
                    accountDetails()!['clientName'] || accountDetails()!['groupName']
                  }}</span>
                </div>
                <div class="summary-item">
                  <span class="label">{{ 'COMMON.PRODUCT' | translate }}:</span>
                  <span class="value">{{
                    accountDetails()!['savingsProductName'] ||
                      accountDetails()!['productName'] ||
                      accountDetails()!['loanProductName']
                  }}</span>
                </div>

                @if (
                  getAmount(accountDetails()!['depositAmount'], accountDetails()!['principal'])
                ) {
                  <div class="summary-item">
                    <span class="label">{{ 'COMMON.AMOUNT' | translate }}:</span>
                    <span class="value">{{
                      getAmount(accountDetails()!['depositAmount'], accountDetails()!['principal'])
                        | currency: getCurrencyCode(accountDetails()!['currency'])
                    }}</span>
                  </div>
                }

                @if (accountDetails()!['nominalAnnualInterestRate'] !== undefined) {
                  <div class="summary-item">
                    <span class="label">{{ 'COMMON.INTEREST_RATE' | translate }}:</span>
                    <span class="value">{{ accountDetails()!['nominalAnnualInterestRate'] }}%</span>
                  </div>
                }

                @if (
                  accountDetails()!['depositPeriod'] || accountDetails()!['numberOfRepayments']
                ) {
                  <div class="summary-item">
                    <span class="label">{{ 'COMMON.TERM' | translate }}:</span>
                    <span class="value">
                      {{
                        accountDetails()!['depositPeriod'] ||
                          accountDetails()!['numberOfRepayments']
                      }}
                      {{
                        getFrequencyValue(
                          accountDetails()!['depositPeriodFrequency'] ||
                            accountDetails()!['repaymentFrequencyType']
                        )
                      }}
                    </span>
                  </div>
                }

                @if (getTimelineSubmittedOnDate(accountDetails()!['timeline'])) {
                  <div class="summary-item full-width">
                    <span class="label">{{ 'COMMON.SUBMITTED_ON' | translate }}:</span>
                    <span class="value">{{
                      getFineractDate(getTimelineSubmittedOnDate(accountDetails()!['timeline']))
                        | date: 'longDate'
                    }}</span>
                  </div>
                }
              </div>
            </div>
          }

          <form #actionForm="ngForm" (ngSubmit)="onSubmit()" class="action-form">
            <!-- Staff selection (only for assignloanofficer) -->
            @if (command() === 'assignloanofficer') {
              <ion-item fill="outline" class="form-item">
                <ion-label position="stacked">{{ 'LOANS.LOAN_OFFICER' | translate }}</ion-label>
                <ion-select
                  [attr.aria-label]="'LOANS.LOAN_OFFICER' | translate"
                  interface="popover"
                  id="account-action-officer"
                  data-testid="account-action-officer"
                  name="toLoanOfficerId"
                  [(ngModel)]="toLoanOfficerId"
                  required
                >
                  @for (staff of staffOptions(); track staff.id) {
                    <ion-select-option [value]="staff.id">{{
                      staff.displayName
                    }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>
            }

            <!-- Charge selection (only for applycharges) -->
            @if (command() === 'applycharges') {
              <ion-item fill="outline" class="form-item">
                <ion-label position="stacked">{{ 'LOANS.CHARGE' | translate }}</ion-label>
                <ion-select
                  [attr.aria-label]="'LOANS.CHARGE' | translate"
                  interface="popover"
                  id="account-action-charge"
                  data-testid="account-action-charge"
                  name="chargeId"
                  [(ngModel)]="chargeId"
                  (ionChange)="onChargeSelected($event.detail.value)"
                  required
                >
                  @for (charge of chargeOptions(); track charge.id) {
                    <ion-select-option [value]="charge.id">{{ charge.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <ion-item fill="outline" class="form-item">
                <ion-label position="stacked">{{ 'COMMON.AMOUNT' | translate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'COMMON.AMOUNT' | translate"
                  id="account-action-amount"
                  data-testid="account-action-amount"
                  type="number"
                  name="amount"
                  [(ngModel)]="amount"
                  required
                ></ion-input>
              </ion-item>
            }

            <!-- Action Date -->
            <ion-item fill="outline" class="form-item">
              <ion-label position="stacked">{{ dateLabel | translate }}</ion-label>
              <ion-input
                [attr.aria-label]="dateLabel | translate"
                id="account-action-date"
                data-testid="account-action-date"
                type="date"
                name="actionDate"
                [ngModel]="actionDate | date: 'yyyy-MM-dd'"
                (ngModelChange)="onActionDateChange($event)"
                required
              ></ion-input>
            </ion-item>

            <!-- Expected Disbursement Date (Only for Loan Approval) -->
            @if (command() === 'approve' && accountType() === 'loan') {
              <ion-item fill="outline" class="form-item">
                <ion-label position="stacked">{{
                  'ACTIONS.EXPECTED_DISBURSEMENT_DATE' | translate
                }}</ion-label>
                <ion-input
                  [attr.aria-label]="'ACTIONS.EXPECTED_DISBURSEMENT_DATE' | translate"
                  id="account-action-disbursement-date"
                  data-testid="account-action-disbursement-date"
                  type="date"
                  name="expectedDisbursementDate()"
                  [ngModel]="expectedDisbursementDate() | date: 'yyyy-MM-dd'"
                  (ngModelChange)="onExpectedDisbursementDateChange($event)"
                  required
                ></ion-input>
              </ion-item>
            }

            <!-- Note -->
            <ion-item fill="outline" class="form-item">
              <ion-label position="stacked">{{ 'COMMON.NOTE' | translate }}</ion-label>
              <ion-textarea
                [attr.aria-label]="'COMMON.NOTE' | translate"
                id="account-action-note"
                data-testid="account-action-note"
                name="note"
                [(ngModel)]="note"
                rows="4"
              ></ion-textarea>
            </ion-item>

            <div class="form-actions">
              <ion-button
                id="account-action-cancel-btn"
                data-testid="account-action-cancel-btn"
                fill="clear"
                color="medium"
                type="button"
                (click)="onCancel()"
                [disabled]="isSaving()"
              >
                {{ 'COMMON.CANCEL' | translate }}
              </ion-button>
              <ion-button
                id="account-action-submit-btn"
                data-testid="account-action-submit-btn"
                color="primary"
                type="submit"
                [disabled]="actionForm.invalid || isSaving()"
              >
                @if (isSaving()) {
                  <ion-spinner name="crescent" slot="start"></ion-spinner>
                  {{ 'COMMON.SAVING' | translate }}
                } @else {
                  {{ 'COMMON.SAVE' | translate }}
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
      .action-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .account-summary-panel {
        padding: 16px;
        background-color: #f8f9fa;
        border-radius: 8px;
        border-left: 4px solid #3f51b5;
        margin-bottom: 8px;
      }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
      }
      .summary-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .summary-item.full-width {
        grid-column: 1 / -1;
      }
      .summary-item .label {
        font-size: 0.85rem;
        font-weight: 500;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .summary-item .value {
        font-size: 1rem;
        font-weight: 600;
        color: var(--secondary-color);
      }
    `,
  ],
})
export class AccountActionFormComponent implements OnInit {
  private readonly loansService = inject(LoansService);
  private readonly loanChargesService = inject(LoanChargesService);
  private readonly savingsService = inject(SavingsAccountService);
  private readonly fixedDepositService = inject(FixedDepositAccountService);
  private readonly recurringDepositService = inject(RecurringDepositAccountService);
  private readonly staffService = inject(StaffService);
  private readonly chargesService = inject(ChargesService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  accountId = 0;
  readonly accountType = signal(''); // 'savings', 'fixed', 'recurring', 'loan'
  readonly command = signal(''); // 'approve', 'activate', 'close', 'disburse', 'assignloanofficer', 'unassignloanofficer', 'applycharges'
  readonly isSaving = signal(false);

  actionDate: Date = new Date();
  readonly expectedDisbursementDate = signal<Date | null>(null);
  note = '';

  onActionDateChange(val: string): void {
    this.actionDate = val ? new Date(val) : new Date();
  }

  onExpectedDisbursementDateChange(val: string): void {
    this.expectedDisbursementDate.set(val ? new Date(val) : null);
  }

  title = '';
  dateLabel = '';

  readonly staffOptions = signal<StaffData[]>([]);
  readonly chargeOptions = signal<ChargeData[]>([]);
  toLoanOfficerId?: number;
  chargeId?: number;
  amount?: number;

  readonly accountDetails = signal<Record<string, unknown> | null>(null);

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.accountId = +params['accountId'];
      this.accountType.set(params['accountType']);
      this.command.set(params['command'] || 'approve');
      this.setupLabels();

      if (this.command() === 'assignloanofficer') {
        this.loadStaffOptions();
      } else if (this.command() === 'applycharges') {
        this.loadChargeOptions();
      }

      this.loadAccountDetails();
    });
  }

  getFineractDate(dateArray: unknown): Date | null {
    if (Array.isArray(dateArray) && dateArray.length >= 3) {
      return new Date(dateArray[0] as number, (dateArray[1] as number) - 1, dateArray[2] as number);
    }
    return dateArray ? new Date(dateArray as string | number | Date) : null;
  }

  getCurrencyCode(currency: unknown): string | undefined {
    return (currency as Record<string, string>)?.['code'];
  }

  getFrequencyValue(frequency: unknown): string | undefined {
    return (frequency as Record<string, string>)?.['value'];
  }

  getTimelineSubmittedOnDate(timeline: unknown): unknown {
    return (timeline as Record<string, unknown>)?.['submittedOnDate'];
  }

  getAmount(depositAmount: unknown, principal: unknown): number | undefined {
    return (depositAmount as number) || (principal as number) || undefined;
  }

  private loadAccountDetails(): void {
    if (this.accountType() === 'loan') {
      this.loansService.getLoansLoanId(this.accountId).subscribe({
        next: (data) => {
          this.accountDetails.set(data as unknown as Record<string, unknown>);
          if (this.command() === 'approve') {
            const timeline = data.timeline as Record<string, unknown> | undefined;
            if (timeline?.['expectedDisbursementDate']) {
              this.expectedDisbursementDate.set(
                this.getFineractDate(timeline['expectedDisbursementDate']),
              );
            }
          }
        },
        error: (err) => console.error('Failed to load loan details', err),
      });
    } else if (this.accountType() === 'savings') {
      this.savingsService.getSavingsaccountsAccountId(this.accountId).subscribe({
        next: (data) => this.accountDetails.set(data as unknown as Record<string, unknown>),
        error: (err) => console.error('Failed to load savings details', err),
      });
    } else if (this.accountType() === 'fixed') {
      this.fixedDepositService.getFixeddepositaccountsAccountId(this.accountId).subscribe({
        next: (data) => this.accountDetails.set(data as unknown as Record<string, unknown>),
        error: (err) => console.error('Failed to load fixed deposit details', err),
      });
    } else if (this.accountType() === 'recurring') {
      this.recurringDepositService.getRecurringdepositaccountsAccountId(this.accountId).subscribe({
        next: (data) => this.accountDetails.set(data as unknown as Record<string, unknown>),
        error: (err) => console.error('Failed to load recurring deposit details', err),
      });
    }
  }

  private setupLabels(): void {
    const config: Record<string, { title: string; date: string }> = {
      approve: { title: 'ACTIONS.APPROVE_ACCOUNT', date: 'ACTIONS.APPROVAL_DATE' },
      activate: { title: 'ACTIONS.ACTIVATE_ACCOUNT', date: 'ACTIONS.ACTIVATION_DATE' },
      close: { title: 'ACTIONS.CLOSE_ACCOUNT', date: 'ACTIONS.CLOSURE_DATE' },
      disburse: { title: 'ACTIONS.DISBURSE_FUNDS', date: 'ACTIONS.DISBURSEMENT_DATE' },
      assignloanofficer: { title: 'ACTIONS.ASSIGN_LOAN_OFFICER', date: 'ACTIONS.ASSIGNMENT_DATE' },
      unassignloanofficer: {
        title: 'ACTIONS.UNASSIGN_LOAN_OFFICER',
        date: 'ACTIONS.UNASSIGNMENT_DATE',
      },
      applycharges: { title: 'ACTIONS.APPLY_CHARGES', date: 'ACTIONS.DUE_DATE' },
    };

    const entry = config[this.command()] || config['approve'];
    this.title = entry.title;
    this.dateLabel = entry.date;
  }

  loadStaffOptions(): void {
    this.staffService.getStaff(undefined, undefined, true, 'Active').subscribe({
      next: (data) => {
        this.staffOptions.set(data);
      },
      error: (err) => console.error('Failed to load staff options', err),
    });
  }

  loadChargeOptions(): void {
    this.chargesService.getCharges().subscribe({
      next: (data) => {
        this.chargeOptions.set(
          data.filter(
            (c) => c.active && (c.chargeAppliesTo?.id === 1 || c.chargeAppliesTo?.value === 'Loan'),
          ),
        );
      },
      error: (err) => console.error('Failed to load charge options', err),
    });
  }

  onChargeSelected(chargeId: number): void {
    const selected = this.chargeOptions().find((c) => c.id === chargeId);
    if (selected) {
      this.amount = selected.amount;
    }
  }

  onSubmit(): void {
    this.isSaving.set(true);
    const formattedDate = formatDateToFineract(this.actionDate);

    let obs$: Observable<unknown> | null = null;
    let redirectPath = '';

    if (this.accountType() === 'loan') {
      const res = this.handleLoanAction(formattedDate);
      obs$ = res.obs$;
      redirectPath = res.redirectPath;
    } else {
      const res = this.handleDepositAction(formattedDate);
      obs$ = res.obs$;
      redirectPath = res.redirectPath;
    }

    if (obs$) {
      obs$.subscribe({
        next: () => this.router.navigate([redirectPath]),
        error: () => this.isSaving.set(false),
      });
    }
  }

  private buildLoanApprovePayload(formattedDate: string): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
      note: this.note,
      approvedOnDate: formattedDate,
    };
    // Read each signal once into a local: TypeScript cannot narrow a call
    // expression, so a null check on this.accountDetails() does not carry over
    // to the next call.
    const details = this.accountDetails();
    if (!details) return payload;

    if (details['principal'] !== undefined) {
      payload['approvedLoanAmount'] = details['principal'];
    }
    const expectedDisbursement = this.expectedDisbursementDate();
    if (expectedDisbursement) {
      payload['expectedDisbursementDate'] = formatDateToFineract(expectedDisbursement);
    }
    return payload;
  }

  private buildLoanStatePayload(formattedDate: string): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
      note: this.note,
    };
    if (this.command() === 'activate') payload['activatedOnDate'] = formattedDate;
    if (this.command() === 'close') payload['closedOnDate'] = formattedDate;
    if (this.command() === 'disburse') payload['actualDisbursementDate'] = formattedDate;
    return payload;
  }

  private handleLoanAction(formattedDate: string): {
    obs$: Observable<unknown> | null;
    redirectPath: string;
  } {
    const redirectPath = `/loans/view/${this.accountId}`;
    let obs$: Observable<unknown> | null = null;

    if (this.command() === 'applycharges') {
      const chargePayload: PostLoansLoanIdChargesRequest = {
        chargeId: this.chargeId,
        amount: this.amount,
        dueDate: formattedDate,
        dateFormat: FINERACT_DATE_FORMAT,
        locale: FINERACT_LOCALE,
      };
      obs$ = this.loanChargesService.postLoansLoanIdCharges(this.accountId, chargePayload);
    } else if (this.command() === 'assignloanofficer') {
      const payload: PostLoansLoanIdRequest = {
        toLoanOfficerId: this.toLoanOfficerId,
        assignmentDate: formattedDate,
        locale: FINERACT_LOCALE,
        dateFormat: FINERACT_DATE_FORMAT,
      };
      obs$ = this.loansService.postLoansLoanId(this.accountId, payload, this.command());
    } else if (this.command() === 'unassignloanofficer') {
      const payload: PostLoansLoanIdRequest = {
        unassignedDate: formattedDate,
        locale: FINERACT_LOCALE,
        dateFormat: FINERACT_DATE_FORMAT,
      };
      obs$ = this.loansService.postLoansLoanId(this.accountId, payload, this.command());
    } else {
      const raw =
        this.command() === 'approve'
          ? this.buildLoanApprovePayload(formattedDate)
          : this.buildLoanStatePayload(formattedDate);
      obs$ = this.loansService.postLoansLoanId(
        this.accountId,
        raw as PostLoansLoanIdRequest,
        this.command(),
      );
    }

    return { obs$, redirectPath };
  }

  private handleDepositAction(formattedDate: string): {
    obs$: Observable<unknown> | null;
    redirectPath: string;
  } {
    let obs$: Observable<unknown> | null = null;
    let redirectPath = '';

    const payload: Record<string, unknown> = {
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
    };
    if (this.note && this.command() !== 'activate') {
      payload['note'] = this.note;
    }
    if (this.command() === 'approve') payload['approvedOnDate'] = formattedDate;
    if (this.command() === 'activate') payload['activatedOnDate'] = formattedDate;
    if (this.command() === 'close') payload['closedOnDate'] = formattedDate;

    if (this.accountType() === 'savings') {
      obs$ = this.savingsService.postSavingsaccountsAccountId(
        this.accountId,
        payload,
        this.command(),
      );
      redirectPath = '/products/savings-accounts';
    } else if (this.accountType() === 'fixed') {
      obs$ = this.fixedDepositService.postFixeddepositaccountsAccountId(
        this.accountId,
        payload,
        this.command(),
      );
      redirectPath = '/products/fixed-deposits';
    } else if (this.accountType() === 'recurring') {
      obs$ = this.recurringDepositService.postRecurringdepositaccountsAccountId(
        this.accountId,
        payload,
        this.command(),
      );
      redirectPath = '/products/recurring-deposits';
    }

    return { obs$, redirectPath };
  }

  onCancel(): void {
    const paths: Record<string, string> = {
      savings: '/products/savings-accounts',
      fixed: '/products/fixed-deposits',
      recurring: '/products/recurring-deposits',
      loan: `/loans/view/${this.accountId}`,
    };
    this.router.navigate([paths[this.accountType()] || '/dashboard']);
  }
}
