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

import { inject, input, Component } from '@angular/core';
import { TranslatePipe } from '../../../core/adapters';
import { IonButton, IonIcon, ModalController } from '@ionic/angular/standalone';

export interface ConfirmDialogData {
  title: string;
  message: string;
  details?: { label: string; value: string }[];
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

/**
 * Confirmation modal. Prefer opening it through `DialogService.confirm()` rather than
 * instantiating it directly.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [TranslatePipe, IonButton, IonIcon],
  template: `
    <div class="dialog">
      <h2 class="dialog-title">
        @if (data().destructive) {
          <ion-icon name="warning-outline" color="danger"></ion-icon>
        }
        {{ data().title }}
      </h2>

      <div class="dialog-content">
        <p>{{ data().message }}</p>
        @if (data().details?.length) {
          <table class="details-table">
            @for (item of data().details; track item.label) {
              <tr>
                <td class="label">{{ item.label }}</td>
                <td class="value">{{ item.value }}</td>
              </tr>
            }
          </table>
        }
      </div>

      <div class="dialog-actions">
        <ion-button
          data-testid="confirm-dialog-cancel"
          fill="clear"
          color="medium"
          (click)="dismiss(false)"
        >
          {{ data().cancelText || ('COMMON.CANCEL' | appTranslate) }}
        </ion-button>
        <ion-button
          data-testid="confirm-dialog-confirm"
          [color]="data().destructive ? 'danger' : 'primary'"
          (click)="dismiss(true)"
        >
          {{ data().confirmText || ('COMMON.CONFIRM' | appTranslate) }}
        </ion-button>
      </div>
    </div>
  `,
  styles: [
    `
      .dialog {
        padding: 20px 24px 12px;
        background: var(--card-bg);
        color: var(--text-color);
      }
      .dialog-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 12px;
        font-size: 1.25rem;
      }
      .dialog-content {
        min-width: 300px;
      }
      .details-table {
        margin-top: 12px;
        border-collapse: collapse;
        width: 100%;
      }
      .details-table td {
        padding: 4px 8px;
        border-bottom: 1px solid var(--border-color, #e0e0e0);
      }
      .details-table .label {
        color: var(--text-muted, #7f8c8d);
        font-weight: 500;
      }
      .details-table .value {
        text-align: right;
        font-weight: 600;
      }
      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 16px;
      }
    `,
  ],
})
export class ConfirmDialogComponent {
  private readonly modalController = inject(ModalController);

  readonly data = input.required<ConfirmDialogData>();

  dismiss(confirmed: boolean): void {
    this.modalController.dismiss(confirmed);
  }
}
