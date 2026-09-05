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
import { LoanInterestPauseService, InterestPauseResponseDto } from '../../../api';
import { I18N } from '../../../core/adapters';
import { DialogService } from '../../../core/services/dialog.service';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';

/**
 * Lists interest pause periods (start/end date) for a specific loan and allows
 * creating, editing, or deleting them. The loan id is taken from the route.
 */
@Component({
  selector: 'app-interest-pauses-list',
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
      title="INTEREST_PAUSES.TITLE"
      helpTextKey="HELP.INTEREST_PAUSES_DESC"
      createButtonLabel="INTEREST_PAUSES.CREATE"
      createPermission="CREATE_INTEREST_PAUSE"
      [columns]="columns"
      [data]="pauses()"
      [totalRecords]="pauses().length"
      [showSearch]="false"
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
export class InterestPausesListComponent implements OnInit {
  private readonly pauseService = inject(LoanInterestPauseService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);

  loanId: number | null = null;

  readonly columns: ColumnDef[] = [
    { key: 'startDate', label: 'INTEREST_PAUSES.START_DATE', sortable: true },
    { key: 'endDate', label: 'INTEREST_PAUSES.END_DATE', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly pauses = signal<InterestPauseResponseDto[]>([]);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('loanId');
    if (id) {
      this.loanId = +id;
      this.load();
    }
  }

  load(): void {
    if (!this.loanId) return;
    this.pauseService.getLoansLoanIdInterestPauses(this.loanId).subscribe({
      next: (data: InterestPauseResponseDto[]) => {
        this.pauses.set(data || []);
      },
      error: (err: unknown) => {
        console.error('Failed to load interest pauses', err);
      },
    });
  }

  onCreate(): void {
    if (this.loanId) {
      this.router.navigate(['/loans', this.loanId, 'interest-pauses', 'create']);
    }
  }

  onEdit(row: InterestPauseResponseDto): void {
    if (this.loanId && row.id) {
      this.router.navigate(['/loans', this.loanId, 'interest-pauses', 'edit', row.id]);
    }
  }

  async onDelete(row: InterestPauseResponseDto): Promise<void> {
    if (!this.loanId || !row.id) return;
    const confirmed = await this.dialogService.confirm({
      title: this.i18n.translate('COMMON.DELETE'),
      message: this.i18n.translate('INTEREST_PAUSES.CONFIRM_DELETE', {
        startDate: row.startDate ?? '',
        endDate: row.endDate ?? '',
      }),
      destructive: true,
    });
    if (!confirmed) return;
    this.pauseService.deleteLoansLoanIdInterestPausesVariationId(this.loanId, row.id).subscribe({
      next: () => this.load(),
      // The global error interceptor displays Fineract's response to the user.
      error: () => undefined,
    });
  }
}
