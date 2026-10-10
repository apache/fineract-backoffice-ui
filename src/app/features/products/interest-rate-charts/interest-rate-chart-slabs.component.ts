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
import { I18N, TranslatePipe } from '../../../core/adapters';
import {
  InterestRateSlabAKAInterestBandsService,
  InterestRateChartSlabData,
  InterestRateChartSlabsCreateRequest,
  EnumOptionData,
} from '../../../api';
import { FINERACT_LOCALE } from '../../../core/utils/date-formatter';
import { DialogService } from '../../../core/services/dialog.service';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';

/** A single editable slab row used by the inline add form. */
interface SlabRow {
  periodType: number | null;
  fromPeriod: number | null;
  toPeriod: number | null;
  amountRangeFrom: number | null;
  amountRangeTo: number | null;
  annualInterestRate: number | null;
}

/**
 * Lists the interest-rate slabs (interest bands) for a chart and supports adding a new
 * slab via an inline form plus deleting an existing one. Reached by drilling in from the
 * interest-rate-charts list (no dedicated sidebar entry).
 */
@Component({
  selector: 'app-interest-rate-chart-slabs',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonIcon,
    IonButton,
    IonInput,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonSelectOption,
    IonSelect,
    TooltipDirective,
  ],
  template: `
    <div class="slabs-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'INTEREST_RATE_CHARTS.SLABS' | appTranslate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <table class="slabs-table">
            <thead>
              <tr>
                <th>{{ 'INTEREST_RATE_CHARTS.PERIOD_TYPE' | appTranslate }}</th>
                <th>{{ 'INTEREST_RATE_CHARTS.FROM_PERIOD' | appTranslate }}</th>
                <th>{{ 'INTEREST_RATE_CHARTS.TO_PERIOD' | appTranslate }}</th>
                <th>{{ 'INTEREST_RATE_CHARTS.AMOUNT_RANGE_FROM' | appTranslate }}</th>
                <th>{{ 'INTEREST_RATE_CHARTS.AMOUNT_RANGE_TO' | appTranslate }}</th>
                <th>{{ 'INTEREST_RATE_CHARTS.ANNUAL_INTEREST_RATE' | appTranslate }}</th>
                <th>{{ 'COMMON.ACTIONS' | appTranslate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (slab of slabs(); track slab.id) {
                <tr>
                  <td>{{ slab.periodType?.value }}</td>
                  <td>{{ slab.fromPeriod }}</td>
                  <td>{{ slab.toPeriod }}</td>
                  <td>{{ slab.amountRangeFrom }}</td>
                  <td>{{ slab.amountRangeTo }}</td>
                  <td>{{ slab.annualInterestRate }}</td>
                  <td>
                    <ion-button
                      fill="clear"
                      color="danger"
                      type="button"
                      [attr.aria-label]="'COMMON.DELETE' | appTranslate"
                      [appTooltip]="'COMMON.DELETE' | appTranslate"
                      (click)="onDelete(slab)"
                    >
                      <ion-icon name="trash-outline"></ion-icon>
                    </ion-button>
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <form #slabForm="ngForm" (ngSubmit)="onAdd()" class="add-row">
            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'INTEREST_RATE_CHARTS.PERIOD_TYPE' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'INTEREST_RATE_CHARTS.PERIOD_TYPE' | appTranslate"
                interface="popover"
                name="periodType"
                [(ngModel)]="newSlab().periodType"
              >
                @for (opt of periodTypeOptions(); track opt.id) {
                  <ion-select-option [value]="opt.id">{{ opt.value }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'INTEREST_RATE_CHARTS.FROM_PERIOD' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'INTEREST_RATE_CHARTS.FROM_PERIOD' | appTranslate"
                type="number"
                name="fromPeriod"
                [(ngModel)]="newSlab().fromPeriod"
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'INTEREST_RATE_CHARTS.TO_PERIOD' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'INTEREST_RATE_CHARTS.TO_PERIOD' | appTranslate"
                type="number"
                name="toPeriod"
                [(ngModel)]="newSlab().toPeriod"
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'INTEREST_RATE_CHARTS.AMOUNT_RANGE_FROM' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'INTEREST_RATE_CHARTS.AMOUNT_RANGE_FROM' | appTranslate"
                type="number"
                name="amountRangeFrom"
                [(ngModel)]="newSlab().amountRangeFrom"
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'INTEREST_RATE_CHARTS.AMOUNT_RANGE_TO' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'INTEREST_RATE_CHARTS.AMOUNT_RANGE_TO' | appTranslate"
                type="number"
                name="amountRangeTo"
                [(ngModel)]="newSlab().amountRangeTo"
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'INTEREST_RATE_CHARTS.ANNUAL_INTEREST_RATE' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'INTEREST_RATE_CHARTS.ANNUAL_INTEREST_RATE' | appTranslate"
                type="number"
                name="annualInterestRate"
                [(ngModel)]="newSlab().annualInterestRate"
                required
              ></ion-input>
            </ion-item>

            <ion-button
              fill="outline"
              color="primary"
              type="submit"
              [disabled]="slabForm.invalid || isSaving()"
            >
              <ion-icon name="add-outline"></ion-icon>
              {{ 'INTEREST_RATE_CHARTS.ADD_SLAB' | appTranslate }}
            </ion-button>
          </form>

          <div class="back-action">
            <ion-button fill="clear" type="button" (click)="onBack()">
              {{ 'COMMON.BACK' | appTranslate }}
            </ion-button>
          </div>
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .slabs-container {
        padding: 24px;
        max-width: 1100px;
        margin: 0 auto;
      }
      .slabs-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 16px;
      }
      .slabs-table th,
      .slabs-table td {
        text-align: left;
        padding: 8px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.12);
      }
      .add-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
      }
      .add-row mat-form-field {
        flex: 1 1 140px;
      }
      .back-action {
        margin-top: 16px;
      }
    `,
  ],
})
export class InterestRateChartSlabsComponent implements OnInit {
  private readonly slabService = inject(InterestRateSlabAKAInterestBandsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);

