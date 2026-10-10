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

import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { AccountingRulesService } from '../../api/api/accountingRules.service';
import { TranslatePipe } from '../../core/adapters';
import {
  IonButton,
  IonCheckbox,
  IonInput,
  IonItem,
  IonLabel,
  IonRadio,
  IonRadioGroup,
  IonSelect,
  IonSelectOption,
  IonTextarea,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-accounting-rule-form',
  standalone: true,
  imports: [
    RouterModule,
    ReactiveFormsModule,
    TranslatePipe,
    IonButton,
    IonInput,
    IonTextarea,
    IonItem,
    IonLabel,
    IonSelectOption,
    IonSelect,
    IonCheckbox,
    IonRadio,
    IonRadioGroup,
  ],
  template: `
    <div class="container">
      <h1>{{ isEdit ? 'Edit' : 'Create' }} Accounting Rule</h1>

      <form [formGroup]="ruleForm" (ngSubmit)="onSubmit()">
        <ion-item fill="outline" class="full-width">
          <ion-label position="stacked">{{ 'ACCOUNTING_RULES.NAME' | appTranslate }}</ion-label>
          <ion-input
            [attr.aria-label]="'ACCOUNTING_RULES.NAME' | appTranslate"
            formControlName="name"
            required
          ></ion-input>
        </ion-item>

        <ion-item fill="outline" class="full-width">
          <ion-label position="stacked">Office</ion-label>
          <ion-select aria-label="Office" interface="popover" formControlName="officeId" required>
            @for (office of offices(); track office['id']) {
              <ion-select-option [value]="office['id']">
                {{ office['name'] }}
              </ion-select-option>
            }
          </ion-select>
        </ion-item>

        <div class="section">
          <h3>{{ 'ACCOUNTING_RULES.DEBIT_DETAILS' | appTranslate }}</h3>
          <ion-radio-group formControlName="debitRuleType" class="radio-group">
            <ion-radio value="fixedAccount">{{
              'ACCOUNTING_RULES.FIXED_ACCOUNT' | appTranslate
            }}</ion-radio>
            <ion-radio value="tags">{{ 'ACCOUNTING_RULES.ACCOUNT_TAGS' | appTranslate }}</ion-radio>
          </ion-radio-group>

          @if (ruleForm.get('debitRuleType')?.value === 'fixedAccount') {
            <ion-item fill="outline" class="full-width">
              <ion-label position="stacked">{{
                'ACCOUNTING_RULES.ACCOUNT_TO_DEBIT' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'ACCOUNTING_RULES.ACCOUNT_TO_DEBIT' | appTranslate"
                interface="popover"
                formControlName="accountToDebit"
              >
                @for (account of accounts(); track account['id']) {
                  <ion-select-option [value]="account['id']">
                    {{ account['name'] }} ({{ account['glCode'] }})
                  </ion-select-option>
                }
              </ion-select>
            </ion-item>
          }

          @if (ruleForm.get('debitRuleType')?.value === 'tags') {
            <ion-item fill="outline" class="full-width">
              <ion-label position="stacked">{{
                'ACCOUNTING_RULES.DEBIT_TAGS' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'ACCOUNTING_RULES.DEBIT_TAGS' | appTranslate"
                interface="popover"
                formControlName="debitTags"
                multiple
              >
                @for (tag of debitTags(); track tag['id']) {
                  <ion-select-option [value]="tag['id']">
                    {{ tag['name'] }}
                  </ion-select-option>
                }
              </ion-select>
            </ion-item>
          }

          <ion-checkbox formControlName="allowMultipleDebitEntries">
            {{ 'ACCOUNTING_RULES.ALLOW_MULTIPLE_DEBIT_ENTRIES' | appTranslate }}
          </ion-checkbox>
        </div>

        <div class="section">
          <h3>{{ 'ACCOUNTING_RULES.CREDIT_DETAILS' | appTranslate }}</h3>
          <ion-radio-group formControlName="creditRuleType" class="radio-group">
            <ion-radio value="fixedAccount">{{
              'ACCOUNTING_RULES.FIXED_ACCOUNT' | appTranslate
            }}</ion-radio>
            <ion-radio value="tags">{{ 'ACCOUNTING_RULES.ACCOUNT_TAGS' | appTranslate }}</ion-radio>
          </ion-radio-group>

          @if (ruleForm.get('creditRuleType')?.value === 'fixedAccount') {
            <ion-item fill="outline" class="full-width">
              <ion-label position="stacked">{{
                'ACCOUNTING_RULES.ACCOUNT_TO_CREDIT' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'ACCOUNTING_RULES.ACCOUNT_TO_CREDIT' | appTranslate"
                interface="popover"
                formControlName="accountToCredit"
              >
                @for (account of accounts(); track account['id']) {
                  <ion-select-option [value]="account['id']">
                    {{ account['name'] }} ({{ account['glCode'] }})
                  </ion-select-option>
                }
              </ion-select>
            </ion-item>
          }

          @if (ruleForm.get('creditRuleType')?.value === 'tags') {
            <ion-item fill="outline" class="full-width">
              <ion-label position="stacked">{{
                'ACCOUNTING_RULES.CREDIT_TAGS' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'ACCOUNTING_RULES.CREDIT_TAGS' | appTranslate"
                interface="popover"
                formControlName="creditTags"
                multiple
              >
                @for (tag of creditTags(); track tag['id']) {
                  <ion-select-option [value]="tag['id']">
                    {{ tag['name'] }}
                  </ion-select-option>
                }
              </ion-select>
            </ion-item>
          }

          <ion-checkbox formControlName="allowMultipleCreditEntries">
            {{ 'ACCOUNTING_RULES.ALLOW_MULTIPLE_CREDIT_ENTRIES' | appTranslate }}
          </ion-checkbox>
        </div>

        <ion-item fill="outline" class="full-width">
          <ion-label position="stacked">Description</ion-label>
          <ion-textarea
            aria-label="Description"
            formControlName="description"
            rows="3"
          ></ion-textarea>
        </ion-item>

        <div class="actions">
          <ion-button fill="clear" type="button" routerLink="/accounting/rules">Cancel</ion-button>
          <ion-button color="primary" type="submit" [disabled]="ruleForm.invalid">
            {{ isEdit ? 'Update' : 'Create' }}
          </ion-button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .container {
        padding: 20px;
        max-width: 800px;
        margin: 0 auto;
      }
      .full-width {
        width: 100%;
        margin-bottom: 15px;
      }
      .section {
        margin-bottom: 25px;
        padding: 15px;
        border: 1px solid #ddd;
        border-radius: 4px;
      }
      .radio-group {
        display: flex;
        flex-direction: column;
        margin-bottom: 15px;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 20px;
      }
    `,
  ],
})
export class AccountingRuleFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private accountingRulesService = inject(AccountingRulesService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  ruleForm: FormGroup;
  isEdit = false;
  ruleId?: number;

  readonly offices = signal<Record<string, unknown>[]>([]);
  readonly accounts = signal<Record<string, unknown>[]>([]);
  readonly debitTags = signal<Record<string, unknown>[]>([]);
  readonly creditTags = signal<Record<string, unknown>[]>([]);

  constructor() {
    this.ruleForm = this.fb.group({
      name: ['', Validators.required],
      officeId: ['', Validators.required],
      debitRuleType: ['fixedAccount'],
      accountToDebit: [''],
      debitTags: [[]],
      allowMultipleDebitEntries: [false],
      creditRuleType: ['fixedAccount'],
      accountToCredit: [''],
      creditTags: [[]],
      allowMultipleCreditEntries: [false],
      description: [''],
    });
  }

  ngOnInit() {
    this.ruleId = Number(this.route.snapshot.paramMap.get('id'));
    this.isEdit = !!this.ruleId;

    this.loadTemplate();

    if (this.isEdit) {
      this.loadRule();
    }
  }

  loadTemplate() {
    this.accountingRulesService.getAccountingrulesTemplate().subscribe((template) => {
      const templateData = template as Record<string, unknown>;
      this.offices.set((templateData['allowedOffices'] as Record<string, unknown>[]) || []);
      this.accounts.set((templateData['allowedAccounts'] as Record<string, unknown>[]) || []);
      this.debitTags.set(
        (templateData['allowedDebitTagOptions'] as Record<string, unknown>[]) || [],
      );
      this.creditTags.set(
        (templateData['allowedCreditTagOptions'] as Record<string, unknown>[]) || [],
      );
    });
  }

  loadRule() {
    this.accountingRulesService
      .getAccountingrulesAccountingRuleId(this.ruleId!)
      .subscribe((rule) => {
        const ruleData = rule as Record<string, unknown>;
        const debitAccounts = (ruleData['debitAccounts'] as Record<string, unknown>[]) || [];
        const creditAccounts = (ruleData['creditAccounts'] as Record<string, unknown>[]) || [];
        const debitTags = (ruleData['debitTags'] as Record<string, unknown>[]) || [];
        const creditTags = (ruleData['creditTags'] as Record<string, unknown>[]) || [];

        this.ruleForm.patchValue({
          name: ruleData['name'],
          officeId: ruleData['officeId'],
          description: ruleData['description'],
          allowMultipleDebitEntries: ruleData['allowMultipleDebitEntries'],
          allowMultipleCreditEntries: ruleData['allowMultipleCreditEntries'],
          debitRuleType: debitAccounts.length ? 'fixedAccount' : 'tags',
          creditRuleType: creditAccounts.length ? 'fixedAccount' : 'tags',
          accountToDebit: debitAccounts[0]?.['id'],
          accountToCredit: creditAccounts[0]?.['id'],
          debitTags: debitTags.map((t) => (t['tag'] as Record<string, unknown>)?.['id']),
          creditTags: creditTags.map((t) => (t['tag'] as Record<string, unknown>)?.['id']),
        });
      });
  }

  onSubmit() {
    if (this.ruleForm.invalid) return;

    const formValue = this.ruleForm.value;
    const request: Record<string, unknown> = {
      name: formValue.name,
      officeId: formValue.officeId,
      description: formValue.description,
      allowMultipleDebitEntries: formValue.allowMultipleDebitEntries,
      allowMultipleCreditEntries: formValue.allowMultipleCreditEntries,
    };

    if (formValue.debitRuleType === 'fixedAccount') {
      request['accountToDebit'] = formValue.accountToDebit;
    } else {
      request['debitTags'] = formValue.debitTags;
    }

    if (formValue.creditRuleType === 'fixedAccount') {
      request['accountToCredit'] = formValue.accountToCredit;
    } else {
      request['creditTags'] = formValue.creditTags;
    }

    const obs = this.isEdit
      ? (this.accountingRulesService.putAccountingrulesAccountingRuleId(
          this.ruleId!,
          request,
        ) as Observable<unknown>)
      : (this.accountingRulesService.postAccountingrules(request) as Observable<unknown>);

    obs.subscribe(() => {
      this.router.navigate(['/accounting/rules']);
    });
  }
}
