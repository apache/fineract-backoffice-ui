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
import { Router } from '@angular/router';
import { ColumnDef, CellTemplateDirective } from '../../../shared';
import { I18N, TranslatePipe } from '../../../core/adapters';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { WorkingCapitalBreachService, WorkingCapitalBreachData } from '../../../api';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { DialogService } from '../../../core/services/dialog.service';
import { ButtonComponent } from '../../../ui/button/button.component';

/**
 * Lists working-capital covenant breach definitions. Breaches are small master-data
 * records (name + amount/frequency thresholds), so the table uses local pagination.
 *
 * Note: the working-capital endpoints are Fineract 1.15.0-only and are not reachable
 * on the older community sandbox; this screen is verified against the frozen spec.
 */
@Component({
  selector: 'app-wc-breach-list',
  standalone: true,
  imports: [
    TranslatePipe,
    DataTableComponent,
    CellTemplateDirective,
    ButtonComponent,
    TooltipDirective,
  ],
  template: `
    <app-data-table
      title="nav.wcBreach"
      helpTextKey="HELP.WC_BREACH_DESC"
      createButtonLabel="WC_BREACH.CREATE"
      createPermission="CREATE_WORKINGCAPITALBREACH"
      [columns]="columns"
      [data]="breaches()"
      [totalRecords]="breaches().length"
      [localLogic]="true"
      (create)="onCreate()"
    >
      <ng-template appCellTemplate="actions" let-row>
        <app-button
          type="button"
          intent="primary"
          emphasis="quiet"
          [label]="'COMMON.EDIT' | appTranslate"
          icon="create-outline"
          [appTooltip]="'COMMON.EDIT' | appTranslate"
          (click)="onEdit(row)"
        />
        <app-button
          type="button"
          intent="danger"
          emphasis="quiet"
          [label]="'COMMON.DELETE' | appTranslate"
          icon="trash-outline"
          [appTooltip]="'COMMON.DELETE' | appTranslate"
          (click)="onDelete(row)"
        />
      </ng-template>
    </app-data-table>
  `,
})
export class WcBreachListComponent implements OnInit {
  private readonly breachService = inject(WorkingCapitalBreachService);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'WC_BREACH.NAME', sortable: true },
    { key: 'breachAmount', label: 'WC_BREACH.BREACH_AMOUNT', sortable: true },
    { key: 'breachAmountCalculationType', label: 'WC_BREACH.CALCULATION_TYPE', sortable: false },
    { key: 'breachFrequency', label: 'WC_BREACH.FREQUENCY', sortable: true },
    { key: 'breachFrequencyType', label: 'WC_BREACH.FREQUENCY_TYPE', sortable: false },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly breaches = signal<WorkingCapitalBreachData[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.breachService.getWorkingCapitalBreachBreaches().subscribe({
      next: (data: WorkingCapitalBreachData[]) => {
        this.breaches.set(data || []);
      },
      error: (err: unknown) => {
        console.error('Failed to load working-capital breaches', err);
      },
    });
  }

  onCreate(): void {
    this.router.navigate(['/working-capital/breach/create']);
  }

  onEdit(row: WorkingCapitalBreachData): void {
    this.router.navigate(['/working-capital/breach/edit', row.id]);
  }

  onDelete(row: WorkingCapitalBreachData): void {
    if (!row.id) return;
    void this.dialogService
      .confirm({
        title: this.i18n.translate('WC_BREACH.DELETE'),
        message: this.i18n.translate('WC_BREACH.CONFIRM_DELETE', { name: row.name }),
        destructive: true,
      })
      .then((confirmed) => {
        if (!confirmed) return;
        this.breachService.deleteWorkingCapitalBreachBreachesBreachId(row.id!).subscribe({
          next: () => this.load(),
          error: (err: unknown) => console.error('Failed to delete breach', err),
        });
      });
  }
}
