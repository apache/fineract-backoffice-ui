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

import { Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';

import { TranslatePipe } from '../../../core/adapters';
import {
  ACCOUNTING_RULES_WITH_MAPPINGS,
  AccountingRuleId,
  AdvancedAccountingMappings,
  GlAccountOption,
  GlAccountOptions,
} from './product-accounting.model';

/** A payment type as the product template offers it. */
export interface PaymentTypeOption {
  id?: number;
  name?: string;
}

/** A charge as the product template offers it. */
export interface ChargeOption {
  id?: number;
  name?: string;
  penalty?: boolean;
}

/**
 * The three advanced mapping tables: payment channel to fund source, fee to income, penalty to
 * income.
 *
 * These are overrides on top of the base slots. Without them every payment lands in one fund
 * source and every fee in one income account, so a till cannot be reconciled at close of day and
 * a processing fee cannot be told apart from an insurance fee after the fact.
 *
 * **The platform validates almost nothing here**, which is why this component is careful. Checked
 * against a live instance, all of the following are accepted silently:
 *
 * - a fee mapping naming a charge that is not attached to the product;
 * - a fee mapping naming a charge whose `penalty` flag is `true`, and vice versa;
 * - two rows naming the same payment type.
 *
 * None of those post anything at run time — they are mappings that can never fire. A rejection
 * would at least be visible; silent acceptance produces a product that looks configured and is
 * not. So the options offered are narrowed to what can actually work: charges come from the
 * product's own selection rather than the tenant's whole catalogue, fees and penalties are drawn
 * from opposite sides of the `penalty` flag, and a payment type already mapped is not offered
 * again.
 */
@Component({
  selector: 'app-advanced-accounting-mappings',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonButton,
    IonIcon,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption,
  ],
  template: `
    @if (visible()) {
      <div class="advanced-section">
        <h3 class="section-title">{{ 'PRODUCTS.ACCOUNTING.ADVANCED_TITLE' | appTranslate }}</h3>
        <p class="section-note">{{ 'PRODUCTS.ACCOUNTING.ADVANCED_HINT' | appTranslate }}</p>

        <!-- Payment channel to fund source -->
        <h4 class="table-title">
          {{ 'PRODUCTS.ACCOUNTING.PAYMENT_CHANNEL_TITLE' | appTranslate }}
        </h4>
        @for (entry of paymentChannelRows(); track entry.index) {
          <div class="mapping-row" [attr.data-testid]="'payment-channel-row-' + entry.index">
            <ion-item fill="outline" class="row-field">
              <ion-label position="stacked">
                {{ 'PRODUCTS.ACCOUNTING.PAYMENT_TYPE' | appTranslate }}
              </ion-label>
              <ion-select
                [attr.aria-label]="'PRODUCTS.ACCOUNTING.PAYMENT_TYPE' | appTranslate"
                interface="popover"
                [name]="'paymentTypeId-' + entry.index"
                [attr.data-testid]="'payment-channel-type-' + entry.index"
                [ngModel]="entry.row.paymentTypeId"
                (ngModelChange)="setPaymentChannel(entry.index, 'paymentTypeId', $event)"
              >
                @for (option of entry.paymentTypes; track option.id) {
                  <ion-select-option [value]="option.id">{{ option.name }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <ion-item fill="outline" class="row-field">
              <ion-label position="stacked">
                {{ 'PRODUCTS.ACCOUNTING.FUND_SOURCE' | appTranslate }}
              </ion-label>
              <ion-select
                [attr.aria-label]="'PRODUCTS.ACCOUNTING.FUND_SOURCE' | appTranslate"
                interface="popover"
                [name]="'fundSourceAccountId-' + entry.index"
                [attr.data-testid]="'payment-channel-account-' + entry.index"
                [ngModel]="entry.row.fundSourceAccountId"
                (ngModelChange)="setPaymentChannel(entry.index, 'fundSourceAccountId', $event)"
              >
                @for (account of assetAccounts(); track account.id) {
                  <ion-select-option [value]="account.id">
                    {{ accountLabel(account) }}
                  </ion-select-option>
                }
              </ion-select>
            </ion-item>

            <ion-button
              fill="clear"
              color="danger"
              type="button"
              [attr.data-testid]="'payment-channel-remove-' + entry.index"
              [attr.aria-label]="'COMMON.DELETE' | appTranslate"
              (click)="removePaymentChannel(entry.index)"
            >
              <ion-icon name="trash-outline" slot="icon-only"></ion-icon>
            </ion-button>
          </div>
        }
        <ion-button
          fill="outline"
          size="small"
          type="button"
          data-testid="payment-channel-add"
          [disabled]="!canAddPaymentChannel()"
          (click)="addPaymentChannel()"
        >
          <ion-icon name="add-outline" slot="start"></ion-icon>
          {{ 'PRODUCTS.ACCOUNTING.ADD_MAPPING' | appTranslate }}
        </ion-button>

        <!-- Fee to income, and penalty to income: identical shape, opposite sides of the flag -->
        @for (table of chargeTables(); track table.key) {
          <h4 class="table-title">{{ table.title | appTranslate }}</h4>
          @if (!table.charges.length) {
            <p class="section-note" [attr.data-testid]="table.key + '-none'">
              {{ 'PRODUCTS.ACCOUNTING.NO_CHARGES_ON_PRODUCT' | appTranslate }}
            </p>
          }
          @for (entry of table.rows; track entry.index) {
            <div class="mapping-row" [attr.data-testid]="table.key + '-row-' + entry.index">
              <ion-item fill="outline" class="row-field">
                <ion-label position="stacked">{{ table.chargeLabel | appTranslate }}</ion-label>
                <ion-select
                  [attr.aria-label]="table.chargeLabel | appTranslate"
                  interface="popover"
                  [name]="table.key + '-chargeId-' + entry.index"
                  [attr.data-testid]="table.key + '-charge-' + entry.index"
                  [ngModel]="entry.row.chargeId"
                  (ngModelChange)="setChargeMapping(table.penalty, entry.index, 'chargeId', $event)"
                >
                  @for (charge of table.charges; track charge.id) {
                    <ion-select-option [value]="charge.id">{{ charge.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <ion-item fill="outline" class="row-field">
                <ion-label position="stacked">
                  {{ 'PRODUCTS.ACCOUNTING.INCOME_ACCOUNT' | appTranslate }}
                </ion-label>
                <ion-select
                  [attr.aria-label]="'PRODUCTS.ACCOUNTING.INCOME_ACCOUNT' | appTranslate"
                  interface="popover"
                  [name]="table.key + '-incomeAccountId-' + entry.index"
                  [attr.data-testid]="table.key + '-account-' + entry.index"
                  [ngModel]="entry.row.incomeAccountId"
                  (ngModelChange)="
                    setChargeMapping(table.penalty, entry.index, 'incomeAccountId', $event)
                  "
                >
                  @for (account of incomeAccounts(); track account.id) {
                    <ion-select-option [value]="account.id">
                      {{ accountLabel(account) }}
                    </ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <ion-button
                fill="clear"
                color="danger"
                type="button"
                [attr.data-testid]="table.key + '-remove-' + entry.index"
                [attr.aria-label]="'COMMON.DELETE' | appTranslate"
                (click)="removeChargeMapping(table.penalty, entry.index)"
              >
                <ion-icon name="trash-outline" slot="icon-only"></ion-icon>
              </ion-button>
            </div>
          }
          <ion-button
            fill="outline"
            size="small"
            type="button"
            [attr.data-testid]="table.key + '-add'"
            [disabled]="!table.charges.length"
            (click)="addChargeMapping(table.penalty)"
          >
            <ion-icon name="add-outline" slot="start"></ion-icon>
            {{ 'PRODUCTS.ACCOUNTING.ADD_MAPPING' | appTranslate }}
          </ion-button>
        }
      </div>
    }
  `,
  styles: [
    `
      .advanced-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: flex-start;
      }
      .section-title {
        margin: 24px 0 0;
        font-size: 16px;
        font-weight: 600;
      }
      .table-title {
        margin: 16px 0 4px;
        font-size: 13px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-muted, #6b7280);
      }
      .section-note {
        margin: 0;
        font-size: 12px;
        color: var(--text-muted, #6b7280);
      }
      .mapping-row {
        display: flex;
        gap: 12px;
        align-items: flex-end;
        width: 100%;
      }
      .row-field {
        flex: 1;
      }
    `,
  ],
})
export class AdvancedAccountingMappingsComponent {
  /** The rule the product carries; the tables are meaningless under `NONE`. */
  readonly accountingRule = input<number | undefined>(undefined);
  /** `accountingMappingOptions` from the product template. */
  readonly accountOptions = input<GlAccountOptions>({});
  /** `paymentTypeOptions` from the product template. */
  readonly paymentTypeOptions = input<PaymentTypeOption[]>([]);
  /**
   * The charges **attached to this product**, not the tenant's catalogue.
   *
   * Mapping a charge the product does not carry is accepted by the platform and never fires, so
   * the parent passes its own selection rather than the template's `chargeOptions`.
   */
  readonly charges = input<ChargeOption[]>([]);

