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
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { I18N, TranslatePipe } from '../../../core/adapters';
import { DefaultService } from '../../../api';
import { NotificationService } from '../../../core/services/notification.service';
import { CdkTableModule } from '@angular/cdk/table';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonSpinner,
} from '@ionic/angular/standalone';

interface SmsCampaign {
  id: number;
  campaignName?: string;
  campaignType?: { id?: number; value?: string } | string;
  status?: { id?: number; value?: string } | string;
  campaignStatus?: { id?: number; value?: string } | string;
}

@Component({
  selector: 'app-sms-campaigns-list',
  standalone: true,
  imports: [
    CommonModule,
    CdkTableModule,
    RouterModule,
    TranslatePipe,
    IonIcon,
    IonButton,
    IonSpinner,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
  ],
  template: `
    <div class="container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'SMS_CAMPAIGNS.TITLE' | appTranslate }}</ion-card-title>
          <div class="header-actions">
            <ion-button color="primary" [routerLink]="['/campaigns/sms/create']">
              <ion-icon name="add-outline"></ion-icon>
              {{ 'SMS_CAMPAIGNS.CREATE' | appTranslate }}
            </ion-button>
          </div>
        </ion-card-header>

        <ion-card-content>
          @if (loading()) {
            <div class="spinner-container">
              <ion-spinner name="crescent"></ion-spinner>
            </div>
          } @else {
            <table cdk-table [dataSource]="campaigns()" class="full-width">
              <ng-container cdkColumnDef="id">
                <th cdk-header-cell *cdkHeaderCellDef>ID</th>
                <td cdk-cell *cdkCellDef="let row">{{ row.id }}</td>
              </ng-container>

              <ng-container cdkColumnDef="campaignName">
                <th cdk-header-cell *cdkHeaderCellDef>{{ 'SMS_CAMPAIGNS.NAME' | appTranslate }}</th>
                <td cdk-cell *cdkCellDef="let row">{{ row.campaignName }}</td>
              </ng-container>

              <ng-container cdkColumnDef="campaignType">
                <th cdk-header-cell *cdkHeaderCellDef>{{ 'SMS_CAMPAIGNS.TYPE' | appTranslate }}</th>
                <td cdk-cell *cdkCellDef="let row">
                  {{ row.campaignType?.value ?? row.campaignType }}
                </td>
              </ng-container>

              <ng-container cdkColumnDef="status">
                <th cdk-header-cell *cdkHeaderCellDef>
                  {{ 'SMS_CAMPAIGNS.STATUS' | appTranslate }}
                </th>
                <td cdk-cell *cdkCellDef="let row">{{ row.status?.value ?? row.status }}</td>
              </ng-container>

              <ng-container cdkColumnDef="actions">
                <th cdk-header-cell *cdkHeaderCellDef>
                  {{ 'SMS_CAMPAIGNS.ACTIONS' | appTranslate }}
                </th>
                <td cdk-cell *cdkCellDef="let row">
                  <ion-button
                    fill="clear"
                    color="primary"
                    (click)="edit(row.id)"
                    [attr.aria-label]="'SMS_CAMPAIGNS.EDIT' | appTranslate"
                  >
                    <ion-icon name="create-outline"></ion-icon>
                  </ion-button>
                  <ion-button
                    fill="clear"
                    color="secondary"
                    (click)="activate(row.id)"
                    [attr.aria-label]="'SMS_CAMPAIGNS.ACTIVATE' | appTranslate"
                  >
                    <ion-icon name="play-outline"></ion-icon>
                  </ion-button>
                  <ion-button
                    fill="clear"
                    color="danger"
                    (click)="deactivate(row.id)"
                    [attr.aria-label]="'SMS_CAMPAIGNS.DEACTIVATE' | appTranslate"
                  >
                    <ion-icon name="pause-outline"></ion-icon>
                  </ion-button>
                  <ion-button
                    fill="clear"
                    color="danger"
                    (click)="delete(row.id)"
                    [attr.aria-label]="'SMS_CAMPAIGNS.DELETE' | appTranslate"
                  >
                    <ion-icon name="trash-outline"></ion-icon>
                  </ion-button>
                </td>
              </ng-container>

              <tr cdk-header-row *cdkHeaderRowDef="displayedColumns"></tr>
              <tr cdk-row *cdkRowDef="let row; columns: displayedColumns"></tr>

              @if (campaigns().length === 0) {
                <tr class="cdk-row">
                  <td class="cdk-cell no-data-cell" [attr.colspan]="displayedColumns.length">
                    {{ 'SMS_CAMPAIGNS.NO_DATA' | appTranslate }}
                  </td>
                </tr>
              }
            </table>
          }
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .container {
        padding: 16px;
      }
      mat-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .header-actions {
        margin-left: auto;
      }
      .spinner-container {
        display: flex;
        justify-content: center;
        padding: 24px;
      }
      .full-width {
        width: 100%;
      }
      .no-data-cell {
        text-align: center;
        padding: 16px;
      }
    `,
  ],
})
export class SmsCampaignsListComponent implements OnInit {
  private readonly api = inject(DefaultService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);

  readonly campaigns = signal<SmsCampaign[]>([]);
  readonly loading = signal(false);

  displayedColumns = ['id', 'campaignName', 'campaignType', 'status', 'actions'];

  ngOnInit(): void {
    this.loadCampaigns();
  }

  private loadCampaigns(): void {
    this.loading.set(true);
    this.api.getSmscampaigns().subscribe({
      next: (res) => {
        const items = Array.isArray(res)
          ? res
          : ((res as Record<string, unknown>)['pageItems'] ?? []);
        this.campaigns.set(items as SmsCampaign[]);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.showError();
      },
    });
  }

  edit(id: number): void {
    this.router.navigate(['/campaigns/sms', id, 'edit']);
  }

  activate(id: number): void {
    this.api.postSmscampaignsCampaignId(id, 'activate').subscribe({
      next: () => {
        this.showSuccess();
        this.loadCampaigns();
      },
      error: () => this.showError(),
    });
  }

  deactivate(id: number): void {
    this.api.postSmscampaignsCampaignId(id, 'deactivate').subscribe({
      next: () => {
        this.showSuccess();
        this.loadCampaigns();
      },
      error: () => this.showError(),
    });
  }

  delete(id: number): void {
    this.api.deleteSmscampaignsCampaignId(id).subscribe({
      next: () => {
        this.showSuccess();
        this.loadCampaigns();
      },
      error: () => this.showError(),
    });
  }

  private showSuccess(): void {
    this.notifications.success(this.i18n.translate('SMS_CAMPAIGNS.SUCCESS'));
  }

  private showError(): void {
    this.notifications.error(this.i18n.translate('COMMON.ERROR'));
  }
}
