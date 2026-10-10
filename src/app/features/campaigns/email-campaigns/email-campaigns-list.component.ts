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

import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
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

interface EmailCampaign {
  id: number;
  campaignName?: string;
  campaignType?: string;
  status?: { value?: string } | string;
}

@Component({
  selector: 'app-email-campaigns-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    CdkTableModule,
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
          <ion-card-title>{{ 'EMAIL_CAMPAIGNS.TITLE' | appTranslate }}</ion-card-title>
          <div class="actions-header">
            <ion-button color="primary" (click)="navigateToCreate()">
              <ion-icon name="add-outline"></ion-icon>
              {{ 'EMAIL_CAMPAIGNS.CREATE' | appTranslate }}
            </ion-button>
          </div>
        </ion-card-header>

        <ion-card-content>
          @if (isLoading()) {
            <div class="spinner-container">
              <ion-spinner name="crescent"></ion-spinner>
            </div>
          } @else {
            <table cdk-table [dataSource]="campaigns()">
              <ng-container cdkColumnDef="id">
                <th cdk-header-cell *cdkHeaderCellDef>{{ 'EMAIL_CAMPAIGNS.ID' | appTranslate }}</th>
                <td cdk-cell *cdkCellDef="let campaign">{{ campaign.id }}</td>
              </ng-container>

              <ng-container cdkColumnDef="campaignName">
                <th cdk-header-cell *cdkHeaderCellDef>
                  {{ 'EMAIL_CAMPAIGNS.CAMPAIGN_NAME' | appTranslate }}
                </th>
                <td cdk-cell *cdkCellDef="let campaign">{{ campaign.campaignName }}</td>
              </ng-container>

              <ng-container cdkColumnDef="campaignType">
                <th cdk-header-cell *cdkHeaderCellDef>
                  {{ 'EMAIL_CAMPAIGNS.CAMPAIGN_TYPE' | appTranslate }}
                </th>
                <td cdk-cell *cdkCellDef="let campaign">{{ campaign.campaignType }}</td>
              </ng-container>

              <ng-container cdkColumnDef="status">
                <th cdk-header-cell *cdkHeaderCellDef>
                  {{ 'EMAIL_CAMPAIGNS.STATUS' | appTranslate }}
                </th>
                <td cdk-cell *cdkCellDef="let campaign">
                  {{ campaign.status?.value ?? campaign.status }}
                </td>
              </ng-container>

              <ng-container cdkColumnDef="actions">
                <th cdk-header-cell *cdkHeaderCellDef>
                  {{ 'EMAIL_CAMPAIGNS.ACTIONS' | appTranslate }}
                </th>
                <td cdk-cell *cdkCellDef="let campaign">
                  <ion-button
                    fill="clear"
                    color="primary"
                    [title]="'EMAIL_CAMPAIGNS.EDIT' | appTranslate"
                    (click)="navigateToEdit(campaign.id)"
                    [attr.aria-label]="'EMAIL_CAMPAIGNS.EDIT' | appTranslate"
                  >
                    <ion-icon name="create-outline"></ion-icon>
                  </ion-button>
                  <ion-button
                    fill="clear"
                    color="secondary"
                    [title]="'EMAIL_CAMPAIGNS.ACTIVATE' | appTranslate"
                    (click)="activate(campaign.id)"
                    [attr.aria-label]="'EMAIL_CAMPAIGNS.ACTIVATE' | appTranslate"
                  >
                    <ion-icon name="play-outline"></ion-icon>
                  </ion-button>
                  <ion-button
                    fill="clear"
                    color="danger"
                    [title]="'EMAIL_CAMPAIGNS.DEACTIVATE' | appTranslate"
                    (click)="deactivate(campaign.id)"
                    [attr.aria-label]="'EMAIL_CAMPAIGNS.DEACTIVATE' | appTranslate"
                  >
                    <ion-icon name="pause-outline"></ion-icon>
                  </ion-button>
                  <ion-button
                    fill="clear"
                    color="danger"
                    [title]="'EMAIL_CAMPAIGNS.DELETE' | appTranslate"
                    (click)="delete(campaign.id)"
                    [attr.aria-label]="'EMAIL_CAMPAIGNS.DELETE' | appTranslate"
                  >
                    <ion-icon name="trash-outline"></ion-icon>
                  </ion-button>
                </td>
              </ng-container>

              <tr cdk-header-row *cdkHeaderRowDef="displayedColumns"></tr>
              <tr cdk-row *cdkRowDef="let row; columns: displayedColumns"></tr>

              <tr *cdkNoDataRow>
                <td class="no-data-cell" [attr.colspan]="displayedColumns.length">
                  {{ 'EMAIL_CAMPAIGNS.NO_DATA' | appTranslate }}
                </td>
              </tr>
            </table>
          }
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .container {
        padding: 1rem;
      }
      mat-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
      }
      .actions-header {
        display: flex;
        gap: 0.5rem;
      }
      .spinner-container {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 2rem;
      }
      table {
        width: 100%;
      }
      .no-data-cell {
        text-align: center;
        padding: 1rem;
      }
    `,
  ],
})
export class EmailCampaignsListComponent implements OnInit {
  private readonly api = inject(DefaultService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);

  readonly campaigns = signal<EmailCampaign[]>([]);
  readonly isLoading = signal(false);

  displayedColumns: string[] = ['id', 'campaignName', 'campaignType', 'status', 'actions'];

  ngOnInit(): void {
    this.loadCampaigns();
  }

  private loadCampaigns(): void {
    this.isLoading.set(true);
    this.api.getEmailCampaign().subscribe({
      next: (raw: string) => {
        try {
          const parsed = JSON.parse(raw);
          this.campaigns.set(Array.isArray(parsed) ? parsed : [parsed]);
        } catch {
          this.campaigns.set([]);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.campaigns.set([]);
        this.isLoading.set(false);
        this.showError('EMAIL_CAMPAIGNS.LOAD_ERROR');
      },
    });
  }

  navigateToCreate(): void {
    this.router.navigate(['/campaigns/email/create']);
  }

  navigateToEdit(id: number): void {
    this.router.navigate(['/campaigns/email', id, 'edit']);
  }

  activate(id: number): void {
    this.api.postEmailCampaignResourceId(id, 'activate', undefined).subscribe({
      next: () => {
        this.showSuccess('EMAIL_CAMPAIGNS.ACTIVATED');
        this.loadCampaigns();
      },
      error: () => this.showError('EMAIL_CAMPAIGNS.ACTIVATE_ERROR'),
    });
  }

  deactivate(id: number): void {
    this.api.postEmailCampaignResourceId(id, 'deactivate', undefined).subscribe({
      next: () => {
        this.showSuccess('EMAIL_CAMPAIGNS.DEACTIVATED');
        this.loadCampaigns();
      },
      error: () => this.showError('EMAIL_CAMPAIGNS.DEACTIVATE_ERROR'),
    });
  }

  delete(id: number): void {
    this.api.deleteEmailCampaignResourceId(id).subscribe({
      next: () => {
        this.showSuccess('EMAIL_CAMPAIGNS.DELETED');
        this.loadCampaigns();
      },
      error: () => this.showError('EMAIL_CAMPAIGNS.DELETE_ERROR'),
    });
  }

  private showSuccess(key: string): void {
    this.i18n.translateAsync(key).subscribe((msg: string) => {
      this.notifications.success(msg);
    });
  }

  private showError(key: string): void {
    this.i18n.translateAsync(key).subscribe((msg: string) => {
      this.notifications.error(msg);
    });
  }
}
