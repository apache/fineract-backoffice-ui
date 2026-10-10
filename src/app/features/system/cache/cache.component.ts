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
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../core/adapters';
import { CacheService, CacheData } from '../../../api';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonRadio,
  IonRadioGroup,
  IonSpinner,
} from '@ionic/angular/standalone';

/**
 * Cache configuration: list available cache types and switch the enabled one
 * via the caches endpoint.
 */
@Component({
  selector: 'app-cache',
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
    IonRadio,
    IonRadioGroup,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'CACHE.TITLE' | appTranslate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <ion-radio-group
            class="cache-group"
            [ngModel]="selectedCacheType()"
            (ngModelChange)="selectedCacheType.set($event)"
          >
            @for (cache of caches(); track cache.cacheType?.id) {
              <ion-radio [value]="cache.cacheType?.id">
                {{ cache.cacheType?.value }}
              </ion-radio>
            }
          </ion-radio-group>

          <div class="form-actions">
            <ion-button
              color="primary"
              type="button"
              [disabled]="selectedCacheType() === null || isSaving()"
              (click)="onSave()"
            >
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
      .cache-group {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
    `,
  ],
})
export class CacheComponent implements OnInit {
  private readonly service = inject(CacheService);

  readonly caches = signal<CacheData[]>([]);
  readonly selectedCacheType = signal<number | null>(null);
  readonly isSaving = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.service.getCaches().subscribe((data) => {
      this.caches.set(data ?? []);
      const enabled = this.caches().find((c) => c.enabled);
      this.selectedCacheType.set(enabled?.cacheType?.id ?? null);
    });
  }

  onSave(): void {
    const cacheType = this.selectedCacheType();
    if (cacheType === null) return;
    this.isSaving.set(true);
    this.service.putCaches({ cacheType }).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.load();
      },
      error: () => this.isSaving.set(false),
    });
  }
}
