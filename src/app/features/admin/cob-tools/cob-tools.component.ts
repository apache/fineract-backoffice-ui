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
import { Component, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18N, TranslatePipe } from '../../../core/adapters';
import { InternalCOBService, COBPartition } from '../../../api';
import { NotificationService } from '../../../core/services/notification.service';
import { CdkTableModule } from '@angular/cdk/table';
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
  selector: 'app-cob-tools',
  standalone: true,
  imports: [
    FormsModule,
    JsonPipe,
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
        <ion-card-title>{{ 'COB_TOOLS.TITLE' | appTranslate }}</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <!-- View COB Partitions -->
        <section>
          <h3>{{ 'COB_TOOLS.PARTITIONS' | appTranslate }}</h3>
          <div class="row-actions">
            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'COB_TOOLS.PARTITION_SIZE' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'COB_TOOLS.PARTITION_SIZE' | appTranslate"
                type="number"
                [(ngModel)]="partitionSize"
              ></ion-input>
            </ion-item>
            <ion-button color="primary" (click)="loadPartitions()" [disabled]="isLoading()">
              {{ 'COB_TOOLS.LOAD_PARTITIONS' | appTranslate }}
            </ion-button>
          </div>

          @if (isLoading()) {
            <ion-spinner name="crescent"></ion-spinner>
          }

          @if (partitions().length > 0) {
            <table cdk-table [dataSource]="partitions()" class="full-width">
              <ng-container cdkColumnDef="data">
                <th cdk-header-cell *cdkHeaderCellDef>Data</th>
                <td cdk-cell *cdkCellDef="let row">{{ row | json }}</td>
              </ng-container>
              <tr cdk-header-row *cdkHeaderRowDef="['data']"></tr>
              <tr cdk-row *cdkRowDef="let row; columns: ['data']"></tr>
            </table>
          }
        </section>

        <hr class="divider" />

        <!-- Fast-Forward COB Date -->
        <section>
          <h3>{{ 'COB_TOOLS.FAST_FORWARD' | appTranslate }}</h3>
          <div class="row-actions">
            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'COB_TOOLS.FAST_FORWARD_LOAN_ID' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'COB_TOOLS.FAST_FORWARD_LOAN_ID' | appTranslate"
                type="number"
                [(ngModel)]="fastForwardLoanId"
              ></ion-input>
            </ion-item>
            <ion-button color="secondary" (click)="fastForward()" [disabled]="isLoading()">
              {{ 'COB_TOOLS.FAST_FORWARD' | appTranslate }}
            </ion-button>
          </div>
        </section>

        <hr class="divider" />

        <!-- Reprocess Loan COB -->
        <section>
          <h3>{{ 'COB_TOOLS.REPROCESS' | appTranslate }}</h3>
          <div class="row-actions">
            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'COB_TOOLS.REPROCESS_LOAN_ID' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'COB_TOOLS.REPROCESS_LOAN_ID' | appTranslate"
                type="number"
                [(ngModel)]="reprocessLoanId"
              ></ion-input>
            </ion-item>
            <ion-button color="danger" (click)="reprocess()" [disabled]="isLoading()">
              {{ 'COB_TOOLS.REPROCESS' | appTranslate }}
            </ion-button>
          </div>
        </section>
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      section {
        margin: 16px 0;
      }
      .row-actions {
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
      }
      hr.divider {
        margin: 16px 0;
      }
      .full-width {
        width: 100%;
      }
    `,
  ],
})
export class CobToolsComponent {
  private cobService = inject(InternalCOBService);
  private notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);

  partitionSize = 10;
  readonly partitions = signal<COBPartition[]>([]);
  fastForwardLoanId = 0;
  reprocessLoanId = 0;
  readonly isLoading = signal(false);

  loadPartitions(): void {
    this.isLoading.set(true);
    this.cobService.getInternalCobPartitionsPartitionSize(this.partitionSize).subscribe({
      next: (data: COBPartition[]) => {
        this.partitions.set(data ?? []);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.showError();
      },
    });
  }

  fastForward(): void {
    this.isLoading.set(true);
    this.cobService
      .postInternalCobFastForwardCobDateOfLoanLoanId(this.fastForwardLoanId)
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.showSuccess();
        },
        error: () => {
          this.isLoading.set(false);
          this.showError();
        },
      });
  }

  reprocess(): void {
    this.isLoading.set(true);
    this.cobService.postInternalCobLoanReprocessLoanId(this.reprocessLoanId).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.showSuccess();
      },
      error: () => {
        this.isLoading.set(false);
        this.showError();
      },
    });
  }

  private showSuccess(): void {
    this.notifications.success(this.i18n.translate('COB_TOOLS.SUCCESS'));
  }

  private showError(): void {
    this.notifications.error(this.i18n.translate('COB_TOOLS.ERROR'));
  }
}
