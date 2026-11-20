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

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { PlatformDateService } from '../../core/services/platform-date.service';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import {
  COLLECTION_SHEET_API,
  TranslatePipe,
  type CollectionSheet,
  type CollectionSheetCollections,
  type CollectionSheetGroup,
  type CollectionSheetLoanPayment,
  type CollectionSheetSavingsPayment,
} from '../../core/adapters';
import { OfficesService, StaffService, StaffData } from '../../api';
import { NotificationService } from '../../core/services/notification.service';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonDatetime,
  IonDatetimeButton,
  IonItem,
  IonInput,
  IonLabel,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';
import { createPickersReady } from '../../shared/utils/pickers-ready';

@Component({
  selector: 'app-collection-sheet',
  standalone: true,
  imports: [
    FormsModule,
    DecimalPipe,
    TranslatePipe,
    IonButton,
    IonSpinner,
    IonItem,
    IonLabel,
    IonInput,
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
    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ 'COLLECTION_SHEET.TITLE' | appTranslate }}</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        @if (isLoading()) {
          <div class="spinner-container">
            <ion-spinner name="crescent"></ion-spinner>
          </div>
        }

        @if (!generated() && !isLoading()) {
          <form #filterForm="ngForm" (ngSubmit)="generate()">
            <ion-item fill="outline" class="full-width">
              <ion-label position="stacked">{{
                'COLLECTION_SHEET.OFFICE' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'COLLECTION_SHEET.OFFICE' | appTranslate"
                interface="popover"
                name="officeId"
                [(ngModel)]="request.officeId"
                (ngModelChange)="onOfficeChange($event)"
                required
              >
                @for (office of offices(); track office.id) {
                  <ion-select-option [value]="office.id">{{ office.name }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <ion-item fill="outline" class="full-width">
              <ion-label position="stacked">{{ 'COLLECTION_SHEET.DATE' | appTranslate }}</ion-label>
              @if (pickersReady()) {
                <ion-datetime-button datetime="transactionDate-picker"></ion-datetime-button>
              }
              <ion-modal [keepContentsMounted]="true">
                <ng-template>
                  <ion-datetime
                    id="transactionDate-picker"
                    data-testid="transactionDate-picker"
                    presentation="date"
                    name="transactionDate"
                    [(ngModel)]="transactionDate"
                    required
                  ></ion-datetime>
                </ng-template>
              </ion-modal>
            </ion-item>

            <!--
              A select, not the number box this was: it asked for a staff member's database id,
              which nobody operating a branch knows. The options come from the office, the way
              Fineract scopes staff.
            -->
            <ion-item fill="outline" class="full-width">
              <ion-label position="stacked">{{
                'COLLECTION_SHEET.STAFF' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'COLLECTION_SHEET.STAFF' | appTranslate"
                interface="popover"
                name="staffId"
                data-testid="collection-sheet-staff"
                [disabled]="request.officeId === undefined"
                [(ngModel)]="staffId"
              >
                @for (member of staff(); track member.id) {
                  <ion-select-option [value]="member.id">{{
                    member.displayName
                  }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <div class="actions">
              <ion-button color="primary" type="submit" [disabled]="filterForm.invalid">
                {{ 'COLLECTION_SHEET.GENERATE' | appTranslate }}
              </ion-button>
            </div>
          </form>
        }

        @if (generated() && !isLoading()) {
          <h3>{{ 'COLLECTION_SHEET.RESULTS' | appTranslate }}</h3>
          <!--
            Fineract answers command=generate with 200 and an empty body when nothing is due,
            which arrives as null. This used to print the word "null" under the heading and still
            offer Save, so the operator was invited to save nothing.
          -->
          @if (hasSheet()) {
            <div data-testid="collection-sheet-results">
              @for (group of sheet()!.groups; track group.groupId) {
                <section class="sheet-group">
                  <h4 class="group-heading">
                    {{ group.groupName }}
                    @if (group.staffName) {
                      <span class="group-meta">{{ group.staffName }}</span>
                    }
                  </h4>

                  <table class="sheet-table">
                    <caption class="sr-only">
                      {{
                        group.groupName
                      }}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">{{ 'COLLECTION_SHEET.CLIENT' | appTranslate }}</th>
                        <th scope="col">{{ 'COLLECTION_SHEET.ACCOUNT' | appTranslate }}</th>
                        <th scope="col">{{ 'COLLECTION_SHEET.PRODUCT' | appTranslate }}</th>
                        <th scope="col" class="numeric">
                          {{ 'COLLECTION_SHEET.DUE' | appTranslate }}
                        </th>
                        <th scope="col" class="numeric">
                          {{ 'COLLECTION_SHEET.COLLECTED' | appTranslate }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (client of group.clients; track client.clientId) {
                        @for (loan of client.loans; track loan.loanId) {
                          <tr>
                            <td>{{ client.clientName }}</td>
                            <td>{{ loan.accountId }}</td>
                            <td>{{ loan.productShortName }}</td>
                            <td class="numeric">{{ loan.totalDue | number: '1.2-2' }}</td>
                            <td class="numeric">
                              <ion-input
                                class="collect-input"
                                type="number"
                                inputmode="decimal"
                                min="0"
                                [attr.aria-label]="
                                  ('COLLECTION_SHEET.COLLECTED' | appTranslate) +
                                  ' ' +
                                  loan.accountId
                                "
                                [attr.data-testid]="'collect-loan-' + loan.loanId"
                                [value]="loanCollected()[loan.loanId] ?? 0"
                                (ionInput)="onCollectLoan(loan.loanId, $event)"
                              ></ion-input>
                            </td>
                          </tr>
                        }
                        @for (account of client.savings; track account.savingsId) {
                          <tr>
                            <td>{{ client.clientName }}</td>
                            <td>{{ account.accountId }}</td>
                            <td>{{ account.productName }}</td>
                            <td class="numeric">{{ account.dueAmount | number: '1.2-2' }}</td>
                            <td class="numeric">
                              <!--
                                Not editable when the sheet did not say which kind of deposit
                                account this is: the save posts the type as an id, the sheet
                                reports it as a phrase, and a deposit sent without one is
                                accepted and then silently does nothing.
                              -->
                              @if (account.depositAccountTypeId === null) {
                                <span
                                  class="not-collectable"
                                  [attr.data-testid]="
                                    'collect-savings-blocked-' + account.savingsId
                                  "
                                  >{{ 'COLLECTION_SHEET.NOT_COLLECTABLE' | appTranslate }}</span
                                >
                              } @else {
                                <ion-input
                                  class="collect-input"
                                  type="number"
                                  inputmode="decimal"
                                  min="0"
                                  [attr.aria-label]="
                                    ('COLLECTION_SHEET.COLLECTED' | appTranslate) +
                                    ' ' +
                                    account.accountId
                                  "
                                  [attr.data-testid]="'collect-savings-' + account.savingsId"
                                  [value]="savingsCollected()[account.savingsId] ?? 0"
                                  (ionInput)="onCollectSavings(account.savingsId, $event)"
                                ></ion-input>
                              }
                            </td>
                          </tr>
                        }
                        @if (client.loans.length === 0 && client.savings.length === 0) {
                          <!-- Present at the meeting with nothing due. The row still belongs on
                               the sheet: the officer has to see who was expected. -->
                          <tr>
                            <td>{{ client.clientName }}</td>
                            <td colspan="2">{{ 'COLLECTION_SHEET.NOTHING_DUE' | appTranslate }}</td>
                            <td class="numeric">{{ 0 | number: '1.2-2' }}</td>
                            <td></td>
                          </tr>
                        }
                      }
                    </tbody>
                    <tfoot>
                      <tr>
                        <th scope="row" colspan="3">
                          {{ 'COLLECTION_SHEET.GROUP_TOTAL' | appTranslate }}
                        </th>
                        <td class="numeric" [attr.data-testid]="'group-total-' + group.groupId">
                          {{ group.totalDue | number: '1.2-2' }}
                        </td>
                        <td class="numeric" [attr.data-testid]="'group-collected-' + group.groupId">
                          {{ collectedFor(group) | number: '1.2-2' }}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </section>
              }

              <p class="sheet-total" data-testid="collection-sheet-total">
                {{ 'COLLECTION_SHEET.SHEET_TOTAL' | appTranslate }}:
                <strong>{{ sheet()!.totalDue | number: '1.2-2' }}</strong>
              </p>
              <p class="sheet-total" data-testid="collection-sheet-collected-total">
                {{ 'COLLECTION_SHEET.COLLECTED_TOTAL' | appTranslate }}:
                <strong>{{ collectedTotal() | number: '1.2-2' }}</strong>
              </p>
            </div>
          } @else {
            <p class="empty-state" role="status" data-testid="collection-sheet-empty">
              {{ 'COLLECTION_SHEET.NOTHING_DUE' | appTranslate }}
            </p>
          }
          <div class="actions">
            <ion-button fill="clear" (click)="back()">
              {{ 'COLLECTION_SHEET.BACK' | appTranslate }}
            </ion-button>
            @if (hasSheet()) {
              <ion-button color="primary" (click)="save()">
                {{ 'COLLECTION_SHEET.SAVE' | appTranslate }}
              </ion-button>
            }
          </div>
        }
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      ion-card {
        max-width: 640px;
        margin: 24px auto;
      }
      .full-width {
        width: 100%;
        margin-bottom: 12px;
      }
      .actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 8px;
      }
      .spinner-container {
        display: flex;
        justify-content: center;
        padding: 32px;
      }
      .sheet-group {
        margin-bottom: var(--space-5, 24px);
      }
      .group-heading {
        display: flex;
        align-items: baseline;
        gap: var(--space-3, 12px);
        margin: 0 0 var(--space-2, 8px);
      }
      .group-meta {
        font-size: 0.85rem;
        color: var(--ion-color-medium);
      }
      .sheet-table {
        width: 100%;
        border-collapse: collapse;
      }
      .sheet-table th,
      .sheet-table td {
        padding: var(--space-2, 8px);
        border-bottom: 1px solid var(--ion-color-step-150, #e0e0e0);
        text-align: left;
      }
      .sheet-table .numeric {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .sheet-total {
        text-align: right;
      }
      .collect-input {
        --padding-start: var(--space-2, 8px);
        --padding-end: var(--space-2, 8px);
        min-height: 32px;
        text-align: right;
        border: 1px solid var(--ion-color-step-150, #e0e0e0);
        border-radius: 4px;
      }
      .not-collectable {
        font-size: 0.8rem;
        color: var(--ion-color-medium);
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }
    `,
  ],
})
export class CollectionSheetComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly sheets = inject(COLLECTION_SHEET_API);
  /**
   * Today, as the platform reckons it: the business date when one governs, and the platform's
   * own clock otherwise. Fineract judges "the future" by that reckoning, so a date seeded from
   * `new Date()` is refused whenever the browser runs ahead of it (#758).
   */
  private readonly platformDate = inject(PlatformDateService);
  private officesService = inject(OfficesService);
  private staffService = inject(StaffService);
  private notifications = inject(NotificationService);

  readonly generated = signal(false);
  readonly isLoading = signal(false);
  readonly sheet = signal<CollectionSheet | null>(null);
  /**
   * What the officer says was collected, by loan id and by savings id.
   *
   * Seeded from the dues, because at most meetings the client pays what is owed and retyping
   * every figure would be the slower path. Kept apart from {@link sheet} all the same: the dues
   * are the platform's answer and these are the officer's, and only these are posted back.
   */
  readonly loanCollected = signal<Record<number, number>>({});
  readonly savingsCollected = signal<Record<number, number>>({});
  transactionDate = this.platformDate.today();
  staffId: number | null = null;
  /** The filters the form collects. The adapter owns the date format and locale. */
  request: { officeId?: number } = {};

  readonly offices = signal<{ id?: number; name?: string }[]>([]);
  readonly staff = signal<StaffData[]>([]);

  /**
   * Whether the generated sheet holds anything.
   *
   * `command=generate` answers 200 with an empty body when nothing is due in the period, which
   * `HttpClient` delivers as `null`.
   */
  readonly hasSheet = computed(() => this.sheet() !== null);

  /** Everything entered across the sheet, against the platform's total beside it. */
  readonly collectedTotal = computed(() =>
    (this.sheet()?.groups ?? []).reduce((sum, group) => sum + this.collectedFor(group), 0),
  );

  ngOnInit(): void {
    this.officesService.getOffices().subscribe({
      next: (res: unknown) => {
        this.offices.set(Array.isArray(res) ? (res as { id?: number; name?: string }[]) : []);
      },
      error: () => {
        this.notifications.error('Failed to load offices');
      },
    });
  }

  /**
   * Reloads the staff list for the chosen office, and drops a selection the new office has no
   * staff member for — Fineract refuses a staffId from another office.
   */
  onOfficeChange(officeId: number | undefined): void {
    this.staffId = null;
    this.staff.set([]);
    if (officeId === undefined || officeId === null) return;

    this.staffService.getStaff(officeId).subscribe({
      next: (members: StaffData[]) => this.staff.set(members ?? []),
      error: () => this.notifications.error('Failed to load staff'),
    });
  }

  private buildRequest() {
    return {
      officeId: this.request.officeId!,
      // Was collected by the form and then dropped on the floor: `staffId` is a field of its own
      // rather than part of `request`, and the old body spread `request` alone.
      ...(this.staffId === null ? {} : { staffId: this.staffId }),
      transactionDate: this.transactionDate,
    };
  }

  generate(): void {
    this.isLoading.set(true);
    this.sheets.generate(this.buildRequest()).subscribe({
      next: (sheet) => {
        this.sheet.set(sheet);
        this.seedCollected(sheet);
        this.generated.set(true);
        this.isLoading.set(false);
      },
      error: () => {
        this.notifications.error('Failed to generate collection sheet');
        this.isLoading.set(false);
      },
    });
  }

  /** Flattened for the table: every client row, with the group it belongs to. */
  rowsFor(group: CollectionSheetGroup) {
    return group.clients;
  }

  /** What has been entered against one group, for the row under its table. */
  collectedFor(group: CollectionSheetGroup): number {
    const loans = this.loanCollected();
    const savings = this.savingsCollected();
    return group.clients.reduce(
      (sum, client) =>
        sum +
        client.loans.reduce((loanSum, loan) => loanSum + (loans[loan.loanId] ?? 0), 0) +
        client.savings.reduce(
          (savingsSum, account) => savingsSum + (savings[account.savingsId] ?? 0),
          0,
        ),
      0,
    );
  }

  onCollectLoan(loanId: number, event: Event): void {
    this.loanCollected.update((current) => ({ ...current, [loanId]: readAmount(event) }));
  }

  onCollectSavings(savingsId: number, event: Event): void {
    this.savingsCollected.update((current) => ({ ...current, [savingsId]: readAmount(event) }));
  }

  /** Fills the inputs with what is due, which is what is usually paid. */
  private seedCollected(sheet: CollectionSheet | null): void {
    const loans: Record<number, number> = {};
    const savings: Record<number, number> = {};
    for (const group of sheet?.groups ?? []) {
      for (const client of group.clients) {
        for (const loan of client.loans) {
          loans[loan.loanId] = loan.totalDue;
        }
        for (const account of client.savings) {
          // Left at zero when the type is unknown: that row cannot be posted, and seeding it
          // would put an amount in a total that no save will ever carry.
          savings[account.savingsId] =
            account.depositAccountTypeId === null ? 0 : account.dueAmount;
        }
      }
    }
    this.loanCollected.set(loans);
    this.savingsCollected.set(savings);
  }

  /** The collections as the save command takes them: what was entered, not what was due. */
  private buildCollections(): CollectionSheetCollections {
    const loanAmounts = this.loanCollected();
    const savingsAmounts = this.savingsCollected();
    const loans: CollectionSheetLoanPayment[] = [];
    const savings: CollectionSheetSavingsPayment[] = [];

    for (const group of this.sheet()?.groups ?? []) {
      for (const client of group.clients) {
        for (const loan of client.loans) {
          loans.push({ loanId: loan.loanId, amount: loanAmounts[loan.loanId] ?? 0 });
        }
        for (const account of client.savings) {
          savings.push({
            savingsId: account.savingsId,
            amount: savingsAmounts[account.savingsId] ?? 0,
            depositAccountTypeId: account.depositAccountTypeId,
          });
        }
      }
    }
    return { loans, savings };
  }

  save(): void {
    this.isLoading.set(true);
    this.sheets.save(this.buildRequest(), this.buildCollections()).subscribe({
      next: () => {
        this.notifications.success('Collection sheet saved successfully');
        this.isLoading.set(false);
        this.back();
      },
      error: () => {
        this.notifications.error('Failed to save collection sheet');
        this.isLoading.set(false);
      },
    });
  }

  back(): void {
    this.generated.set(false);
    this.sheet.set(null);
    this.loanCollected.set({});
    this.savingsCollected.set({});
  }
}

/**
 * The number out of an `ionInput` event.
 *
 * `detail.value` is a string, and an emptied box sends `''`, which `Number('')` reads as 0 —
 * the right reading here, since clearing the box means nothing was collected.
 */
function readAmount(event: Event): number {
  const detail = (event as CustomEvent<{ value?: string | number | null }>).detail;
  const raw = detail?.value ?? (event.target as HTMLInputElement | null)?.value ?? '';
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
