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
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../core/adapters';
import { ColumnDef } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { EntityFieldConfigurationService, FieldConfigurationData } from '../../../api';
import {
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';

/**
 * Read-only entity field configuration viewer. The user picks an entity (CLIENT,
 * ADDRESS, ...) and the configured fields are loaded and shown in a table.
 */
@Component({
  selector: 'app-field-configuration',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    DataTableComponent,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCard,
    IonSelectOption,
    IonSelect,
  ],
  template: `
    <div class="field-config-container">
      <ion-card>
        <ion-card-content>
          <ion-item fill="outline">
            <ion-label position="stacked">{{ 'FIELD_CONFIG.ENTITY' | appTranslate }}</ion-label>
            <ion-select
              [attr.aria-label]="'FIELD_CONFIG.ENTITY' | appTranslate"
              interface="popover"
              [(ngModel)]="entity"
              (ngModelChange)="load()"
            >
              @for (opt of entityOptions; track opt) {
                <ion-select-option [value]="opt">{{ opt }}</ion-select-option>
              }
            </ion-select>
          </ion-item>
        </ion-card-content>
      </ion-card>
    </div>

    <app-data-table
      title="FIELD_CONFIG.TITLE"
      [columns]="columns"
      [data]="fields()"
      [totalRecords]="fields().length"
      [localLogic]="true"
    ></app-data-table>
  `,
  styles: [
    `
      .field-config-container {
        padding: 16px;
      }
      ion-item {
        width: 320px;
      }
    `,
  ],
})
export class FieldConfigurationComponent implements OnInit {
  private readonly fieldService = inject(EntityFieldConfigurationService);

  readonly entityOptions = ['CLIENT', 'ADDRESS'];

  readonly columns: ColumnDef[] = [
    { key: 'field', label: 'FIELD_CONFIG.FIELD', sortable: true },
    { key: 'subentity', label: 'FIELD_CONFIG.SUBENTITY', sortable: true },
    { key: 'isEnabled', label: 'FIELD_CONFIG.ENABLED', sortable: false },
    { key: 'isMandatory', label: 'FIELD_CONFIG.MANDATORY', sortable: false },
    { key: 'validationRegex', label: 'FIELD_CONFIG.VALIDATION_REGEX', sortable: false },
  ];

  entity = 'CLIENT';
  readonly fields = signal<FieldConfigurationData[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.fieldService.getFieldconfigurationEntity(this.entity).subscribe({
      next: (data: FieldConfigurationData[]) => {
        this.fields.set(data || []);
      },
      error: (err: unknown) => console.error('Failed to load field configuration', err),
    });
  }
}
