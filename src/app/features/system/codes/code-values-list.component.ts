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
import { of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { IonButton, IonIcon } from '@ionic/angular/standalone';

import {
  CodesService,
  CodeValuesService,
  GetCodesResponse,
  GetCodeValuesDataResponse,
} from '../../../api';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { CellTemplateDirective, ColumnDef } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { DialogService } from '../../../core/services/dialog.service';

@Component({
  selector: 'app-code-values-list',
  standalone: true,
  imports: [
    TranslateModule,
    StatusBadgeComponent,
    DataTableComponent,
    CellTemplateDirective,
    IonIcon,
    IonButton,
  ],
  template: `
    <app-data-table
      [title]="codeName()"
      createButtonLabel="CODE_VALUES.ADD"
      createPermission="CREATE_CODEVALUE"
      [columns]="columns"
      [data]="codeValues()"
      [totalRecords]="codeValues().length"
      [showSearch]="true"
      [localLogic]="true"
      [isLoading]="loading()"
      [hasError]="hasError()"
      (retry)="load()"
      (create)="onAddValue()"
    >
      <ng-template appCellTemplate="isActive" let-row>
        @if (row.isActive === true) {
          <app-status-badge status="Active"></app-status-badge>
        }
      </ng-template>

      <ng-template appCellTemplate="actions" let-row>
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'COMMON.EDIT' | translate"
          (click)="onEdit(row)"
        >
          <ion-icon name="create-outline" slot="icon-only"></ion-icon>
        </ion-button>
        <ion-button
          fill="clear"
          color="danger"
          [attr.aria-label]="'COMMON.DELETE' | translate"
          (click)="onDelete(row)"
        >
          <ion-icon name="trash-outline" slot="icon-only"></ion-icon>
        </ion-button>
      </ng-template>
    </app-data-table>
  `,
})
export class CodeValuesListComponent implements OnInit {
  private readonly codeValuesService = inject(CodeValuesService);
  private readonly codesService = inject(CodesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly translate = inject(TranslateService);

  private readonly CODES_BASE = '/system/codes';

  readonly codeValues = signal<GetCodeValuesDataResponse[]>([]);
  readonly codeName = signal<string>('');
  readonly loading = signal(false);
  readonly hasError = signal(false);

  codeId = 0;

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'CODE_VALUES.NAME', sortable: true },
    { key: 'description', label: 'COMMON.DESCRIPTION', sortable: false },
    { key: 'position', label: 'CODE_VALUES.POSITION', sortable: true },
    { key: 'isActive', label: 'COMMON.STATUS', sortable: false },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('codeId');
      if (id) {
        this.codeId = +id;
        this.loadCodeName();
        this.load();
      }
    });
  }

  loadCodeName(): void {
    this.codesService.getCodesCodeId(this.codeId).subscribe({
      next: (data: GetCodesResponse) => this.codeName.set(data.name ?? ''),
      error: () => this.codeName.set(''),
    });
  }

  load(): void {
    this.loading.set(true);
    this.codeValuesService
      .getCodesCodeIdCodevalues(this.codeId)
      .pipe(
        tap(() => this.hasError.set(false)),
        catchError(() => {
          this.hasError.set(true);
          return of([] as GetCodeValuesDataResponse[]);
        }),
      )
      .subscribe((data: GetCodeValuesDataResponse[]) => {
        this.codeValues.set(data || []);
        this.loading.set(false);
      });
  }

  onBack(): void {
    this.router.navigate([this.CODES_BASE]);
  }

  onAddValue(): void {
    this.router.navigate([this.CODES_BASE, this.codeId, 'values', 'create']);
  }

  onEdit(row: GetCodeValuesDataResponse): void {
    this.router.navigate([this.CODES_BASE, this.codeId, 'values', 'edit', row.id]);
  }

  onDelete(row: GetCodeValuesDataResponse): void {
    if (row.id === undefined) return;

    // Was `window.confirm` with the raw key interpolated, so the dialog read
    // "CODE_VALUES.CONFIRM_DELETE: <name>". Whether the value may be deleted is the API's call.
    void this.dialogService
      .confirm({
        title: this.translate.instant('COMMON.DELETE'),
        message: this.translate.instant('CODE_VALUES.CONFIRM_DELETE', { name: row.name }),
        destructive: true,
      })
      .then((confirmed) => {
        if (!confirmed) return;
        this.codeValuesService
          .deleteCodesCodeIdCodevaluesCodeValueId(this.codeId, row.id!)
          .subscribe({
            next: () => this.load(),
            error: () => this.hasError.set(true),
          });
      });
  }
}
