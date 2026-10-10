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
import { MappingFinancialActivitiesToAccountsService } from '../../api/api/mappingFinancialActivitiesToAccounts.service';
import { TranslatePipe } from '../../core/adapters';
import {
  IonButton,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-financial-activity-mapping-form',
  standalone: true,
  imports: [
    RouterModule,
    ReactiveFormsModule,
    TranslatePipe,
    IonButton,
    IonItem,
    IonLabel,
    IonSelectOption,
    IonSelect,
  ],
  template: `
    <div class="container">
      <h1>{{ isEdit ? 'Edit' : 'Define' }} Financial Activity Mapping</h1>

      <form [formGroup]="mappingForm" (ngSubmit)="onSubmit()">
        <ion-item fill="outline" class="full-width">
          <ion-label position="stacked">{{
            'ACCOUNTING.FINANCIAL_ACTIVITY' | appTranslate
          }}</ion-label>
          <ion-select
            [attr.aria-label]="'ACCOUNTING.FINANCIAL_ACTIVITY' | appTranslate"
            interface="popover"
            formControlName="financialActivityId"
            required
          >
            @for (activity of activities(); track activity['id']) {
              <ion-select-option [value]="activity['id']">
                {{ activity['name'] }}
              </ion-select-option>
            }
          </ion-select>
        </ion-item>

        <ion-item fill="outline" class="full-width">
          <ion-label position="stacked">{{ 'ACCOUNTING.GL_ACCOUNT' | appTranslate }}</ion-label>
          <ion-select
            [attr.aria-label]="'ACCOUNTING.GL_ACCOUNT' | appTranslate"
            interface="popover"
            formControlName="glAccountId"
            required
          >
            @for (account of filteredAccounts(); track account['id']) {
              <ion-select-option [value]="account['id']">
                {{ account['name'] }} ({{ account['glCode'] }})
              </ion-select-option>
            }
          </ion-select>
        </ion-item>

        <div class="actions">
          <ion-button
            fill="clear"
            type="button"
            routerLink="/accounting/financial-activity-mappings"
          >
            Cancel
          </ion-button>
          <ion-button color="primary" type="submit" [disabled]="mappingForm.invalid">
            {{ isEdit ? 'Update' : 'Define' }}
          </ion-button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .container {
        padding: 20px;
        max-width: 600px;
        margin: 0 auto;
      }
      .full-width {
        width: 100%;
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
export class FinancialActivityMappingFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private financialActivityService = inject(MappingFinancialActivitiesToAccountsService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  mappingForm: FormGroup;
  isEdit = false;
  mappingId?: number;

  readonly activities = signal<Record<string, unknown>[]>([]);
  glAccountOptions: Record<string, unknown> = {};

  /**
   * The GL accounts offered for the chosen activity.
   *
   * A signal rather than a plain field because it is assigned from two places that are not
   * user events: the template response, and the `valueChanges` subscription. Selecting the
   * activity before the template has arrived leaves the list empty, and the refill that
   * `loadTemplate` does afterwards notifies nothing — so the dropdown stays empty for a
   * selection the platform would have accepted.
   */
  readonly filteredAccounts = signal<Record<string, unknown>[]>([]);

  constructor() {
    this.mappingForm = this.fb.group({
      financialActivityId: ['', Validators.required],
      glAccountId: ['', Validators.required],
    });
  }

  ngOnInit() {
    this.mappingId = Number(this.route.snapshot.paramMap.get('id'));
    this.isEdit = !!this.mappingId;

    this.loadTemplate();

    this.mappingForm.get('financialActivityId')?.valueChanges.subscribe((activityId) => {
      this.updateFilteredAccounts(activityId);
    });

    if (this.isEdit) {
      this.loadMapping();
    }
  }

  loadTemplate() {
    this.financialActivityService.getFinancialactivityaccountsTemplate().subscribe((template) => {
      const templateData = template as Record<string, unknown>;
      this.activities.set(
        (templateData['financialActivityOptions'] as Record<string, unknown>[]) || [],
      );
      this.glAccountOptions = (templateData['glAccountOptions'] as Record<string, unknown>) || {};
      const currentActivityId = this.mappingForm.get('financialActivityId')?.value;
      if (currentActivityId) {
        this.updateFilteredAccounts(currentActivityId);
      }
    });
  }

  loadMapping() {
    this.financialActivityService
      .getFinancialactivityaccountsMappingId(this.mappingId!)
      .subscribe((mapping) => {
        const mappingData = mapping as Record<string, unknown>;
        const financialActivityData = mappingData['financialActivityData'] as
          Record<string, unknown> | undefined;
        const glAccountData = mappingData['glAccountData'] as Record<string, unknown> | undefined;
        this.mappingForm.patchValue({
          financialActivityId: financialActivityData?.['id'],
          glAccountId: glAccountData?.['id'],
        });
      });
  }

  updateFilteredAccounts(activityId: number) {
    if (activityId >= 100 && activityId < 200) {
      this.filteredAccounts.set(
        (this.glAccountOptions['assetAccountOptions'] as Record<string, unknown>[]) || [],
      );
    } else if (activityId >= 200 && activityId < 300) {
      this.filteredAccounts.set(
        (this.glAccountOptions['liabilityAccountOptions'] as Record<string, unknown>[]) || [],
      );
    } else if (activityId >= 300 && activityId < 400) {
      this.filteredAccounts.set(
        (this.glAccountOptions['equityAccountOptions'] as Record<string, unknown>[]) || [],
      );
    } else {
      this.filteredAccounts.set([]);
    }
  }

  onSubmit() {
    if (this.mappingForm.invalid) return;

    const request = this.mappingForm.value;
    const obs = this.isEdit
      ? (this.financialActivityService.putFinancialactivityaccountsMappingId(
          this.mappingId!,
          request,
        ) as Observable<unknown>)
      : (this.financialActivityService.postFinancialactivityaccounts(
          request,
        ) as Observable<unknown>);

    obs.subscribe(() => {
      this.router.navigate(['/accounting/financial-activity-mappings']);
    });
  }
}
