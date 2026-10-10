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
import { Component, signal, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18N, TranslatePipe } from '../../../core/adapters';
import { DefaultService, ExternalEventResponse } from '../../../api';
import { NotificationService } from '../../../core/services/notification.service';
import { CdkTableModule } from '@angular/cdk/table';
import { DialogService } from '../../../core/services/dialog.service';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonInput,
  IonItem,
  IonLabel,
  IonSpinner,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-external-events',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    CdkTableModule,
    TranslatePipe,
    IonButton,
    IonSpinner,
    IonInput,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ 'EXTERNAL_EVENTS.TITLE' | appTranslate }}</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <div class="filter-row">
          <ion-item fill="outline">
            <ion-label position="stacked">{{
              'EXTERNAL_EVENTS.IDEMPOTENCY_KEY' | appTranslate
            }}</ion-label>
            <ion-input
              [attr.aria-label]="'EXTERNAL_EVENTS.IDEMPOTENCY_KEY' | appTranslate"
              [(ngModel)]="filters.idempotencyKey"
            ></ion-input>
          </ion-item>

          <ion-item fill="outline">
            <ion-label position="stacked">{{ 'EXTERNAL_EVENTS.TYPE' | appTranslate }}</ion-label>
            <ion-input
              [attr.aria-label]="'EXTERNAL_EVENTS.TYPE' | appTranslate"
              [(ngModel)]="filters.type"
            ></ion-input>
          </ion-item>

          <ion-item fill="outline">
            <ion-label position="stacked">{{
              'EXTERNAL_EVENTS.CATEGORY' | appTranslate
            }}</ion-label>
            <ion-input
              [attr.aria-label]="'EXTERNAL_EVENTS.CATEGORY' | appTranslate"
              [(ngModel)]="filters.category"
            ></ion-input>
          </ion-item>

          <ion-item fill="outline">
            <ion-label position="stacked">{{
              'EXTERNAL_EVENTS.AGGREGATE_ROOT_ID' | appTranslate
            }}</ion-label>
            <ion-input
              [attr.aria-label]="'EXTERNAL_EVENTS.AGGREGATE_ROOT_ID' | appTranslate"
              [(ngModel)]="filters.aggregateRootId"
            ></ion-input>
          </ion-item>
        </div>

        <div class="action-row">
          <ion-button color="primary" (click)="load()" [disabled]="isLoading()">
            @if (isLoading()) {
              <ion-spinner name="crescent"></ion-spinner>
            } @else {
              {{ 'EXTERNAL_EVENTS.LOAD' | appTranslate }}
            }
          </ion-button>
          <ion-button color="danger" (click)="clearAll()" [disabled]="isLoading()">
            {{ 'EXTERNAL_EVENTS.CLEAR_ALL' | appTranslate }}
          </ion-button>
        </div>
      </ion-card-content>
    </ion-card>

    @if (events().length > 0) {
      <ion-card class="table-card">
        <ion-card-content>
          <table cdk-table [dataSource]="events()" class="full-width">
            <ng-container cdkColumnDef="idempotencyKey">
              <th cdk-header-cell *cdkHeaderCellDef>
                {{ 'EXTERNAL_EVENTS.IDEMPOTENCY_KEY' | appTranslate }}
              </th>
              <td cdk-cell *cdkCellDef="let row">{{ row.idempotencyKey }}</td>
            </ng-container>

            <ng-container cdkColumnDef="type">
              <th cdk-header-cell *cdkHeaderCellDef>{{ 'EXTERNAL_EVENTS.TYPE' | appTranslate }}</th>
              <td cdk-cell *cdkCellDef="let row">{{ row.type }}</td>
            </ng-container>

            <ng-container cdkColumnDef="category">
              <th cdk-header-cell *cdkHeaderCellDef>
                {{ 'EXTERNAL_EVENTS.CATEGORY' | appTranslate }}
              </th>
              <td cdk-cell *cdkCellDef="let row">{{ row.category }}</td>
            </ng-container>

            <ng-container cdkColumnDef="aggregateRootId">
              <th cdk-header-cell *cdkHeaderCellDef>
                {{ 'EXTERNAL_EVENTS.AGGREGATE_ROOT_ID' | appTranslate }}
              </th>
              <td cdk-cell *cdkCellDef="let row">{{ row.aggregateRootId }}</td>
            </ng-container>

            <ng-container cdkColumnDef="createdAt">
              <th cdk-header-cell *cdkHeaderCellDef>
                {{ 'EXTERNAL_EVENTS.CREATED_AT' | appTranslate }}
              </th>
              <td cdk-cell *cdkCellDef="let row">{{ row.createdAt | date: 'medium' }}</td>
            </ng-container>

            <tr cdk-header-row *cdkHeaderRowDef="displayedColumns"></tr>
            <tr cdk-row *cdkRowDef="let row; columns: displayedColumns"></tr>
          </table>
        </ion-card-content>
      </ion-card>
    }
  `,
  styles: [
    `
      .filter-row {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
      }
      .filter-row mat-form-field {
        flex: 1 1 200px;
      }
      .action-row {
        display: flex;
        gap: 12px;
        margin-top: 8px;
      }
      .table-card {
        margin-top: 16px;
      }
      .full-width {
        width: 100%;
      }
      ion-spinner {
        display: inline-block;
      }
    `,
  ],
})
export class ExternalEventsComponent {
  private defaultService = inject(DefaultService);
  private notifications = inject(NotificationService);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);

  filters = {
    idempotencyKey: '',
    type: '',
    category: '',
    aggregateRootId: '',
  };

  readonly events = signal<ExternalEventResponse[]>([]);
  readonly isLoading = signal(false);

  displayedColumns = ['idempotencyKey', 'type', 'category', 'aggregateRootId', 'createdAt'];

  load(): void {
    this.isLoading.set(true);
    const { idempotencyKey, type, category, aggregateRootId } = this.filters;
    this.defaultService
      .getInternalExternalevents(
        idempotencyKey || undefined,
        type || undefined,
        category || undefined,
        aggregateRootId ? Number(aggregateRootId) : undefined,
      )
      .subscribe({
        next: (data: ExternalEventResponse[]) => {
          this.events.set(Array.isArray(data) ? data : []);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        },
      });
  }

  clearAll(): void {
    // This was a snackbar with an action button, i.e. a confirmation prompt rather than a
    // notification. A dialog is the honest representation of that.
    this.i18n.translateAsync('EXTERNAL_EVENTS.CONFIRM_CLEAR').subscribe((msg: string) => {
      this.dialogService
        .confirm({
          title: this.i18n.translate('COMMON.CONFIRM'),
          message: msg,
          destructive: true,
        })
        .then((confirmed) => {
          if (!confirmed) return;
          this.isLoading.set(true);
          this.defaultService.deleteInternalExternalevents().subscribe({
            next: () => {
              this.events.set([]);
              this.isLoading.set(false);
            },
            error: () => {
              this.isLoading.set(false);
            },
          });
        });
    });
  }
}
