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
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';
import {
  DataTablesService,
  PostDataTablesRequest,
  CodesService,
  GetCodesResponse,
} from '../../../api';

@Component({
  selector: 'app-datatables-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    IonIcon,
    IonButton,
    IonInput,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonSelectOption,
    IonSelect,
    IonCheckbox,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode
                ? ('SYSTEM.EDIT_DATA_TABLE' | translate)
                : ('SYSTEM.CREATE_DATA_TABLE' | translate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #dtForm="ngForm" (ngSubmit)="onSubmit()" class="dt-form">
            <div class="header-grid">
              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'SYSTEM.TABLE_NAME' | translate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'SYSTEM.TABLE_NAME' | translate"
                  name="datatableName"
                  [(ngModel)]="datatable().datatableName"
                  required
                  [disabled]="isEditMode"
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'SYSTEM.APP_TABLE' | translate }}</ion-label>
                <ion-select
                  [attr.aria-label]="'SYSTEM.APP_TABLE' | translate"
                  interface="popover"
                  name="apptableName"
                  [(ngModel)]="datatable().apptableName"
                  required
                  [disabled]="isEditMode"
                >
                  @for (table of appTables; track table) {
                    <ion-select-option [value]="table">{{ table }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>
            </div>

            <div class="checkbox-row">
              <ion-checkbox
                name="multiRow"
                [(ngModel)]="datatable().multiRow"
                [disabled]="isEditMode"
              >
                {{ 'SYSTEM.MULTI_ROW' | translate }}
              </ion-checkbox>
            </div>

            <div class="columns-section">
              <h3>{{ 'SYSTEM.COLUMNS' | translate }}</h3>

              @for (column of datatable().columns; track $index; let i = $index) {
                <div class="column-row">
                  <ion-item fill="outline">
                    <ion-label position="stacked">{{ 'COMMON.NAME' | translate }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'COMMON.NAME' | translate"
                      [name]="'colName' + i"
                      [(ngModel)]="column.name"
                      required
                      [disabled]="isEditMode"
                    ></ion-input>
                  </ion-item>

                  <ion-item fill="outline">
                    <ion-label position="stacked">{{ 'COMMON.TYPE' | translate }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'COMMON.TYPE' | translate"
                      interface="popover"
                      [name]="'colType' + i"
                      [(ngModel)]="column.type"
                      required
                      [disabled]="isEditMode"
                    >
                      @for (type of columnTypes; track type) {
                        <ion-select-option [value]="type">{{ type }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>

                  @if (column.type === 'String') {
                    <ion-item fill="outline">
                      <ion-label position="stacked">{{ 'SYSTEM.LENGTH' | translate }}</ion-label>
                      <ion-input
                        [attr.aria-label]="'SYSTEM.LENGTH' | translate"
                        type="number"
                        [name]="'colLength' + i"
                        [(ngModel)]="column.length"
                        required
                        [disabled]="isEditMode"
                      ></ion-input>
                    </ion-item>
                  } @else if (column.type === 'Dropdown') {
                    <ion-item fill="outline">
                      <ion-label position="stacked">{{ 'SYSTEM.CODE' | translate }}</ion-label>
                      <ion-select
                        [attr.aria-label]="'SYSTEM.CODE' | translate"
                        interface="popover"
                        [name]="'colCode' + i"
                        [(ngModel)]="column.code"
                        required
                        [disabled]="isEditMode"
                      >
                        @for (code of codes(); track code.id) {
                          <ion-select-option [value]="code.name">{{ code.name }}</ion-select-option>
                        }
                      </ion-select>
                    </ion-item>
                  } @else {
                    <div class="placeholder-cell"></div>
                  }

                  <div class="column-checkboxes">
                    <ion-checkbox
                      [name]="'colMandatory' + i"
                      [(ngModel)]="column.mandatory"
                      [disabled]="isEditMode"
                    >
                      {{ 'SYSTEM.MANDATORY' | translate }}
                    </ion-checkbox>
                    <ion-checkbox
                      [name]="'colUnique' + i"
                      [(ngModel)]="column.unique"
                      [disabled]="isEditMode"
                    >
                      {{ 'SYSTEM.UNIQUE' | translate }}
                    </ion-checkbox>
                    <ion-checkbox
                      [name]="'colIndexed' + i"
                      [(ngModel)]="column.indexed"
                      [disabled]="isEditMode"
                    >
                      {{ 'SYSTEM.INDEXED' | translate }}
                    </ion-checkbox>
                  </div>

                  @if (!isEditMode) {
                    <ion-button
                      fill="clear"
                      color="danger"
                      type="button"
                      (click)="removeColumn(i)"
                      [attr.aria-label]="'SYSTEM.REMOVE_COLUMN' | translate"
                    >
                      <ion-icon name="trash-outline"></ion-icon>
                    </ion-button>
                  }
                </div>
              }

              @if (!isEditMode) {
                <ion-button
                  fill="outline"
                  color="primary"
                  type="button"
                  (click)="addColumn()"
                  class="add-col-btn"
                >
                  <ion-icon name="add-outline"></ion-icon>
                  {{ 'SYSTEM.ADD_COLUMN' | translate }}
                </ion-button>
              }
            </div>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()">
                {{ 'COMMON.CANCEL' | translate }}
              </ion-button>
              <ion-button color="primary" type="submit" [disabled]="!dtForm.form.valid">
                {{ 'COMMON.SAVE' | translate }}
              </ion-button>
            </div>
          </form>
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .form-container {
        padding: 24px;
        max-width: 1200px;
        margin: 0 auto;
      }
      .dt-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding-top: 16px;
      }
      .header-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      .checkbox-row {
        margin-bottom: 16px;
      }
      .columns-section h3 {
        margin: 16px 0;
        border-bottom: 1px solid #eee;
        padding-bottom: 8px;
        color: var(--primary-color);
      }
      .column-row {
        display: grid;
        grid-template-columns: 2fr 1.5fr 1.5fr 2fr auto;
        gap: 12px;
        align-items: center;
        margin-bottom: 8px;
      }
      .column-checkboxes {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        height: 100%;
      }
      .add-col-btn {
        margin-top: 8px;
      }
      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 24px;
      }
    `,
  ],
})
export class DatatablesFormComponent implements OnInit {
  private readonly datatablesService = inject(DataTablesService);
  private readonly codesService = inject(CodesService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly dtListPath = '/system/data-tables';

  isEditMode = false;
  datatableName?: string;
  readonly codes = signal<GetCodesResponse[]>([]);

  appTables = [
    'm_client',
    'm_group',
    'm_center',
    'm_office',
    'm_loan',
    'm_savings_account',
    'm_product_loan',
    'm_savings_product',
  ];

  columnTypes = ['String', 'Number', 'Decimal', 'Boolean', 'Date', 'DateTime', 'Dropdown', 'Text'];

  readonly datatable = signal<PostDataTablesRequest>({
    datatableName: '',
    apptableName: '',
    multiRow: false,
    columns: [],
  });

  ngOnInit(): void {
    this.loadCodes();
    this.datatableName = this.route.snapshot.paramMap.get('name') || undefined;
    if (this.datatableName) {
      this.isEditMode = true;
      this.loadDatatableData();
    } else {
      this.addColumn(); // Start with one empty column
    }
  }

  loadCodes(): void {
    this.codesService.getCodes().subscribe((data) => this.codes.set(data));
  }

  loadDatatableData(): void {
    this.datatablesService.getDatatablesDatatable(this.datatableName!).subscribe((data) => {
      this.datatable.set({
        datatableName: data.registeredTableName!,
        apptableName: data.applicationTableName!,
        columns: (data.columnHeaderData || []).map((col) => ({
          name: col.columnName!,
          type: col.columnDisplayType!,
          mandatory: !col.isColumnNullable,
          unique: col.isColumnUnique,
          indexed: col.isColumnIndexed,
          length: col.columnLength,
          code: col.columnCode,
        })),
      });
    });
  }

  addColumn(): void {
    this.datatable().columns.push({
      name: '',
      type: 'String',
      mandatory: false,
      unique: false,
      indexed: false,
      length: 10,
    });
  }

  removeColumn(index: number): void {
    this.datatable().columns.splice(index, 1);
  }

  onSubmit(): void {
    if (this.isEditMode) {
      // Fineract only supports changing column names/types/codes in specific ways via updateDatatable
      // but usually definitions are somewhat immutable. We use the service's updateDatatable.
      this.datatablesService
        .putDatatablesDatatableName(this.datatableName!, this.datatable())
        .subscribe({
          next: () => this.router.navigate([this.dtListPath]),
          error: (err) => console.error('Failed to update datatable', err),
        });
    } else {
      this.datatablesService.postDatatables(this.datatable()).subscribe({
        next: () => this.router.navigate([this.dtListPath]),
        error: (err) => console.error('Failed to create datatable', err),
      });
    }
  }

  onCancel(): void {
    this.router.navigate([this.dtListPath]);
  }
}
