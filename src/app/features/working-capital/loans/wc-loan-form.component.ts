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

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PlatformDateService } from '../../../core/services/platform-date.service';
import { DateFieldComponent } from '../../../ui/date-field/date-field.component';
import { FormsModule } from '@angular/forms';
import { I18N, TranslatePipe } from '../../../core/adapters';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonDatetime,
  IonDatetimeButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
} from '@ionic/angular/standalone';
import {
  WorkingCapitalLoansService,
  WorkingCapitalNearBreachService,
  PostWorkingCapitalLoansRequest,
  PutWorkingCapitalLoansLoanIdRequest,
  GetWorkingCapitalLoanProductsResponse,
  GetWorkingCapitalLoanBreach,
  WorkingCapitalNearBreachData,
  StringEnumOptionData,
  GetDelinquencyBucket,
  FundData,
  DataTablesService,
  EntityDataTableService,
  ResultsetColumnHeaderData,
} from '../../../api';
import {
  formatDateToFineract,
  toIsoDate,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
} from '../../../core/utils/date-formatter';
import { createPickersReady } from '../../../shared/utils/pickers-ready';
import { DialogService } from '../../../core/services/dialog.service';
import {
  DatatableEntryDialogComponent,
  DatatableEntryDialogData,
} from '../../../shared/components/datatable-entry-dialog/datatable-entry-dialog.component';

/**
 * A datatable Fineract will not let this loan be created without.
 *
 * `status.id` 100 is CREATE. The platform refuses the application outright —
 * 403 "Please fill in the data table [x] before creating this working capital loan." — and the
 * create request carries the rows inline, so the row cannot be added afterwards either. The form
 * collects the fields and sends them with the application.
 */
interface RequiredDatatable {
  name: string;
  columns: ResultsetColumnHeaderData[];
  /** What the user filled in, or undefined while it is outstanding. */
  data?: Record<string, unknown>;
}

/** `statusEnum.create`, the only check status that applies to creating a loan. */
const CREATE_CHECK_STATUS = 100;

/**
 * Create form for a Working Capital Loan application. Required fields are
 * clientId, productId and principalAmount; common optionals (dates, repayment
 * terms, breach references) are also captured. Option lists come from the
 * working-capital-loans template endpoint.
 */