  readonly mappings = model.required<AdvancedAccountingMappings>();

  /** The two charge tables, which differ only by which side of the `penalty` flag they read. */
  private static readonly CHARGE_TABLES = [
    {
      key: 'fee-mapping',
      penalty: false,
      title: 'PRODUCTS.ACCOUNTING.FEE_INCOME_TITLE',
      chargeLabel: 'PRODUCTS.ACCOUNTING.FEE',
    },
    {
      key: 'penalty-mapping',
      penalty: true,
      title: 'PRODUCTS.ACCOUNTING.PENALTY_INCOME_TITLE',
      chargeLabel: 'PRODUCTS.ACCOUNTING.PENALTY',
    },
  ] as const;

  /** Hidden under `NONE`: there is no base mapping for these to override. */
  readonly visible = computed(() =>
    ACCOUNTING_RULES_WITH_MAPPINGS.includes(this.accountingRule() as AccountingRuleId),
  );

  readonly assetAccounts = computed(() =>
    Array.from(this.accountOptions().assetAccountOptions ?? []),
  );
  readonly incomeAccounts = computed(() =>
    Array.from(this.accountOptions().incomeAccountOptions ?? []),
  );

  /**
   * The rows, each carrying the options its own selects may offer.
   *
   * Computed rather than derived by a method the template calls. A method returning a fresh
   * array runs on every change-detection pass and hands back a new identity each time, which the
   * dev-mode exhaustive `checkNoChanges` pass reports as NG0100 — and the e2e fixtures fail the
   * run on that, deliberately. A computed settles once per dependency change instead.
   */
  readonly paymentChannelRows = computed(() => {
    const rows = this.mappings().paymentChannelToFundSourceMappings;
    // A payment type may be routed once. Each row still offers its own current selection, or
    // choosing it would remove it from the list it was chosen from.
    const taken = new Set(
      rows.map((row) => row.paymentTypeId).filter((id): id is number => id != null),
    );

    return rows.map((row, index) => ({
      row,
      index,
      paymentTypes: this.paymentTypeOptions().filter(
        (option) => option.id == null || !taken.has(option.id) || option.id === row.paymentTypeId,
      ),
    }));
  });

