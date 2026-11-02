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
import { I18N, TELLER_API, Teller, TranslatePipe } from '../../core/adapters';
import { DialogService } from '../../core/services/dialog.service';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { ColumnDef, CellTemplateDirective, RequiresPermissionDirective } from '../../shared';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
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
    TranslatePipe,
    IonButton,
    IonIcon,
    DataTableComponent,
    CellTemplateDirective,
    RequiresPermissionDirective,
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
        {{ teller.startDate ?? '-' }}
      </ng-template>

      <ng-template appCellTemplate="actions" let-teller>
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'COMMON.EDIT' | appTranslate"
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
          [attr.aria-label]="'TELLERS.CASHIERS' | appTranslate"
          [appTooltip]="'Manage Cashiers'"
          (click)="onManageCashiers(teller)"
          [id]="'manage-cashiers-btn-' + teller.id"
          [attr.data-testid]="'manage-cashiers-btn-' + teller.id"
        >
          <ion-icon name="people-outline" slot="icon-only"></ion-icon>
        </ion-button>
        <ion-button
          fill="clear"
          color="danger"
          appRequiresPermission="DELETE_TELLER"
          [attr.aria-label]="'TELLERS.DELETE_TELLER' | appTranslate"
          [appTooltip]="'TELLERS.DELETE_TELLER' | appTranslate"
          (click)="onDeleteTeller(teller)"
          [id]="'delete-teller-btn-' + teller.id"
          [attr.data-testid]="'delete-teller-btn-' + teller.id"
        >
          <ion-icon name="trash-outline" slot="icon-only"></ion-icon>
        </ion-button>
      </ng-template>
    </app-data-table>
  `,
})
export class TellersListComponent implements OnInit {
  /** Teller and cashier operations, through the contract rather than the generated client */
  private readonly tellerApi = inject(TELLER_API);
  /** Router for navigating to creation and edit forms */
  private readonly router = inject(Router);
  private readonly dialog = inject(DialogService);
  private readonly i18n = inject(I18N);

  /** Column definitions for the tellers data table */
  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'TELLERS.NAME', sortable: true },
    { key: 'officeName', label: 'TELLERS.OFFICE', sortable: true },
    { key: 'status', label: 'TELLERS.STATUS', sortable: true },
    { key: 'startDate', label: 'TELLERS.START_DATE', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  /** List of tellers retrieved from the API */
  readonly tellers = signal<Teller[]>([]);

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
    this.tellerApi.list().subscribe({
      next: (data) => {
        this.tellers.set(data);
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
  onEditTeller(teller: Teller): void {
    this.router.navigate(['/tellers/edit', teller.id]);
  }

  /**
   * Navigates to the cashier management view for a specific teller.
   *
   * @param teller - The teller entity.
   */
  onManageCashiers(teller: Teller): void {
    this.router.navigate(['/tellers', teller.id, 'cashiers']);
  }

  /**
   * Deletes a teller, which Fineract refuses while it still holds cashiers or transactions.
   *
   * The confirmation says so up front, because the alternative is offering an action that looks
   * available and then explaining a refusal. The refusal itself is the platform's own message,
   * already shown by the error interceptor, so it is not restated here. The list is reloaded
   * only on success: a row that is still there is the truthful outcome of a refused delete.
   */
  async onDeleteTeller(teller: Teller): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: this.i18n.translate('TELLERS.DELETE_TELLER'),
      message: this.i18n.translate('TELLERS.DELETE_TELLER_CONFIRM'),
      details: [{ label: this.i18n.translate('TELLERS.NAME'), value: teller.name }],
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    this.tellerApi.delete(teller.id).subscribe({
      next: () => this.loadTellers(),
      error: (err: unknown) => {
        console.error('Failed to delete teller', err);
      },
    });
  }
}
