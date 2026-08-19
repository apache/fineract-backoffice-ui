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
import { of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { IonButton, IonIcon } from '@ionic/angular/standalone';

import { CodesService, GetCodesResponse } from '../../../api';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { CellTemplateDirective, ColumnDef } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { DialogService } from '../../../core/services/dialog.service';

@Component({
  selector: 'app-codes-list',
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
      title="CODES.TITLE"
      createButtonLabel="CODES.CREATE"
      createPermission="CREATE_CODE"
      [columns]="columns"
      [data]="codes()"
      [totalRecords]="codes().length"
      [showSearch]="true"
      [localLogic]="true"
      [isLoading]="loading()"
      [hasError]="hasError()"
      (retry)="load()"
      (create)="onCreate()"
    >
      <ng-template appCellTemplate="systemDefined" let-row>
        @if (row.systemDefined === true) {
          <app-status-badge status="System"></app-status-badge>
        }
      </ng-template>

      <ng-template appCellTemplate="actions" let-row>
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'CODES.EDIT' | translate"
          (click)="onEdit(row)"
        >
          <ion-icon name="create-outline" slot="icon-only"></ion-icon>
        </ion-button>
        <ion-button
          fill="clear"
          color="secondary"
          [attr.aria-label]="'CODES.CODE_VALUES' | translate"
          (click)="onCodeValues(row)"
        >
          <ion-icon name="list-outline" slot="icon-only"></ion-icon>
        </ion-button>
        <!-- A system-defined code cannot be deleted, so the action is absent rather than
             present-but-inert: a disabled button invites a click that can never work. -->
        @if (row.systemDefined !== true) {
          <ion-button
            fill="clear"
            color="danger"
            [attr.aria-label]="'CODES.DELETE' | translate"
            (click)="onDelete(row)"
          >
            <ion-icon name="trash-outline" slot="icon-only"></ion-icon>
          </ion-button>
        }
      </ng-template>
    </app-data-table>
  `,
})
export class CodesListComponent implements OnInit {
  private readonly codesService = inject(CodesService);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly translate = inject(TranslateService);

  readonly codes = signal<GetCodesResponse[]>([]);
  readonly loading = signal(false);
  /** True when the last load failed, so the table offers a retry instead of an empty list. */
  readonly hasError = signal(false);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'CODES.NAME', sortable: true },
    { key: 'systemDefined', label: 'CODES.SYSTEM_DEFINED', sortable: false },
    { key: 'actions', label: 'CODES.ACTIONS', sortable: false },
  ];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.codesService
      .getCodes()
      .pipe(
        tap(() => this.hasError.set(false)),
        catchError(() => {
          this.hasError.set(true);
          return of([] as GetCodesResponse[]);
        }),
      )
      .subscribe((data: GetCodesResponse[]) => {
        this.codes.set(data || []);
        this.loading.set(false);
      });
  }

  onCreate(): void {
    this.router.navigate(['/system/codes/create']);
  }

  onEdit(row: GetCodesResponse): void {
    this.router.navigate(['/system/codes/edit', row.id]);
  }

  onCodeValues(row: GetCodesResponse): void {
    this.router.navigate(['/system/codes', row.id, 'values']);
  }

  onDelete(row: GetCodesResponse): void {
    if (row.systemDefined === true || row.id === undefined) return;

    // Was `window.confirm` with the raw key interpolated, so the dialog literally read
    // "CODES.CONFIRM_DELETE: <name>". Now the app's own confirm, with the string resolved.
    void this.dialogService
      .confirm({
        title: this.translate.instant('CODES.DELETE'),
        message: this.translate.instant('CODES.CONFIRM_DELETE', { name: row.name }),
        destructive: true,
      })
      .then((confirmed) => {
        if (!confirmed) return;
        this.codesService.deleteCodesCodeId(row.id!).subscribe({
          next: () => this.load(),
          error: () => this.hasError.set(true),
        });
      });
  }
}
