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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ColumnDef, CellTemplateDirective } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { WorkingCapitalNearBreachService, WorkingCapitalNearBreachData } from '../../../api';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { DialogService } from '../../../core/services/dialog.service';

/**
 * Lists working-capital near-breach (early-warning) threshold definitions.
 * 1.15.0-only endpoint; verified against the frozen spec.
 */
@Component({
  selector: 'app-wc-near-breach-list',
  standalone: true,
  imports: [
    TranslateModule,
    DataTableComponent,
    CellTemplateDirective,
    IonIcon,
    IonButton,
    TooltipDirective,
  ],
  template: `
    <app-data-table
      title="nav.wcNearBreach"
      helpTextKey="HELP.WC_NEAR_BREACH_DESC"
      createButtonLabel="WC_NEAR_BREACH.CREATE"
      createPermission="CREATE_WORKINGCAPITALNEARBREACH"
      [columns]="columns"
      [data]="items()"
      [totalRecords]="items().length"
      [localLogic]="true"
      (create)="onCreate()"
    >
      <ng-template appCellTemplate="actions" let-row>
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'COMMON.EDIT' | translate"
          [appTooltip]="'COMMON.EDIT' | translate"
          (click)="onEdit(row)"
        >
          <ion-icon name="create-outline"></ion-icon>
        </ion-button>
        <ion-button
          fill="clear"
          color="danger"
          [attr.aria-label]="'COMMON.DELETE' | translate"
          [appTooltip]="'COMMON.DELETE' | translate"
          (click)="onDelete(row)"
        >
          <ion-icon name="trash-outline"></ion-icon>
        </ion-button>
      </ng-template>
    </app-data-table>
  `,
})
export class WcNearBreachListComponent implements OnInit {
  private readonly service = inject(WorkingCapitalNearBreachService);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly translate = inject(TranslateService);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'WC_NEAR_BREACH.NAME', sortable: true },
    { key: 'threshold', label: 'WC_NEAR_BREACH.THRESHOLD', sortable: true },
    { key: 'frequency', label: 'WC_NEAR_BREACH.FREQUENCY', sortable: true },
    { key: 'frequencyType', label: 'WC_NEAR_BREACH.FREQUENCY_TYPE', sortable: false },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly items = signal<WorkingCapitalNearBreachData[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.service.getWorkingCapitalNearBreach().subscribe({
      next: (data: WorkingCapitalNearBreachData[]) => {
        this.items.set(data || []);
      },
      error: (err: unknown) => {
        console.error('Failed to load near-breach definitions', err);
      },
    });
  }

  onCreate(): void {
    this.router.navigate(['/working-capital/near-breach/create']);
  }

  onEdit(row: WorkingCapitalNearBreachData): void {
    this.router.navigate(['/working-capital/near-breach/edit', row.id]);
  }

  onDelete(row: WorkingCapitalNearBreachData): void {
    if (!row.id) return;
    void this.dialogService
      .confirm({
        title: this.translate.instant('WC_NEAR_BREACH.DELETE'),
        message: this.translate.instant('WC_NEAR_BREACH.CONFIRM_DELETE', { name: row.name }),
        destructive: true,
      })
      .then((confirmed) => {
        if (!confirmed) return;
        this.service.deleteWorkingCapitalNearBreachBreachId(row.id!).subscribe({
          next: () => this.load(),
          error: (err: unknown) => console.error('Failed to delete near-breach', err),
        });
      });
  }
}
