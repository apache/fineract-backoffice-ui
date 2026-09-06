/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NotificationService, GetNotificationsResponse, GetNotification } from '../../api';
import { NotificationService as ToastService } from '../../core/services/notification.service';
import { CdkTableModule } from '@angular/cdk/table';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonChip,
  IonSpinner,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-notifications-list',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    CdkTableModule,
    TranslateModule,
    IonButton,
    IonSpinner,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonCheckbox,
    IonChip,
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ 'NOTIFICATIONS.TITLE' | translate }}</ion-card-title>
        <div class="header-actions">
          <ion-checkbox [(ngModel)]="showUnreadOnly" (ionChange)="onFilterChange()">
            {{ 'NOTIFICATIONS.SHOW_UNREAD' | translate }}
          </ion-checkbox>
          <ion-button color="primary" (click)="markAllRead()">
            {{ 'NOTIFICATIONS.MARK_ALL_READ' | translate }}
          </ion-button>
        </div>
      </ion-card-header>

      <ion-card-content>
        @if (isLoading()) {
          <div class="spinner-container">
            <ion-spinner name="crescent"></ion-spinner>
          </div>
        }

        @if (!isLoading()) {
          <table cdk-table [dataSource]="notifications()">
            <ng-container cdkColumnDef="content">
              <th cdk-header-cell *cdkHeaderCellDef>{{ 'NOTIFICATIONS.MESSAGE' | translate }}</th>
              <td cdk-cell *cdkCellDef="let row">{{ row.content }}</td>
            </ng-container>

            <ng-container cdkColumnDef="isRead">
              <th cdk-header-cell *cdkHeaderCellDef>{{ 'NOTIFICATIONS.READ' | translate }}</th>
              <td cdk-cell *cdkCellDef="let row">
                <div>
                  <ion-chip [color]="row.isRead ? 'primary' : 'danger'" highlighted>
                    {{ (row.isRead ? 'NOTIFICATIONS.READ' : 'NOTIFICATIONS.UNREAD') | translate }}
                  </ion-chip>
                </div>
              </td>
            </ng-container>

            <ng-container cdkColumnDef="createdAt">
              <th cdk-header-cell *cdkHeaderCellDef>{{ 'NOTIFICATIONS.DATE' | translate }}</th>
              <td cdk-cell *cdkCellDef="let row">{{ row.createdAt | date: 'medium' }}</td>
            </ng-container>

            <tr cdk-header-row *cdkHeaderRowDef="displayedColumns"></tr>
            <tr cdk-row *cdkRowDef="let row; columns: displayedColumns"></tr>

            <tr class="no-data-row" *cdkNoDataRow>
              <td [attr.colspan]="displayedColumns.length">
                {{ 'COMMON.NO_DATA' | translate }}
              </td>
            </tr>
          </table>
        }
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      mat-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .header-actions {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-left: auto;
      }
      .spinner-container {
        display: flex;
        justify-content: center;
        padding: 32px;
      }
      table {
        width: 100%;
      }
      .no-data-row td {
        text-align: center;
        color: var(--text-muted, #7f8c8d);
        padding: 24px 0;
      }
    `,
  ],
})
export class NotificationsListComponent implements OnInit {
  private notificationService = inject(NotificationService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  readonly notifications = signal<GetNotification[]>([]);
  showUnreadOnly = false;
  readonly isLoading = signal(false);

  displayedColumns = ['content', 'isRead', 'createdAt'];

  ngOnInit(): void {
    this.loadNotifications();
  }

  loadNotifications(): void {
    this.isLoading.set(true);
    const isRead = this.showUnreadOnly ? false : undefined;
    this.notificationService
      .getNotifications(undefined, undefined, undefined, undefined, isRead)
      .subscribe({
        next: (response: GetNotificationsResponse) => {
          this.notifications.set(response.pageItems ?? []);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        },
      });
  }

  onFilterChange(): void {
    this.loadNotifications();
  }

  markAllRead(): void {
    this.notificationService.putNotifications().subscribe({
      next: () => {
        this.translate.get('NOTIFICATIONS.ALL_READ_SUCCESS').subscribe((msg: string) => {
          this.toast.success(msg);
        });
        this.loadNotifications();
      },
    });
  }
}
