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
import { DatePipe, NgClass } from '@angular/common';
import { DataTableComponent, ColumnDef, CellTemplateDirective } from '../../shared';
import { ACCOUNTING_CLOSURE_API, TranslatePipe } from '../../core/adapters';
import type { AccountingClosure } from '../../core/adapters';
import { ButtonComponent } from '../../ui/button/button.component';

/**
 * Component for listing accounting period closures.
 *
 * Provides a view of all closed periods by office.
 */
@Component({
  selector: 'app-accounting-closures-list',
  standalone: true,
  imports: [
    DataTableComponent,
    CellTemplateDirective,
    TranslatePipe,
    DatePipe,
    NgClass,
    ButtonComponent,
  ],
  template: `
    <app-data-table
      title="nav.accountingClosures"
      helpTextKey="HELP.ACCOUNTING_CLOSURES_DESC"
      createButtonLabel="ACCOUNTING_CLOSURES.CREATE"
      createPermission="CREATE_GLCLOSURE"
      [columns]="columns"
      [data]="closures()"
      [hasError]="hasError()"
      [localLogic]="true"
      [showSearch]="false"
      (create)="onCreateClosure()"
      (retry)="onRetry()"
    >
      <ng-template appCellTemplate="closingDate" let-closure>
        {{ closure.closingDate | date: 'mediumDate' }}
      </ng-template>

      <ng-template appCellTemplate="isClosed" let-closure>
        <span class="status-chip" [ngClass]="closure.isClosed ? 'closed' : 'open'">
          {{ (closure.isClosed ? 'COMMON.CLOSED' : 'COMMON.OPEN') | appTranslate }}
        </span>
      </ng-template>

      <ng-template appCellTemplate="actions" let-closure>
        <app-button
          type="button"
          emphasis="quiet"
          intent="danger"
          icon="lock-open-outline"
          (click)="onDeleteClosure(closure)"
          [label]="'ACCOUNTING_CLOSURES.REOPEN' | appTranslate"
        />
      </ng-template>
    </app-data-table>
  `,
  styles: [
    `
      .status-chip {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
      }
      .closed {
        background-color: #fce4ec;
        color: #c2185b;
      }
      .open {
        background-color: #e8f5e9;
        color: #388e3c;
      }
    `,
  ],
})
export class AccountingClosuresListComponent implements OnInit {
  private readonly closureApi = inject(ACCOUNTING_CLOSURE_API);
  private readonly router = inject(Router);

  readonly columns: ColumnDef[] = [
    { key: 'officeName', label: 'COMMON.OFFICE', sortable: true },
    { key: 'closingDate', label: 'ACCOUNTING_CLOSURES.CLOSING_DATE', sortable: true },
    { key: 'comments', label: 'ACCOUNTING_CLOSURES.COMMENTS', sortable: true },
    { key: 'isClosed', label: 'COMMON.STATUS', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly closures = signal<AccountingClosure[]>([]);
  readonly hasError = signal(false);

  ngOnInit() {
    this.loadClosures();
  }

  private loadClosures() {
    this.closureApi.list().subscribe({
      next: (data) => {
        this.closures.set(data);
        this.hasError.set(false);
      },
      error: (err) => {
        console.error('Failed to load closures', err);
        this.hasError.set(true);
      },
    });
  }

  onRetry() {
    this.loadClosures();
  }

  onCreateClosure() {
    this.router.navigate(['/accounting/closures/create']);
  }

  onDeleteClosure(closure: AccountingClosure) {
    if (confirm('Are you sure you want to re-open this period?')) {
      this.closureApi.remove(closure.id).subscribe(() => this.loadClosures());
    }
  }
}
