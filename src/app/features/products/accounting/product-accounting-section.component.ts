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
  IonCol,
  IonGrid,
  IonItem,
  IonLabel,
  IonRow,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';

import { TranslatePipe } from '../../../core/adapters';
import { GlAccountSelectComponent } from './gl-account-select.component';
import {
  ACCOUNTING_RULE,
  AccountingMappingField,
  AccountingMappings,
  GlAccountOption,
  GlAccountOptions,
  GlAccountType,
  fieldsForRule,
} from './product-accounting.model';

interface AccountingRuleOption {
  id?: number;
  value?: string;
}

/** A heading and the slots under it, for one class of GL account. */
interface MappingGroup {
  accountType: GlAccountType;
  label: string;
  fields: AccountingMappingField[];
  /** False when the tenant has no accounts of this class, which is worth saying out loud. */
  hasOptions: boolean;
}

const GROUP_LABELS: Record<GlAccountType, string> = {
  asset: 'ACCOUNTING.ASSET',
  liability: 'ACCOUNTING.LIABILITY',
  equity: 'ACCOUNTING.EQUITY',
  income: 'ACCOUNTING.INCOME',
  expense: 'ACCOUNTING.EXPENSE',
};

/** Rendering order, which follows the order a trial balance is read in. */
const GROUP_ORDER: readonly GlAccountType[] = ['asset', 'liability', 'equity', 'income', 'expense'];

/**
 * The accounting block of a product form: pick a rule, then map the accounts it requires.
 *
 * Family-agnostic on purpose. It renders whatever {@link AccountingMappingField} list it is
 * given, so loan, savings, deposit and share products share this one implementation and differ
 * only in their field list. That is also why the rule options are an input rather than a
 * constant — they come from each family's own template response, so the labels are the tenant's.
 *
 * The slots are grouped by account class rather than listed flat. A loan product under accrual
 * maps twelve accounts, and twelve unbroken dropdowns on a form that is already long is not
 * something anyone can check their way down.
 */
@Component({
  selector: 'app-product-accounting-section',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    GlAccountSelectComponent,
    IonCol,
    IonGrid,
    IonItem,
    IonLabel,
    IonRow,
    IonSelect,
    IonSelectOption,
  ],
  template: `
    <div class="accounting-section">
      <h3 class="section-title">{{ 'PRODUCTS.ACCOUNTING.TITLE' | appTranslate }}</h3>

      <ion-item fill="outline" class="form-item">
        <ion-label position="stacked">{{ 'PRODUCTS.ACCOUNTING.RULE' | appTranslate }}</ion-label>
        <ion-select
          [attr.aria-label]="'PRODUCTS.ACCOUNTING.RULE' | appTranslate"
          interface="popover"
          name="accountingRule"
          data-testid="product-accounting-rule"
          [ngModel]="accountingRule()"
          (ngModelChange)="onRuleChange($event)"
        >
          @for (option of ruleOptions(); track option.id) {
            <ion-select-option [value]="option.id">{{ option.value }}</ion-select-option>
          }
        </ion-select>
      </ion-item>

      @if (groups().length) {
        <ion-grid class="ion-no-padding">
          @for (group of groups(); track group.accountType) {
            <ion-row>
              <ion-col size="12">
                <h4
                  class="group-title"
                  [attr.data-testid]="'accounting-group-' + group.accountType"
                >
                  {{ group.label | appTranslate }}
                </h4>
                @if (!group.hasOptions) {
                  <p
                    class="group-note"
                    [attr.data-testid]="'accounting-empty-' + group.accountType"
                  >
                    {{ 'PRODUCTS.ACCOUNTING.NO_ACCOUNTS_OF_TYPE' | appTranslate }}
                  </p>
                }
              </ion-col>
              @for (field of group.fields; track field.key) {
                <ion-col size="12" size-md="6">
                  <app-gl-account-select
                    [label]="field.label"
                    [name]="field.key"
                    [testId]="'accounting-' + field.key"
                    [options]="optionsFor(field.accountType)"
                    [required]="true"
                    [accountId]="mappings()[field.key]"
                    (accountIdChange)="setMapping(field.key, $event)"
                  ></app-gl-account-select>
                </ion-col>
              }
            </ion-row>
          }
        </ion-grid>
      }
    </div>
  `,
  styles: [
    `
      .accounting-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .section-title {
        margin: 16px 0 0;
        font-size: 16px;
        font-weight: 600;
      }
      .group-title {
        margin: 16px 0 4px;
        font-size: 13px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-muted, #6b7280);
      }
      .group-note {
        margin: 0 0 4px;
        font-size: 12px;
        color: var(--text-muted, #6b7280);
      }
      .form-item {
        width: 100%;
      }
    `,
  ],
})
export class ProductAccountingSectionComponent {
  /** The slots this product family maps. */
  readonly fields = input.required<readonly AccountingMappingField[]>();
  /** `accountingMappingOptions` from the family's template response. */
  readonly accountOptions = input<GlAccountOptions>({});
  /** `accountingRuleOptions` from the same response, so the labels are the platform's. */
  readonly ruleOptions = input<AccountingRuleOption[]>([]);

  readonly accountingRule = model<number>(ACCOUNTING_RULE.NONE);
  readonly mappings = model<AccountingMappings>({});

  readonly groups = computed<MappingGroup[]>(() => {
    const required = fieldsForRule(this.fields(), this.accountingRule());

    return GROUP_ORDER.map((accountType) => ({
      accountType,
      label: GROUP_LABELS[accountType],
      fields: required.filter((field) => field.accountType === accountType),
      hasOptions: this.optionsFor(accountType).length > 0,
    })).filter((group) => group.fields.length > 0);
  });

  optionsFor(accountType: GlAccountType): GlAccountOption[] {
    const options = this.accountOptions();
    switch (accountType) {
      case 'asset':
        return Array.from(options.assetAccountOptions ?? []);
      case 'liability':
        return Array.from(options.liabilityAccountOptions ?? []);
      case 'equity':
        return Array.from(options.equityAccountOptions ?? []);
      case 'income':
        return Array.from(options.incomeAccountOptions ?? []);
      case 'expense':
        return Array.from(options.expenseAccountOptions ?? []);
    }
  }

  /**
   * Records a selection as a new object rather than writing through the existing one.
   *
   * The parent holds these in a signal and reads them at submit. Mutating the object in place
   * would leave that signal's value unchanged by identity, so nothing downstream would recompute
   * — the same trap the form's other mutable-object fields document.
   */
  setMapping(key: string, accountId: number | undefined): void {
    this.mappings.set({ ...this.mappings(), [key]: accountId });
  }

  /**
   * Drops every selection when the rule moves to NONE.
   *
   * Leaving them would be invisible but not harmless: the user sees no mapping fields, so they
   * believe the product has no accounting, while the model still holds the ids they picked
   * before. Anything that later serialised the model wholesale would send them.
   *
   * Selections are deliberately *kept* when moving between the posting rules, so that switching
   * cash → accrual → cash to compare them does not make the user fill the shared nine slots
   * again. `mappingsForRule` is what stops the accrual-only ids being sent under cash.
   */
  onRuleChange(rule: number): void {
    this.accountingRule.set(rule);
    if (rule === ACCOUNTING_RULE.NONE) {
      this.mappings.set({});
    }
  }
}
