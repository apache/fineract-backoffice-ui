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
import { I18N, TranslatePipe } from '../../../core/adapters';
import { ColumnDef, CellTemplateDirective } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { RepaymentWithPostDatedChecksService, GetPostDatedChecks } from '../../../api';
import { DialogService } from '../../../core/services/dialog.service';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { ButtonComponent } from '../../../ui/button/button.component';

/**
 * Lists post-dated checks for a specific loan and allows editing or deleting a check.
 * There is no create action for this feature. The loan id is taken from the route.
 */
@Component({
  selector: 'app-post-dated-checks-list',
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
      title="POST_DATED_CHECKS.TITLE"
      helpTextKey="HELP.POST_DATED_CHECKS_DESC"
      [columns]="columns"
      [data]="checks()"
      [totalRecords]="checks().length"
      [showSearch]="false"
      [localLogic]="true"
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
export class PostDatedChecksListComponent implements OnInit {
  private readonly checkService = inject(RepaymentWithPostDatedChecksService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);

  loanId: number | null = null;

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'POST_DATED_CHECKS.NAME', sortable: true },
    { key: 'amount', label: 'POST_DATED_CHECKS.AMOUNT', sortable: true },
    { key: 'accountNo', label: 'POST_DATED_CHECKS.ACCOUNT_NO', sortable: true },
    { key: 'date', label: 'POST_DATED_CHECKS.DATE', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly checks = signal<GetPostDatedChecks[]>([]);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('loanId');
    if (id) {
      this.loanId = +id;
      this.load();
    }
  }

  load(): void {
    if (!this.loanId) return;
    this.checkService.getLoansLoanIdPostdatedchecks(this.loanId).subscribe({
      next: (data: GetPostDatedChecks[]) => {
        this.checks.set(data || []);
      },
      error: (err: unknown) => {
        console.error('Failed to load post-dated checks', err);
      },
    });
  }

  onEdit(row: GetPostDatedChecks): void {
    if (this.loanId && row.id) {
      this.router.navigate(['/loans', this.loanId, 'post-dated-checks', 'edit', row.id]);
    }
  }

  async onDelete(row: GetPostDatedChecks): Promise<void> {
    if (!this.loanId || !row.id) return;
    const confirmed = await this.dialogService.confirm({
      title: this.i18n.translate('COMMON.DELETE'),
      message: this.i18n.translate('POST_DATED_CHECKS.CONFIRM_DELETE', {
        name: row.name ?? '',
        amount: row.amount ?? '',
        date: row.date ?? '',
      }),
      destructive: true,
    });
    if (!confirmed) return;
    this.checkService
      .deleteLoansLoanIdPostdatedchecksPostDatedCheckId(row.id, this.loanId)
      .subscribe({
        next: () => this.load(),
        error: (err: unknown) => console.error('Failed to delete post-dated check', err),
      });
  }
}
