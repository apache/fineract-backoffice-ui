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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  DataTableComponent,
  ColumnDef,
  CellTemplateDirective,
  StatusBadgeComponent,
} from '../../../shared';
import { RescheduleLoansService, GetLoanRescheduleRequestResponse } from '../../../api';
import { DialogService } from '../../../core/services/dialog.service';
import { ButtonComponent } from '../../../ui/button/button.component';

/**
 * Component for listing loan reschedule requests.
 *
 * Provides a view of pending and historical rescheduling applications for a loan.
 */
@Component({
  selector: 'app-reschedule-requests-list',
  standalone: true,
  imports: [
    TranslateModule,
    DataTableComponent,
    CellTemplateDirective,
    StatusBadgeComponent,
    ButtonComponent,
  ],
  template: `
    <app-data-table
      title="Loan Reschedule Requests"
      helpTextKey="HELP.RESCHEDULING_DESC"
      [createButtonLabel]="loanId() ? 'LOANS.REQUEST_RESCHEDULE' : ''"
      [columns]="columns"
      [data]="requests()"
      [totalRecords]="requests().length"
      [showSearch]="true"
      [localLogic]="true"
      (create)="onCreateRequest()"
    >
      <ng-template appCellTemplate="rescheduleFromDate" let-request>
        {{ formatArrayDate(request.rescheduleFromDate) }}
      </ng-template>

      <ng-template appCellTemplate="rescheduleReason" let-request>
        {{ request.rescheduleReasonCodeValue?.name }}
      </ng-template>

      <ng-template appCellTemplate="status" let-request>
        <app-status-badge [status]="request.statusEnum"></app-status-badge>
      </ng-template>

      <ng-template appCellTemplate="actions" let-request>
        <app-button
          type="button"
          emphasis="quiet"
          intent="primary"
          icon="eye-outline"
          [label]="'COMMON.VIEW' | translate"
          (click)="onViewRequest(request)"
        />
      </ng-template>
    </app-data-table>
  `,
})
export class RescheduleRequestsListComponent implements OnInit {
  private readonly rescheduleService = inject(RescheduleLoansService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialogService = inject(DialogService);
  private readonly translate = inject(TranslateService);

  readonly loanId = signal<number | null>(null);

  readonly columns: ColumnDef[] = [
    { key: 'loanAccountNumber', label: 'LOANS.ACCOUNT_NO', sortable: true },
    { key: 'rescheduleFromDate', label: 'LOANS.RESCHEDULE_FROM', sortable: true },
    { key: 'rescheduleReason', label: 'COMMON.REASON', sortable: true },
    { key: 'status', label: 'COMMON.STATUS', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly requests = signal<GetLoanRescheduleRequestResponse[]>([]);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('loanId');
      if (id) {
        this.loanId.set(+id);
      }
      this.loadRequests();
    });
  }

  private loadRequests(): void {
    this.rescheduleService.getRescheduleloans(undefined, this.loanId() || undefined).subscribe({
      next: (data) => {
        this.requests.set(data || []);
      },
      error: (err) => console.error('Failed to load reschedule requests', err),
    });
  }

  onCreateRequest(): void {
    if (this.loanId()) {
      this.router.navigate(['/loans', this.loanId(), 'rescheduling', 'create']);
    }
  }

  onViewRequest(request: GetLoanRescheduleRequestResponse): void {
    const details: { label: string; value: string }[] = [
      { label: 'LOANS.ACCOUNT_NO', value: request.loanAccountNumber },
      { label: 'COMMON.CLIENT', value: request.clientName },
      { label: 'COMMON.STATUS', value: request.statusEnum?.value },
      { label: 'LOANS.RESCHEDULE_FROM', value: this.formatArrayDate(request.rescheduleFromDate) },
      { label: 'COMMON.REASON', value: request.rescheduleReasonCodeValue?.name },
      { label: 'COMMON.COMMENT', value: request.rescheduleReasonComment },
      {
        label: 'COMMON.SUBMITTED_BY',
        value: request.timeline?.submittedByUsername,
      },
      {
        label: 'COMMON.SUBMITTED_ON',
        value: this.formatArrayDate(request.timeline?.submittedOnDate),
      },
      ...(request.statusEnum?.approved
        ? [
            { label: 'COMMON.APPROVED_BY', value: request.timeline?.approvedByUsername },
            {
              label: 'COMMON.APPROVED_ON',
              value: this.formatArrayDate(request.timeline?.approvedOnDate),
            },
          ]
        : []),
    ]
      .filter((row): row is { label: string; value: string } => !!row.value && row.value !== '-')
      .map((row) => ({ label: this.translate.instant(row.label), value: row.value }));

    const closeLabel = this.translate.instant('COMMON.CLOSE');
    this.dialogService.confirm({
      title: this.translate.instant('LOANS.RESCHEDULE_REQUEST_DETAILS'),
      message: '',
      details,
      confirmText: closeLabel,
      cancelText: closeLabel,
    });
  }

  formatArrayDate(dateArray: unknown): string {
    if (!dateArray || !Array.isArray(dateArray) || dateArray.length < 3) {
      return '-';
    }
    return `${dateArray[0]}-${String(dateArray[1]).padStart(2, '0')}-${String(dateArray[2]).padStart(2, '0')}`;
  }
}
