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

import { inject, input, signal, Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '../../../core/adapters';
import {
  DataTableComponent,
  ColumnDef,
  HasPermissionDirective,
  CellTemplateDirective,
} from '../../../shared';
import { ClientFamilyMemberService, ClientFamilyMembersData } from '../../../api';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { ButtonComponent } from '../../../ui/button/button.component';

@Component({
  selector: 'app-client-family-members-list',
  standalone: true,
  imports: [
    RouterModule,
    TranslatePipe,
    DataTableComponent,
    HasPermissionDirective,
    CellTemplateDirective,
    ButtonComponent,
    TooltipDirective,
  ],
  template: `
    <div class="tab-actions">
      <app-button
        type="button"
        intent="primary"
        [link]="['/clients', clientId(), 'family-members', 'create']"
        icon="add-outline"
        *appHasPermission="'CREATE_FAMILYMEMBERS'"
        >{{ 'CLIENTS.ADD_FAMILY_MEMBER' | appTranslate }}</app-button
      >
    </div>

    <app-data-table
      [data]="familyMembers()"
      [columns]="columns"
      [isLoading]="isLoading()"
      [localLogic]="true"
    >
      <ng-template appCellTemplate="fullname" let-row>
        {{ row.firstName }} {{ row.middleName ? row.middleName + ' ' : '' }}{{ row.lastName }}
      </ng-template>

      <ng-template appCellTemplate="actions" let-row>
        <div class="action-buttons">
          <app-button
            type="button"
            intent="primary"
            emphasis="quiet"
            [label]="'COMMON.EDIT' | appTranslate"
            [link]="['/clients', clientId(), 'family-members', 'edit', row.id]"
            icon="create-outline"
            *appHasPermission="'UPDATE_FAMILYMEMBERS'"
            [appTooltip]="'COMMON.EDIT' | appTranslate"
          />
          <app-button
            type="button"
            intent="danger"
            emphasis="quiet"
            [label]="'COMMON.DELETE' | appTranslate"
            icon="trash-outline"
            (click)="onDelete(row.id)"
            *appHasPermission="'DELETE_FAMILYMEMBERS'"
            [appTooltip]="'COMMON.DELETE' | appTranslate"
          />
        </div>
      </ng-template>
    </app-data-table>
  `,
  styles: [
    `
      .tab-actions {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 16px;
      }
      .action-buttons {
        display: flex;
        gap: 8px;
      }
    `,
  ],
})
export class ClientFamilyMembersListComponent implements OnInit {
  readonly clientId = input.required<number>();

  private readonly familyMemberService = inject(ClientFamilyMemberService);

  readonly familyMembers = signal<ClientFamilyMembersData[]>([]);
  readonly isLoading = signal<boolean>(false);

  columns: ColumnDef[] = [
    {
      key: 'fullname',
      label: 'COMMON.NAME',
    },
    {
      key: 'relationship',
      label: 'CLIENTS.RELATIONSHIP',
    },
    {
      key: 'gender',
      label: 'CLIENTS.GENDER',
    },
    {
      key: 'profession',
      label: 'CLIENTS.PROFESSION',
    },
    {
      key: 'mobileNumber',
      label: 'CLIENTS.MOBILE_NO',
    },
    {
      key: 'actions',
      label: 'COMMON.ACTIONS',
    },
  ];

  ngOnInit(): void {
    this.loadFamilyMembers();
  }

  loadFamilyMembers(): void {
    this.isLoading.set(true);
    this.familyMemberService.getClientsClientIdFamilymembers(this.clientId()).subscribe({
      next: (data) => {
        this.familyMembers.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load client family members', err);
        this.isLoading.set(false);
      },
    });
  }

  onDelete(id: number): void {
    if (confirm('Are you sure you want to delete this family member?')) {
      this.familyMemberService
        .deleteClientsClientIdFamilymembersFamilyMemberId(id, this.clientId())
        .subscribe({
          next: () => this.loadFamilyMembers(),
          error: (err) => console.error('Failed to delete family member', err),
        });
    }
  }
}
