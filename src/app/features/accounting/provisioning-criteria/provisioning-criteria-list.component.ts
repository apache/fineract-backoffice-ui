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
import { ProvisioningCriteriaService, GetProvisioningCriteriaResponse } from '../../../api';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { DialogService } from '../../../core/services/dialog.service';

/**
 * Lists provisioning criteria. The list response carries the criteria name and
 * creator only; the full definitions/loan-product arrays live on the detail endpoint.
 */
@Component({
  selector: 'app-provisioning-criteria-list',
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
      title="nav.provisioningCriteria"
      helpTextKey="HELP.PROVISIONING_CRITERIA_DESC"
      createButtonLabel="PROVISIONING_CRITERIA.CREATE"
      createPermission="CREATE_PROVISIONCRITERIA"
      [columns]="columns"
      [data]="criteria()"
      [totalRecords]="criteria().length"
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
export class ProvisioningCriteriaListComponent implements OnInit {
  private readonly criteriaService = inject(ProvisioningCriteriaService);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly translate = inject(TranslateService);

  readonly columns: ColumnDef[] = [
    { key: 'criteriaName', label: 'PROVISIONING_CRITERIA.NAME', sortable: true },
    { key: 'createdBy', label: 'PROVISIONING_CRITERIA.CREATED_BY', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly criteria = signal<GetProvisioningCriteriaResponse[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.criteriaService.getProvisioningcriteria().subscribe({
      next: (data: GetProvisioningCriteriaResponse[]) => {
        this.criteria.set(data || []);
      },
      error: (err: unknown) => {
        console.error('Failed to load provisioning criteria', err);
      },
    });
  }

  onCreate(): void {
    this.router.navigate(['/accounting/provisioning-criteria/create']);
  }

  onEdit(row: GetProvisioningCriteriaResponse): void {
    this.router.navigate(['/accounting/provisioning-criteria/edit', row.criteriaId]);
  }

  onDelete(row: GetProvisioningCriteriaResponse): void {
    if (!row.criteriaId) return;
    void this.dialogService
      .confirm({
        title: this.translate.instant('PROVISIONING_CRITERIA.DELETE'),
        message: this.translate.instant('PROVISIONING_CRITERIA.CONFIRM_DELETE', {
          name: row.criteriaName,
        }),
        destructive: true,
      })
      .then((confirmed) => {
        if (!confirmed) return;
        this.criteriaService.deleteProvisioningcriteriaCriteriaId(row.criteriaId!).subscribe({
          next: () => this.load(),
          error: (err: unknown) => console.error('Failed to delete provisioning criteria', err),
        });
      });
  }
}
