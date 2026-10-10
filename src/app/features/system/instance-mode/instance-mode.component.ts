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
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../core/adapters';
import { InstanceModeService, ChangeInstanceModeRequest } from '../../../api';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonSpinner,
  IonToggle,
} from '@ionic/angular/standalone';

/**
 * Instance mode: write-only screen exposing the read / write / batch toggles and
 * persisting them via the instance-mode endpoint.
 */
@Component({
  selector: 'app-instance-mode',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonButton,
    IonSpinner,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonToggle,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'INSTANCE_MODE.TITLE' | appTranslate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <div class="toggle-list">
            <ion-toggle [(ngModel)]="mode.readEnabled">
              {{ 'INSTANCE_MODE.READ_ENABLED' | appTranslate }}
            </ion-toggle>
            <ion-toggle [(ngModel)]="mode.writeEnabled">
              {{ 'INSTANCE_MODE.WRITE_ENABLED' | appTranslate }}
            </ion-toggle>
            <ion-toggle [(ngModel)]="mode.batchWorkerEnabled">
              {{ 'INSTANCE_MODE.BATCH_WORKER_ENABLED' | appTranslate }}
            </ion-toggle>
          </div>

          <div class="form-actions">
            <ion-button color="primary" type="button" [disabled]="isSaving()" (click)="onSave()">
              @if (isSaving()) {
                <ion-spinner name="crescent"></ion-spinner>
                {{ 'COMMON.SAVING' | appTranslate }}
              } @else {
                {{ 'COMMON.SAVE' | appTranslate }}
              }
            </ion-button>
          </div>
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .form-container {
        padding: 24px;
        max-width: 600px;
        margin: 0 auto;
      }
      .toggle-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    `,
  ],
})
export class InstanceModeComponent {
  private readonly service = inject(InstanceModeService);

  mode: ChangeInstanceModeRequest = {
    readEnabled: true,
    writeEnabled: true,
    batchWorkerEnabled: true,
    batchManagerEnabled: true,
  };
  readonly isSaving = signal(false);

  onSave(): void {
    this.isSaving.set(true);
    this.service.putInstanceMode(this.mode).subscribe({
      next: () => this.isSaving.set(false),
      error: () => this.isSaving.set(false),
    });
  }
}