  private readonly LIST_PATH = '/products/interest-rate-charts';

  chartId: number | null = null;
  readonly isSaving = signal(false);

  readonly slabs = signal<InterestRateChartSlabData[]>([]);
  readonly periodTypeOptions = signal<EnumOptionData[]>([]);
  readonly newSlab = signal<SlabRow>({
    periodType: null,
    fromPeriod: null,
    toPeriod: null,
    amountRangeFrom: null,
    amountRangeTo: null,
    annualInterestRate: null,
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('chartId');
      if (id) {
        this.chartId = +id;
        this.loadTemplate();
        this.load();
      }
    });
  }

  loadTemplate(): void {
    if (!this.chartId) return;
    this.slabService
      .getInterestratechartsChartIdChartslabsTemplate(this.chartId)
      .subscribe((tpl) => {
        this.periodTypeOptions.set(tpl.periodTypes ?? []);
      });
  }

  load(): void {
    if (!this.chartId) return;
    this.slabService.getInterestratechartsChartIdChartslabs(this.chartId).subscribe({
      next: (data: InterestRateChartSlabData[]) => {
        this.slabs.set(data || []);
      },
      error: (err: unknown) => console.error('Failed to load chart slabs', err),
    });
  }

  onAdd(): void {
    if (!this.chartId) return;
    this.isSaving.set(true);
    const payload: InterestRateChartSlabsCreateRequest = {
      periodType: this.newSlab().periodType ?? undefined,
      fromPeriod: this.newSlab().fromPeriod ?? undefined,
      toPeriod: this.newSlab().toPeriod ?? undefined,
      amountRangeFrom: this.newSlab().amountRangeFrom ?? undefined,
      amountRangeTo: this.newSlab().amountRangeTo ?? undefined,
      annualInterestRate: this.newSlab().annualInterestRate ?? undefined,
      locale: FINERACT_LOCALE,
    };
    this.slabService.postInterestratechartsChartIdChartslabs(this.chartId, payload).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.newSlab.set({
          periodType: null,
          fromPeriod: null,
          toPeriod: null,
          amountRangeFrom: null,
          amountRangeTo: null,
          annualInterestRate: null,
        });
        this.load();
      },
      error: () => this.isSaving.set(false),
    });
  }

  async onDelete(slab: InterestRateChartSlabData): Promise<void> {
    if (!this.chartId || !slab.id) return;
    const confirmed = await this.dialogService.confirm({
      title: this.i18n.translate('INTEREST_RATE_CHARTS.DELETE_SLAB'),
      message: this.i18n.translate('INTEREST_RATE_CHARTS.CONFIRM_DELETE_SLAB', {
        rate: slab.annualInterestRate ?? '',
        fromPeriod: slab.fromPeriod ?? '',
        toPeriod: slab.toPeriod ?? '',
      }),
      destructive: true,
    });
    if (!confirmed) return;
    this.slabService
      .deleteInterestratechartsChartIdChartslabsChartSlabId(this.chartId, slab.id)
      .subscribe({
        next: () => this.load(),
        error: (err: unknown) => console.error('Failed to delete slab', err),
      });
  }

  onBack(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
