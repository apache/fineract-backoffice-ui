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

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { I18N, TranslatePipe } from '../../../core/adapters';
import { TemplatesService, TemplateData } from '../../../api';
import { DialogService } from '../../../core/services/dialog.service';
import { CellTemplateDirective, ColumnDef } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';

@Component({
  selector: 'app-templates-list',
  standalone: true,
  imports: [TranslatePipe, DataTableComponent, CellTemplateDirective, IonIcon, IonButton],
  template: `
    <app-data-table
      title="TEMPLATES.TITLE"
      createButtonLabel="TEMPLATES.CREATE_TITLE"
      createPermission="CREATE_TEMPLATE"
      [columns]="columns"
      [data]="rows()"
      [totalRecords]="rows().length"
      [showSearch]="true"
      [localLogic]="true"
      [isLoading]="loading()"
      [hasError]="hasError()"
      (retry)="loadTemplates()"
      (create)="onCreate()"
    >
      <ng-template appCellTemplate="actions" let-row>
        <ion-button
          fill="clear"
          color="primary"
          (click)="onEdit(row)"
          [attr.aria-label]="'COMMON.EDIT' | appTranslate"
        >
          <ion-icon name="create-outline" slot="icon-only"></ion-icon>
        </ion-button>
        <ion-button
          fill="clear"
          color="danger"
          (click)="onDelete(row)"
          [attr.aria-label]="'COMMON.DELETE' | appTranslate"
        >
          <ion-icon name="trash-outline" slot="icon-only"></ion-icon>
        </ion-button>
      </ng-template>
    </app-data-table>
  `,
})
export class TemplatesListComponent implements OnInit {
  private readonly templatesService = inject(TemplatesService);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);

  readonly templates = signal<TemplateData[]>([]);
  readonly loading = signal(false);
  /** True when the last load failed, so the table offers a retry instead of an empty list. */
  readonly hasError = signal(false);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'TEMPLATES.NAME', sortable: true },
    { key: 'entity', label: 'TEMPLATES.ENTITY', sortable: true },
    { key: 'type', label: 'TEMPLATES.TYPE', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  /**
   * The table's own search and sort work against the raw row values (see
   * `DataTableComponent.matchesFilter`/`sortRows`), so `entity`/`type` are resolved to the
   * text the columns actually display before the rows reach the table — otherwise typing
   * "Loan" would search for the string against the numeric code Fineract returns and never
   * match.
   */
  readonly rows = computed(() =>
    this.templates().map((row) => ({
      ...row,
      entity: this.translateEntity(row.entity),
      type: this.translateType(row.type),
    })),
  );

  ngOnInit(): void {
    this.loadTemplates();
  }

  loadTemplates(): void {
    this.loading.set(true);
    this.templatesService
      .getTemplates()
      .pipe(
        tap(() => this.hasError.set(false)),
        catchError(() => {
          this.hasError.set(true);
          return of([] as TemplateData[]);
        }),
      )
      .subscribe((data) => {
        this.templates.set(data || []);
        this.loading.set(false);
      });
  }

  translateEntity(entity?: number): string {
    if (entity === 0) return 'Client';
    if (entity === 1) return 'Loan';
    return '';
  }

  translateType(type?: number): string {
    if (type === 0) return 'Document';
    if (type === 2) return 'SMS';
    return '';
  }

  onCreate(): void {
    this.router.navigate(['/system/templates/create']);
  }

  onEdit(row: TemplateData): void {
    this.router.navigate(['/system/templates/edit', row.id]);
  }

  async onDelete(row: TemplateData): Promise<void> {
    if (row.id === undefined) return;
    const confirmed = await this.dialogService.confirm({
      title: this.i18n.translate('TEMPLATES.DELETE'),
      message: this.i18n.translate('TEMPLATES.DELETE_CONFIRM', { name: row.name ?? '' }),
      destructive: true,
    });
    if (!confirmed) return;
    this.templatesService.deleteTemplatesTemplateId(row.id).subscribe({
      next: () => this.loadTemplates(),
      error: () => this.hasError.set(true),
    });
  }
}
