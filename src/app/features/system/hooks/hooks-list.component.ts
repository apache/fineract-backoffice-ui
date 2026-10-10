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
import { I18N, TranslatePipe } from '../../../core/adapters';
import { ColumnDef, CellTemplateDirective } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { HooksService, HookData } from '../../../api';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { DialogService } from '../../../core/services/dialog.service';
import { ButtonComponent } from '../../../ui/button/button.component';

/**
 * Lists configured Fineract hooks (webhook / template integrations).
 */
@Component({
  selector: 'app-hooks-list',
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
      title="nav.hooks"
      helpTextKey="HELP.HOOKS_DESC"
      createButtonLabel="HOOKS.CREATE"
      createPermission="CREATE_HOOK"
      [columns]="columns"
      [data]="hooks()"
      [totalRecords]="hooks().length"
      [localLogic]="true"
      (create)="onCreate()"
    >
      <ng-template appCellTemplate="isActive" let-row>
        {{ (row.isActive ? 'COMMON.YES' : 'COMMON.NO') | appTranslate }}
      </ng-template>
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
export class HooksListComponent implements OnInit {
  private readonly hooksService = inject(HooksService);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'HOOKS.NAME', sortable: true },
    { key: 'displayName', label: 'HOOKS.DISPLAY_NAME', sortable: true },
    { key: 'isActive', label: 'HOOKS.IS_ACTIVE', sortable: false },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly hooks = signal<HookData[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.hooksService.getHooks().subscribe({
      next: (data: HookData[]) => {
        this.hooks.set(data || []);
      },
      error: (err: unknown) => {
        console.error('Failed to load hooks', err);
      },
    });
  }

  onCreate(): void {
    this.router.navigate(['/system/hooks/create']);
  }

  onEdit(row: HookData): void {
    this.router.navigate(['/system/hooks/edit', row.id]);
  }

  async onDelete(row: HookData): Promise<void> {
    if (!row.id) return;
    const confirmed = await this.dialogService.confirm({
      title: this.i18n.translate('HOOKS.DELETE'),
      message: this.i18n.translate('HOOKS.CONFIRM_DELETE', {
        name: row.displayName || row.name || '',
      }),
      destructive: true,
    });
    if (!confirmed) return;
    this.hooksService.deleteHooksHookId(row.id).subscribe({
      next: () => this.load(),
      error: (err: unknown) => console.error('Failed to delete hook', err),
    });
  }
}
