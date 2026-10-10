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
import { JsonPipe } from '@angular/common';
import { TranslatePipe } from '../../core/adapters';
import { InterOperationService } from '../../api';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonSpinner,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-interop-health',
  standalone: true,
  imports: [
    JsonPipe,
    TranslatePipe,
    IonButton,
    IonSpinner,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ 'INTEROP.HEALTH_TITLE' | appTranslate }}</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <ion-button color="primary" (click)="checkHealth()" [disabled]="isLoading()">
          {{ 'INTEROP.CHECK_HEALTH' | appTranslate }}
        </ion-button>

        @if (isLoading()) {
          <ion-spinner name="crescent"></ion-spinner>
        }

        @if (health()) {
          <h3>{{ 'INTEROP.HEALTH_STATUS' | appTranslate }}</h3>
          <pre>{{ health() | json }}</pre>
        }
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      button {
        margin-bottom: 16px;
      }
      pre {
        background: var(--surface-sunken);
        color: var(--text-color);
        padding: 12px;
        border-radius: 4px;
        overflow: auto;
      }
    `,
  ],
})
export class InteropHealthComponent {
  private interopService = inject(InterOperationService);

  readonly health = signal<unknown>(null);
  readonly isLoading = signal(false);

  checkHealth(): void {
    this.isLoading.set(true);
    this.health.set(null);
    this.interopService.getInteroperationHealth().subscribe({
      next: (data) => {
        this.health.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }
}
