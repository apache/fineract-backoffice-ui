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
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { ColumnDef, CellTemplateDirective } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { TaxGroupService, GetTaxesGroupResponse } from '../../../api';

/**
 * Lists tax groups (a named bundle of tax components).
 */
@Component({
  selector: 'app-tax-groups-list',
  standalone: true,
  imports: [TranslateModule, IonButton, IonIcon, DataTableComponent, CellTemplateDirective],
  template: `
    <app-data-table
      title="nav.taxGroups"
      helpTextKey="HELP.TAX_GROUPS_DESC"
      createButtonLabel="TAX_GROUPS.CREATE"
      createPermission="CREATE_TAXGROUP"
      [columns]="columns"
      [data]="groups()"
      [totalRecords]="groups().length"
      [localLogic]="true"
      (create)="onCreate()"
    >
      <ng-template appCellTemplate="components" let-row>
        {{ componentNames(row) }}
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
      </ng-template>
    </app-data-table>
  `,
})
export class TaxGroupsListComponent implements OnInit {
  private readonly taxGroupService = inject(TaxGroupService);
  private readonly router = inject(Router);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'TAX_GROUPS.NAME', sortable: true },
    { key: 'components', label: 'TAX_GROUPS.COMPONENTS', sortable: false },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly groups = signal<GetTaxesGroupResponse[]>([]);

  ngOnInit(): void {
    this.taxGroupService.getTaxesGroup().subscribe({
      next: (data: GetTaxesGroupResponse[]) => {
        this.groups.set(data || []);
      },
      error: (err: unknown) => console.error('Failed to load tax groups', err),
    });
  }

  componentNames(group: GetTaxesGroupResponse): string {
    return Array.from(group.taxAssociations ?? [])
      .map((a) => a.taxComponent?.name)
      .filter(Boolean)
      .join(', ');
  }

  onCreate(): void {
    this.router.navigate(['/products/tax-groups/create']);
  }

  onEdit(row: GetTaxesGroupResponse): void {
    this.router.navigate(['/products/tax-groups/edit', row.id]);
  }
}
