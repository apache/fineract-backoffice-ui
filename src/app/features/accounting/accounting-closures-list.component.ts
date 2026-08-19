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
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { DatePipe, NgClass } from '@angular/common';
import { DataTableComponent, ColumnDef, CellTemplateDirective } from '../../shared';
import { AccountingClosureService, GetGlClosureResponse } from '../../api';
import { TranslatePipe } from '../../core/adapters';
import { IonButton, IonIcon } from '@ionic/angular/standalone';

/**
 * Component for listing accounting period closures.
 *
 * Provides a view of all closed periods by office.
 */
@Component({
  selector: 'app-accounting-closures-list',
  standalone: true,
  imports: [
    TranslateModule,
    DataTableComponent,
    CellTemplateDirective,
    TranslatePipe,
    DatePipe,
    NgClass,
    IonIcon,
    IonButton,
  ],
  template: `
    <app-data-table
      title="nav.accountingClosures"
      helpTextKey="HELP.ACCOUNTING_CLOSURES_DESC"
      createButtonLabel="ACCOUNTING_CLOSURES.CREATE"
      createPermission="CREATE_GLCLOSURE"
      [columns]="columns"
      [data]="closures()"
      [localLogic]="true"
      [showSearch]="false"
      (create)="onCreateClosure()"
    >
      <ng-template appCellTemplate="closingDate" let-closure>
        {{ closure.closingDate | date: 'mediumDate' }}
      </ng-template>

      <ng-template appCellTemplate="isClosed" let-closure>
        <span class="status-chip" [ngClass]="closure.isClosed ? 'closed' : 'open'">
          {{ closure.isClosed ? 'Closed' : 'Open' }}
        </span>
      </ng-template>

      <ng-template appCellTemplate="actions" let-closure>
        <ion-button
          fill="clear"
          color="danger"
          [title]="'ACCOUNTING_CLOSURES.REOPEN' | appTranslate"
          (click)="onDeleteClosure(closure)"
          [attr.aria-label]="'ACCOUNTING_CLOSURES.REOPEN' | translate"
        >
          <ion-icon name="lock-open-outline"></ion-icon>
        </ion-button>
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
  private readonly closureService = inject(AccountingClosureService);
  private readonly router = inject(Router);

  readonly columns: ColumnDef[] = [
    { key: 'officeName', label: 'Office', sortable: true },
    { key: 'closingDate', label: 'Closing Date', sortable: true },
    { key: 'comments', label: 'Comments', sortable: true },
    { key: 'isClosed', label: 'Status', sortable: true },
    { key: 'actions', label: 'Actions', sortable: false },
  ];

  readonly closures = signal<GetGlClosureResponse[]>([]);

  ngOnInit() {
    this.loadClosures();
  }

  private loadClosures() {
    this.closureService.getGlclosures().subscribe({
      next: (data) => this.closures.set(data),
      error: (err) => console.error('Failed to load closures', err),
    });
  }

  onCreateClosure() {
    this.router.navigate(['/accounting/closures/create']);
  }

  onDeleteClosure(closure: GetGlClosureResponse) {
    if (closure.id && confirm('Are you sure you want to re-open this period?')) {
      this.closureService
        .deleteGlclosuresGlClosureId(closure.id)
        .subscribe(() => this.loadClosures());
    }
  }
}
