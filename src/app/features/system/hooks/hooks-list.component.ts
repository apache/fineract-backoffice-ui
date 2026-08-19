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
import { TranslateModule } from '@ngx-translate/core';
import { ColumnDef, CellTemplateDirective } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { HooksService, HookData } from '../../../api';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';

/**
 * Lists configured Fineract hooks (webhook / template integrations).
 */
@Component({
  selector: 'app-hooks-list',
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
        {{ (row.isActive ? 'COMMON.YES' : 'COMMON.NO') | translate }}
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
export class HooksListComponent implements OnInit {
  private readonly hooksService = inject(HooksService);
  private readonly router = inject(Router);

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

  onDelete(row: HookData): void {
    if (!row.id || !window.confirm('Delete this hook?')) return;
    this.hooksService.deleteHooksHookId(row.id).subscribe({
      next: () => this.load(),
      error: (err: unknown) => console.error('Failed to delete hook', err),
    });
  }
}