  /** Payment types not yet routed, which is what decides whether another row can be added. */
  readonly unusedPaymentTypes = computed(() => {
    const taken = new Set(
      this.mappings()
        .paymentChannelToFundSourceMappings.map((row) => row.paymentTypeId)
        .filter((id): id is number => id != null),
    );
    return this.paymentTypeOptions().filter((option) => option.id == null || !taken.has(option.id));
  });

  readonly feeCharges = computed(() => this.charges().filter((charge) => !charge.penalty));
  readonly penaltyCharges = computed(() =>
    this.charges().filter((charge) => Boolean(charge.penalty)),
  );

  readonly chargeTables = computed(() =>
    AdvancedAccountingMappingsComponent.CHARGE_TABLES.map((table) => ({
      ...table,
      charges: table.penalty ? this.penaltyCharges() : this.feeCharges(),
      rows: (table.penalty
        ? this.mappings().penaltyToIncomeAccountMappings
        : this.mappings().feeToIncomeAccountMappings
      ).map((row, index) => ({ row, index })),
    })),
  );

  canAddPaymentChannel(): boolean {
    return this.unusedPaymentTypes().length > 0;
  }

  chargesFor(penalty: boolean): ChargeOption[] {
    return penalty ? this.penaltyCharges() : this.feeCharges();
  }

  rowsFor(penalty: boolean) {
    return penalty
      ? this.mappings().penaltyToIncomeAccountMappings
      : this.mappings().feeToIncomeAccountMappings;
  }

  accountLabel(account: GlAccountOption): string {
    return account.glCode ? `${account.glCode} — ${account.name}` : (account.name ?? '');
  }

  addPaymentChannel(): void {
    this.patch({
      paymentChannelToFundSourceMappings: [
        ...this.mappings().paymentChannelToFundSourceMappings,
        {},
      ],
    });
  }

  removePaymentChannel(index: number): void {
    this.patch({
      paymentChannelToFundSourceMappings: this.mappings().paymentChannelToFundSourceMappings.filter(
        (_, i) => i !== index,
      ),
    });
  }

  setPaymentChannel(
    index: number,
    key: 'paymentTypeId' | 'fundSourceAccountId',
    value: number,
  ): void {
    this.patch({
      paymentChannelToFundSourceMappings: this.mappings().paymentChannelToFundSourceMappings.map(
        (row, i) => (i === index ? { ...row, [key]: value } : row),
      ),
    });
  }

  addChargeMapping(penalty: boolean): void {
    this.patchChargeTable(penalty, [...this.rowsFor(penalty), {}]);
  }

  removeChargeMapping(penalty: boolean, index: number): void {
    this.patchChargeTable(
      penalty,
      this.rowsFor(penalty).filter((_, i) => i !== index),
    );
  }

  setChargeMapping(
    penalty: boolean,
    index: number,
    key: 'chargeId' | 'incomeAccountId',
    value: number,
  ): void {
    this.patchChargeTable(
      penalty,
      this.rowsFor(penalty).map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  }

  private patchChargeTable(
    penalty: boolean,
    rows: AdvancedAccountingMappings['feeToIncomeAccountMappings'],
  ): void {
    this.patch(
      penalty ? { penaltyToIncomeAccountMappings: rows } : { feeToIncomeAccountMappings: rows },
    );
  }

  /**
   * Replaces the whole object rather than writing into it.
   *
   * The parent holds this in a signal and reads it at submit; mutating in place would leave that
   * signal unchanged by identity and nothing downstream would recompute.
   */
  private patch(change: Partial<AdvancedAccountingMappings>): void {
    this.mappings.set({ ...this.mappings(), ...change });
  }
}
