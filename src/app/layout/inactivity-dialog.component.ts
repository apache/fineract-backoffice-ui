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

import { IonButton, ModalController } from '@ionic/angular/standalone';
import { TranslatePipe } from '../core/adapters';

/**
 * Modal dialog that warns the user about an impending session timeout.
 *
 * Provides options to either extend the current session or logout immediately.
 */
@Component({
  selector: 'app-inactivity-dialog',
  standalone: true,
  imports: [IonButton, TranslatePipe],
  template: `
    <div class="dialog">
      <h2 class="dialog-title">{{ 'idle.warning.title' | appTranslate }}</h2>
      <p class="dialog-message">{{ 'idle.warning.message' | appTranslate }}</p>
      <div class="dialog-actions">
        <ion-button data-testid="idle-logout" fill="clear" color="medium" (click)="onLogout()">
          {{ 'app.logout' | appTranslate }}
        </ion-button>
        <ion-button data-testid="idle-extend" color="primary" (click)="onExtend()">
          {{ 'idle.warning.extend' | appTranslate }}
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
        min-width: 300px;
      }
      .dialog-title {
        margin: 0 0 12px;
        font-size: 1.25rem;
      }
      .dialog-message {
        margin: 0;
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
export class InactivityDialogComponent {
  private readonly modalController = inject(ModalController);

  /**
   * Closes the dialog and signals that the session should be extended.
   */
  onExtend(): void {
    this.modalController.dismiss(true);
  }

  /**
   * Closes the dialog and signals that the user wishes to logout.
   */
  onLogout(): void {
    this.modalController.dismiss(false);
  }
}
