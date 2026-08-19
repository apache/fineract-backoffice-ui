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
import { ColumnDef, CellTemplateDirective } from '../../shared';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { TellerCashManagementService, GetTellersResponse } from '../../api';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';

/**
 * Component for displaying a list of branch tellers.
 *
 * Integrates with the Fineract Teller Cash Management API to retrieve
 * and display teller data. Since the API returns the full list,
 * this component uses local pagination and search.
 *
 * @example
 * <app-tellers-list></app-tellers-list>
 */
@Component({
  selector: 'app-tellers-list',
  standalone: true,
  imports: [
    TranslateModule,
    IonButton,
    IonIcon,
    DataTableComponent,
    CellTemplateDirective,
    TooltipDirective,
  ],
  template: `
    <app-data-table
      title="nav.tellers"
      helpTextKey="HELP.TELLERS_DESC"
      createButtonLabel="TELLERS.CREATE_TELLER"
      createPermission="CREATE_TELLER"
      [columns]="columns"
      [data]="tellers()"
      [totalRecords]="tellers().length"
      [showSearch]="true"
      [localLogic]="true"
      (create)="onCreateTeller()"
    >
      <ng-template appCellTemplate="startDate" let-teller>
        {{ formatArrayDate(teller.startDate) }}
      </ng-template>

      <ng-template appCellTemplate="actions" let-teller>
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'COMMON.EDIT' | translate"
          [appTooltip]="'Edit Teller Details'"
          (click)="onEditTeller(teller)"
          [id]="'edit-teller-btn-' + teller.id"
          [attr.data-testid]="'edit-teller-btn-' + teller.id"
        >
          <ion-icon name="create-outline" slot="icon-only"></ion-icon>
        </ion-button>
        <ion-button
          fill="clear"
          color="secondary"
          [attr.aria-label]="'TELLERS.CASHIERS' | translate"
          [appTooltip]="'Manage Cashiers'"
          (click)="onManageCashiers(teller)"
          [id]="'manage-cashiers-btn-' + teller.id"
          [attr.data-testid]="'manage-cashiers-btn-' + teller.id"
        >
          <ion-icon name="people-outline" slot="icon-only"></ion-icon>
        </ion-button>
      </ng-template>
    </app-data-table>
  `,
})
export class TellersListComponent implements OnInit {
  /** Service for teller and cashier management operations */
  private readonly tellerService = inject(TellerCashManagementService);
  /** Router for navigating to creation and edit forms */
  private readonly router = inject(Router);

  /** Column definitions for the tellers data table */
  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'TELLERS.NAME', sortable: true },
    { key: 'officeName', label: 'TELLERS.OFFICE', sortable: true },
    { key: 'status', label: 'TELLERS.STATUS', sortable: true },
    { key: 'startDate', label: 'TELLERS.START_DATE', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  /** List of tellers retrieved from the API */
  readonly tellers = signal<GetTellersResponse[]>([]);

  /**
   * Initializes the component by loading teller data.
   */
  ngOnInit(): void {
    this.loadTellers();
  }

  /**
   * Retrieves all tellers from the Fineract API.
   */
  private loadTellers(): void {
    this.tellerService.getTellers().subscribe({
      next: (data: GetTellersResponse[]) => {
        this.tellers.set(data || []);
      },
      error: (err: unknown) => {
        console.error('Failed to load tellers', err);
      },
    });
  }

  /**
   * Navigates to the teller creation form.
   */
  onCreateTeller(): void {
    this.router.navigate(['/tellers/create']);
  }

  /**
   * Navigates to the edit form for a specific teller.
   *
   * @param teller - The teller entity to edit.
   */
  onEditTeller(teller: GetTellersResponse): void {
    this.router.navigate(['/tellers/edit', teller.id]);
  }

  /**
   * Navigates to the cashier management view for a specific teller.
   *
   * @param teller - The teller entity.
   */
  onManageCashiers(teller: GetTellersResponse): void {
    this.router.navigate(['/tellers', teller.id, 'cashiers']);
  }
  /**
   * Formats a Fineract array date [YYYY, MM, DD] into a readable string.
   *
   * @param dateArray - The raw date value from the API.
   * @returns A formatted date string or a placeholder if invalid.
   */
  formatArrayDate(dateArray: unknown): string {
    if (!dateArray || !Array.isArray(dateArray) || dateArray.length < 3) {
      return '-';
    }
    const year = dateArray[0];
    const month = String(dateArray[1]).padStart(2, '0');
    const day = String(dateArray[2]).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