@Component({
  selector: 'app-wc-loan-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    DateFieldComponent,
    IonButton,
    IonSpinner,
    IonIcon,
    IonInput,
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
    IonModal,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{
            (isEdit() ? 'WC_LOANS.ACTIONS.MODIFY' : 'WC_LOANS.CREATE') | appTranslate
          }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <!-- In edit mode the form is withheld until the loan arrives. Prefilling bindings
               that have already been checked is an NG0100 in development and an inconsistent
               first paint in production, and an empty form that fills itself in a moment later
               is worse to use than a spinner. -->
          @if (isReady()) {
            <form #loanForm="ngForm" (ngSubmit)="onSubmit()" class="wc-form">
              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'WC_LOANS.CLIENT_ID' | appTranslate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'WC_LOANS.CLIENT_ID' | appTranslate"
                  type="number"
                  name="clientId"
                  [(ngModel)]="loan.clientId"
                  required
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'WC_LOANS.PRODUCT' | appTranslate }}</ion-label>
                <ion-select
                  [attr.aria-label]="'WC_LOANS.PRODUCT' | appTranslate"
                  interface="popover"
                  name="productId"
                  [(ngModel)]="loan.productId"
                  required
                >
                  @for (opt of productOptions(); track opt.id) {
                    <ion-select-option [value]="opt.id">{{ opt.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'WC_LOANS.PRINCIPAL' | appTranslate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'WC_LOANS.PRINCIPAL' | appTranslate"
                  type="number"
                  name="principalAmount"
                  [(ngModel)]="loan.principalAmount"
                  required
                ></ion-input>
              </ion-item>

              <app-date-field
                label="WC_LOANS.SUBMITTED_ON_DATE"
                pickerId="submittedOnDate-picker"
                [clearable]="true"
                name="submittedOnDate"
                [(ngModel)]="submittedOnDate"
              ></app-date-field>

              <app-date-field
                label="WC_LOANS.EXPECTED_DISBURSEMENT_DATE"
                [required]="true"
                pickerId="expectedDisbursementDate-picker"
                name="expectedDisbursementDate"
                [(ngModel)]="expectedDisbursementDate"
              ></app-date-field>

              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'WC_LOANS.REPAYMENT_EVERY' | appTranslate
                }}</ion-label>
                <ion-input
                  [attr.aria-label]="'WC_LOANS.REPAYMENT_EVERY' | appTranslate"
                  type="number"
                  name="repaymentEvery"
                  [(ngModel)]="loan.repaymentEvery"
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'WC_LOANS.REPAYMENT_FREQUENCY_TYPE' | appTranslate
                }}</ion-label>
                <ion-select
                  [attr.aria-label]="'WC_LOANS.REPAYMENT_FREQUENCY_TYPE' | appTranslate"
                  interface="popover"
                  name="repaymentFrequencyType"
                  [(ngModel)]="loan.repaymentFrequencyType"
                >
                  @for (opt of repaymentFrequencyTypeOptions(); track opt.id) {
                    <ion-select-option [value]="opt.code">{{ opt.value }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'WC_LOANS.BREACH' | appTranslate }}</ion-label>
                <ion-select
                  [attr.aria-label]="'WC_LOANS.BREACH' | appTranslate"
                  interface="popover"
                  name="breachId"
                  [(ngModel)]="loan.breachId"
                >
                  @for (opt of breachOptions(); track opt.id) {
                    <ion-select-option [value]="opt.id">{{ opt.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'WC_LOANS.NEAR_BREACH' | appTranslate
                }}</ion-label>
                <ion-select
                  [attr.aria-label]="'WC_LOANS.NEAR_BREACH' | appTranslate"
                  interface="popover"
                  name="nearBreachId"
                  [(ngModel)]="loan.nearBreachId"
                >
                  @for (opt of nearBreachOptions(); track opt.id) {
                    <ion-select-option [value]="opt.id">{{ opt.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'WC_LOANS.DELINQUENCY_BUCKET' | appTranslate
                }}</ion-label>
                <ion-select
                  [attr.aria-label]="'WC_LOANS.DELINQUENCY_BUCKET' | appTranslate"
                  interface="popover"
                  name="delinquencyBucketId"
                  [(ngModel)]="loan.delinquencyBucketId"
                >
                  @for (opt of delinquencyBucketOptions(); track opt.id) {
                    <ion-select-option [value]="opt.id">{{ opt.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'WC_LOANS.FUND' | appTranslate }}</ion-label>
                <ion-select
                  [attr.aria-label]="'WC_LOANS.FUND' | appTranslate"
                  interface="popover"
                  name="fundId"
                  [(ngModel)]="loan.fundId"
                >
                  @for (opt of fundOptions(); track opt.id) {
                    <ion-select-option [value]="opt.id">{{ opt.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'WC_LOANS.PERIOD_PAYMENT_RATE' | appTranslate
                }}</ion-label>
                <ion-input
                  [attr.aria-label]="'WC_LOANS.PERIOD_PAYMENT_RATE' | appTranslate"
                  type="number"
                  name="periodPaymentRate"
                  [(ngModel)]="loan.periodPaymentRate"
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'WC_LOANS.TOTAL_PAYMENT_VOLUME' | appTranslate
                }}</ion-label>
                <ion-input
                  [attr.aria-label]="'WC_LOANS.TOTAL_PAYMENT_VOLUME' | appTranslate"
                  type="number"
                  name="totalPaymentVolume"
                  [(ngModel)]="loan.totalPaymentVolume"
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'WC_LOANS.EXTERNAL_ID' | appTranslate
                }}</ion-label>
                <ion-input
                  [attr.aria-label]="'WC_LOANS.EXTERNAL_ID' | appTranslate"
                  name="externalId"
                  [(ngModel)]="loan.externalId"
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'WC_LOANS.SUBMITTED_ON_NOTE' | appTranslate
                }}</ion-label>
                <ion-textarea
                  [attr.aria-label]="'WC_LOANS.SUBMITTED_ON_NOTE' | appTranslate"
                  name="submittedOnNote"
                  [(ngModel)]="loan.submittedOnNote"
                ></ion-textarea>
              </ion-item>

              @if (requiredDatatables().length) {
                <!--
                  Datatables this tenant has registered as a CREATE check. Fineract refuses the
                  application until each has a row, and the create request carries them inline,
                  so they are collected here rather than added afterwards (issue #776).
                -->
                <div class="required-datatables" data-testid="wc-loan-required-datatables">
                  <h3>{{ 'SYSTEM.REQUIRED_CUSTOM_DATA' | appTranslate }}</h3>
                  @for (entry of requiredDatatables(); track entry.name) {
                    <div class="required-datatable">
                      <span class="required-name">
                        {{ entry.name }}
                        @if (entry.data) {
                          <ion-icon
                            name="checkmark-circle-outline"
                            color="success"
                            [attr.aria-label]="'COMMON.DONE' | appTranslate"
                          ></ion-icon>
                        }
                      </span>
                      <ion-button
                        fill="outline"
                        size="small"
                        type="button"
                        [attr.data-testid]="'wc-loan-fill-' + entry.name"
                        (click)="onFillRequiredDatatable(entry)"
                      >
                        {{ datatableActionLabel(entry) }}
                      </ion-button>
                    </div>
                  }
                </div>
              }

              <div class="form-actions">
                <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                  {{ 'COMMON.CANCEL' | appTranslate }}
                </ion-button>
                <ion-button
                  color="primary"
                  type="submit"
                  data-testid="wc-loan-submit"
                  [disabled]="loanForm.invalid || isSaving() || hasOutstandingDatatables()"
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
          } @else {
            <div class="form-loading">
              <ion-spinner name="crescent"></ion-spinner>
            </div>
          }
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
      .wc-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-loading {
        display: flex;
        justify-content: center;
        padding: 32px;
      }
      .required-datatables h3 {
        margin: 0 0 8px;
        font-size: 15px;
        font-weight: 600;
      }
      .required-datatable {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 4px 0;
      }
      .required-name {
        display: flex;
        align-items: center;
        gap: 6px;
      }
    `,
  ],
})
export class WcLoanFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly platformDate = inject(PlatformDateService);
  private readonly loansService = inject(WorkingCapitalLoansService);
  private readonly nearBreachService = inject(WorkingCapitalNearBreachService);
  private readonly entityChecksService = inject(EntityDataTableService);
  private readonly datatablesService = inject(DataTablesService);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/working-capital/loans';

  readonly isSaving = signal(false);

  /**
   * Set when the route carried an `:id`, which only `loans/edit/:id` does.
   *
   * The same form serves both; Fineract's `PUT` body is the `POST` body, and a second screen for
   * the same fields would be two places to change whenever the application shape does.
   */
  readonly loanId = signal<number | null>(null);
  readonly isEdit = signal(false);

  /** False only while an edit-mode prefill is in flight. */
  readonly isReady = signal(true);

  /**
   * The loaded application, to diff the submit against.
   *
   * `PUT /working-capital-loans/{id}` is a modification command: Fineract applies the fields it is
   * given and audits them as changes. Sending the whole form back would log every field as
   * modified on every save, so only what the user actually changed is sent.
   */
  private loaded: Partial<PutWorkingCapitalLoansLoanIdRequest> = {};

  loan: Partial<PostWorkingCapitalLoansRequest> = {};
  submittedOnDate: string | null = null;
  /**
   * Seeded, not left blank: `WorkingCapitalLoanApplicationDataValidator` marks this one
   * mandatory, so an empty field would let the operator submit and collect a refusal. The
   * platform's own today, through `PlatformDateService` — the browser's is a different day for
   * part of every day where the tenant is east of the operator (#758).
   *
   * `submittedOnDate` above is the opposite case. The same validator documents it as optional
   * and substitutes the platform's current date when it is absent, so leaving it unset is a
   * real choice and the field says so rather than showing today.
   */
  expectedDisbursementDate: string | null = this.platformDate.today();

  readonly productOptions = signal<GetWorkingCapitalLoanProductsResponse[]>([]);
  readonly breachOptions = signal<GetWorkingCapitalLoanBreach[]>([]);
  readonly nearBreachOptions = signal<WorkingCapitalNearBreachData[]>([]);
  readonly repaymentFrequencyTypeOptions = signal<StringEnumOptionData[]>([]);
  readonly delinquencyBucketOptions = signal<GetDelinquencyBucket[]>([]);
  readonly fundOptions = signal<FundData[]>([]);

  /** Datatables registered as a CREATE check on `m_wc_loan`; empty for most tenants. */
  readonly requiredDatatables = signal<RequiredDatatable[]>([]);
  /** True while a required datatable is still outstanding, which the platform would refuse. */
  readonly hasOutstandingDatatables = computed(() =>
    this.requiredDatatables().some((entry) => entry.data === undefined),
  );

  /**
   * Refines the seeded disbursement date once the platform has answered.
   *
   * Called after the edit-mode decision below, not before: the resolution can answer
   * immediately from cache, and seeding then would write today over a loan's own date.
   */
  private resolveDisbursementDate(): void {
    this.platformDate.resolveToday().subscribe((today) => {
      if (this.isEdit()) return;
      this.expectedDisbursementDate = today;
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loanId.set(+id);
      this.isEdit.set(true);
      this.isReady.set(false);
      this.loadLoan(+id);
    }
    if (!this.isEdit()) {
      this.loadCreateChecks();
    }
    this.resolveDisbursementDate();
    this.nearBreachService.getWorkingCapitalNearBreach().subscribe((data) => {
      this.nearBreachOptions.set(data);
    });
    this.loansService.getWorkingCapitalLoansTemplate().subscribe((tpl) => {
      this.productOptions.set(tpl.productOptions ?? []);
      this.breachOptions.set(tpl.breachOptions ?? []);
      this.repaymentFrequencyTypeOptions.set(tpl.periodFrequencyTypeOptions ?? []);
      this.delinquencyBucketOptions.set(tpl.delinquencyBucketOptions ?? []);
      this.fundOptions.set(tpl.fundOptions ?? []);
    });
  }

  /** Prefills the form from the loan being modified. */
  private loadLoan(loanId: number): void {
    this.loansService.getWorkingCapitalLoansLoanId(loanId).subscribe({
      next: (loan) => {
        this.loan = {
          clientId: loan.clientId,
          productId: loan.loanProductId,
          fundId: loan.fundId,
          externalId: loan.externalId,
          principalAmount: loan.principal,
          totalPaymentVolume: loan.totalPaymentVolume,
          // `paymentRate` is the rate the loan was priced at; `periodPaymentRate` is what the
          // create and modify bodies call the same number.
          periodPaymentRate: loan.paymentRate,
          repaymentEvery: loan.repaymentEvery,
          repaymentFrequencyType: loan.repaymentFrequencyType
            ?.code as PostWorkingCapitalLoansRequest.RepaymentFrequencyTypeEnum,
          breachId: loan.breach?.id,
          nearBreachId: loan.nearBreach?.id,
          delinquencyBucketId: loan.delinquencyBucket?.id,
        };
        this.submittedOnDate = loan.timeline?.submittedOnDate
          ? toIsoDate(new Date(loan.timeline.submittedOnDate))
          : null;
        this.expectedDisbursementDate = loan.timeline?.expectedDisbursementDate
          ? toIsoDate(new Date(loan.timeline.expectedDisbursementDate))
          : null;
        this.loaded = { ...this.loan };
        this.isReady.set(true);
      },
      error: (err: unknown) => {
        // Show the form rather than an endless spinner: the user can still fill it in, and the
        // interceptor has already surfaced the failure.
        this.isReady.set(true);
        console.error('Failed to load the working capital loan', err);
      },
    });
  }

  /**
   * Finds the datatables this tenant requires before a Working Capital loan may be created.
   *
   * A failure here is left silent beyond the log: entity datatable checks are an uncommon
   * configuration, and a tenant that has none would otherwise see an error for a call whose
   * answer is "nothing to do". The platform still refuses a create that needs one, and says
   * which table it wants.
   */
  private loadCreateChecks(): void {
    // Filtered by the platform rather than by this form: the endpoint takes both, and the
    // client-side filter below stays as the guarantee, because a tenant with many checks would
    // otherwise be paged through.
    this.entityChecksService.getEntityDatatableChecks(CREATE_CHECK_STATUS, 'm_wc_loan').subscribe({
      next: (page) => {
        const required = (page.pageItems ?? []).filter(
          (check) =>
            check.entity === 'm_wc_loan' &&
            check.status?.id === CREATE_CHECK_STATUS &&
            !!check.datatableName,
        );
        for (const check of required) {
          this.loadRequiredDatatable(check.datatableName!);
        }
      },
      error: (err: unknown) => console.error('Failed to load entity datatable checks', err),
    });
  }

  /** Reads one required table's columns, which are what the dialog renders fields from. */
  private loadRequiredDatatable(name: string): void {
    this.datatablesService.getDatatablesDatatable(name).subscribe({
      next: (table) => {
        this.requiredDatatables.update((entries) => [
          ...entries,
          { name, columns: table.columnHeaderData ?? [] },
        ]);
      },
      error: (err: unknown) => console.error(`Failed to load the datatable ${name}`, err),
    });
  }

  /**
   * Collects one required table's fields.
   *
   * The entry dialog does the rendering, in its collect-only mode: there is no loan yet to post
   * a row against, and the create request carries the rows inline. Reopening it shows what was
   * entered, so a correction does not mean retyping.
   */
  async onFillRequiredDatatable(entry: RequiredDatatable): Promise<void> {
    const data: DatatableEntryDialogData = {
      datatableName: entry.name,
      apptableId: 0,
      columns: entry.columns,
      row: entry.data,
      collectOnly: true,
    };
    const values = await this.dialogService.open<Record<string, unknown>>(
      DatatableEntryDialogComponent,
      { data },
    );
    if (!values) return;
    this.requiredDatatables.update((entries) =>
      entries.map((candidate) =>
        candidate.name === entry.name ? { ...candidate, data: values } : candidate,
      ),
    );
  }

  /** The label for one required table's button: fill it in, or change what was filled in. */
  datatableActionLabel(entry: RequiredDatatable): string {
    return this.i18n.translate(entry.data === undefined ? 'SYSTEM.ADD_ENTRY' : 'COMMON.EDIT');
  }

  onSubmit(): void {
    this.isSaving.set(true);
    return this.isEdit() ? this.submitModification() : this.submitApplication();
  }

  private submitApplication(): void {
    const request: Partial<PostWorkingCapitalLoansRequest> = {
      ...this.loan,
      locale: FINERACT_LOCALE,
      dateFormat: FINERACT_DATE_FORMAT,
    };

    if (this.submittedOnDate) {
      request.submittedOnDate = formatDateToFineract(this.submittedOnDate);
    }
    if (this.expectedDisbursementDate) {
      request.expectedDisbursementDate = formatDateToFineract(this.expectedDisbursementDate);
    }
    const datatables = this.requiredDatatables()
      .filter((entry) => entry.data !== undefined)
      // The spec types each value as `object`, which no datatable value is: they are strings,
      // numbers, booleans and dates. Narrowed here rather than in the collected record, whose
      // own shape is honest.
      .map((entry) => ({
        registeredTableName: entry.name,
        data: entry.data as Record<string, object>,
      }));
    if (datatables.length) {
      request.datatables = datatables;
    }

    this.loansService.postWorkingCapitalLoans(request as PostWorkingCapitalLoansRequest).subscribe({
      next: () => this.router.navigate([this.LIST_PATH]),
      error: () => this.isSaving.set(false),
    });
  }

  /** Sends only what changed, plus the dates, which Fineract re-validates together. */
  private submitModification(): void {
    const loanId = this.loanId();
    if (loanId === null) return;

    const request: Partial<PutWorkingCapitalLoansLoanIdRequest> = {
      locale: FINERACT_LOCALE,
      dateFormat: FINERACT_DATE_FORMAT,
    };
    for (const [key, value] of Object.entries(this.loan) as [
      keyof PutWorkingCapitalLoansLoanIdRequest,
      unknown,
    ][]) {
      if (value !== this.loaded[key]) {
        Object.assign(request, { [key]: value });
      }
    }
    if (this.submittedOnDate) {
      request.submittedOnDate = formatDateToFineract(this.submittedOnDate);
    }
    if (this.expectedDisbursementDate) {
      request.expectedDisbursementDate = formatDateToFineract(this.expectedDisbursementDate);
    }

    this.loansService
      .putWorkingCapitalLoansLoanId(loanId, request as PutWorkingCapitalLoansLoanIdRequest)
      .subscribe({
        next: () => this.router.navigate([`${this.LIST_PATH}/view/${loanId}`]),
        error: () => this.isSaving.set(false),
      });
  }

  onCancel(): void {
    const loanId = this.loanId();
    this.router.navigate(loanId === null ? [this.LIST_PATH] : [`${this.LIST_PATH}/view/${loanId}`]);
  }
}
