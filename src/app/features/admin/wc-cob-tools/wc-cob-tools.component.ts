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
import { Component, inject } from '@angular/core';
import { I18N, TranslatePipe } from '../../../core/adapters';
import { WorkingCapitalLoanInternalCOBApiService } from '../../../api';
import { NotificationService } from '../../../core/services/notification.service';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-wc-cob-tools',
  standalone: true,
  imports: [TranslatePipe, IonButton, IonCardContent, IonCardHeader, IonCardTitle, IonCard],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ 'WC_COB_TOOLS.TITLE' | appTranslate }}</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <div class="actions">
          <ion-button color="primary" (click)="setLastCobRun()">
            {{ 'WC_COB_TOOLS.SET_LAST_RUN' | appTranslate }}
          </ion-button>
          <ion-button color="danger" (click)="deleteLastCobRun()">
            {{ 'WC_COB_TOOLS.DELETE_LAST_RUN' | appTranslate }}
          </ion-button>
        </div>
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      .actions {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        margin-top: 8px;
      }
    `,
  ],
})
export class WcCobToolsComponent {
  private wcCobService = inject(WorkingCapitalLoanInternalCOBApiService);
  private notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);

  setLastCobRun(): void {
    this.wcCobService.postInternalWorkingCapitalLoansInternalLastCobRun().subscribe({
      next: () => this.showSuccess(),
      error: () => this.showError(),
    });
  }

  deleteLastCobRun(): void {
    this.wcCobService.deleteInternalWorkingCapitalLoansInternalLastCobRun().subscribe({
      next: () => this.showSuccess(),
      error: () => this.showError(),
    });
  }

  private showSuccess(): void {
    this.notifications.success(this.i18n.translate('WC_COB_TOOLS.SUCCESS'));
  }

  private showError(): void {
    this.notifications.error(this.i18n.translate('WC_COB_TOOLS.ERROR'));
  }
}
