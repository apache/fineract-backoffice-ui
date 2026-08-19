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
import { TranslateModule } from '@ngx-translate/core';
import { ColumnDef, CellTemplateDirective } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { GuarantorsService, GuarantorData } from '../../../api';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';

/**
 * Lists the guarantors attached to a single loan. The loan id is read from the route
 * snapshot; create and delete actions operate within that loan's guarantor collection.
 */
@Component({
  selector: 'app-guarantors-list',
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
      title="GUARANTORS.TITLE"
      helpTextKey="HELP.GUARANTORS_DESC"
      createButtonLabel="GUARANTORS.CREATE"
      createPermission="CREATE_GUARANTOR"
      [columns]="columns"
      [data]="guarantors()"
      [totalRecords]="guarantors().length"
      [localLogic]="true"
      (create)="onCreate()"
    >
      <ng-template appCellTemplate="name" let-row>
        {{ row.entityName || (row.firstname || '') + ' ' + (row.lastname || '') }}
      </ng-template>
      <ng-template appCellTemplate="guarantorType" let-row>
        {{ row.guarantorType?.value }}
      </ng-template>
      <ng-template appCellTemplate="status" let-row>
        {{ row.status ? ('COMMON.ACTIVE' | translate) : ('COMMON.INACTIVE' | translate) }}
      </ng-template>
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
export class GuarantorsListComponent implements OnInit {
  private readonly guarantorsService = inject(GuarantorsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'GUARANTORS.NAME', sortable: false },
    { key: 'guarantorType', label: 'GUARANTORS.TYPE', sortable: false },
    { key: 'firstname', label: 'GUARANTORS.FIRST_NAME', sortable: true },
    { key: 'lastname', label: 'GUARANTORS.LAST_NAME', sortable: true },
    { key: 'status', label: 'GUARANTORS.STATUS', sortable: false },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  loanId!: number;
  readonly guarantors = signal<GuarantorData[]>([]);

  ngOnInit(): void {
    this.loanId = Number(this.route.snapshot.paramMap.get('loanId'));
    this.load();
  }

  load(): void {
    this.guarantorsService.getLoansLoanIdGuarantors(this.loanId).subscribe({
      next: (data: GuarantorData[]) => {
        this.guarantors.set(data || []);
      },
      error: (err: unknown) => {
        console.error('Failed to load guarantors', err);
      },
    });
  }

  onCreate(): void {
    this.router.navigate(['/loans', this.loanId, 'guarantors', 'create']);
  }

  onEdit(row: GuarantorData): void {
    this.router.navigate(['/loans', this.loanId, 'guarantors', 'edit', row.id]);
  }

  onDelete(row: GuarantorData): void {
    if (!row.id || !window.confirm('Delete this guarantor?')) return;
    this.guarantorsService.deleteLoansLoanIdGuarantorsGuarantorId(this.loanId, row.id).subscribe({
      next: () => this.load(),
      error: (err: unknown) => console.error('Failed to delete guarantor', err),
    });
  }
}
