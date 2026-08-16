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
import { TranslateModule } from '@ngx-translate/core';
import {
  DataTableComponent,
  ColumnDef,
  HasPermissionDirective,
  CellTemplateDirective,
} from '../../../shared';
import { ClientsAddressService, AddressData } from '../../../api';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';

@Component({
  selector: 'app-client-addresses-list',
  standalone: true,
  imports: [
    RouterModule,
    TranslateModule,
    DataTableComponent,
    HasPermissionDirective,
    CellTemplateDirective,
    IonIcon,
    IonButton,
    TooltipDirective,
  ],
  template: `
    <div class="tab-actions">
      <ion-button
        color="primary"
        [routerLink]="['/clients', clientId(), 'addresses', 'create']"
        *appHasPermission="'CREATE_ADDRESS'"
      >
        <ion-icon name="add-outline"></ion-icon>
        {{ 'CLIENTS.ADD_ADDRESS' | translate }}
      </ion-button>
    </div>

    <app-data-table
      [data]="addresses()"
      [columns]="columns"
      [isLoading]="isLoading()"
      [localLogic]="true"
    >
      <ng-template appCellTemplate="address" let-row>
        {{ row.addressLine1 }}{{ row.addressLine2 ? ', ' + row.addressLine2 : ''
        }}{{ row.addressLine3 ? ', ' + row.addressLine3 : '' }}
      </ng-template>

      <ng-template appCellTemplate="isActive" let-row>
        <ion-icon
          [color]="row.isActive ? 'primary' : 'danger'"
          [name]="row.isActive ? 'checkmark-circle-outline' : 'close-circle-outline'"
        ></ion-icon>
      </ng-template>

      <ng-template appCellTemplate="actions" let-row>
        <div class="action-buttons">
          <ion-button
            fill="clear"
            color="primary"
            [routerLink]="['/clients', clientId(), 'addresses', 'edit', row.addressId]"
            *appHasPermission="'UPDATE_ADDRESS'"
            [attr.aria-label]="'COMMON.EDIT' | translate"
            [appTooltip]="'COMMON.EDIT' | translate"
          >
            <ion-icon name="create-outline"></ion-icon>
          </ion-button>
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
export class ClientAddressesListComponent implements OnInit {
  readonly clientId = input.required<number>();

  private readonly addressService = inject(ClientsAddressService);

  readonly addresses = signal<AddressData[]>([]);
  readonly isLoading = signal<boolean>(false);

  columns: ColumnDef[] = [
    {
      key: 'addressType',
      label: 'CLIENTS.ADDRESS_TYPE',
    },
    {
      key: 'address',
      label: 'CLIENTS.ADDRESS',
    },
    {
      key: 'city',
      label: 'CLIENTS.CITY',
    },
    {
      key: 'stateName',
      label: 'CLIENTS.STATE',
    },
    {
      key: 'countryName',
      label: 'CLIENTS.COUNTRY',
    },
    {
      key: 'isActive',
      label: 'COMMON.ACTIVE',
    },
    {
      key: 'actions',
      label: 'COMMON.ACTIONS',
    },
  ];

  ngOnInit(): void {
    this.loadAddresses();
  }

  loadAddresses(): void {
    this.isLoading.set(true);
    this.addressService.getClientClientidAddresses(this.clientId()).subscribe({
      next: (data) => {
        this.addresses.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load client addresses', err);
        this.isLoading.set(false);
      },
    });
  }
}
