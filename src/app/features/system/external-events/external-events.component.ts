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
import { ExternalEventConfigurationService } from '../../../api';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonSpinner,
  IonToggle,
} from '@ionic/angular/standalone';

interface EventToggle {
  type: string;
  enabled: boolean;
}

/**
 * External event configuration: list configurable events with enabled toggles
 * and persist them via the external-events configuration endpoint.
 */
@Component({
  selector: 'app-external-events',
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
          <ion-card-title>{{ 'nav.externalEvents' | appTranslate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <div class="event-list">
            @for (event of events(); track event.type) {
              <ion-toggle [(ngModel)]="event.enabled">{{ event.type }}</ion-toggle>
            }
          </div>

          <div class="form-actions">
            <ion-button
              color="primary"
              type="button"
              [disabled]="!events().length || isSaving()"
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
      .event-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
    `,
  ],
})
export class ExternalEventsComponent implements OnInit {
  private readonly service = inject(ExternalEventConfigurationService);

  readonly events = signal<EventToggle[]>([]);
  readonly isSaving = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.service.getExternaleventsConfiguration().subscribe((data) => {
      this.events.set(
        (data.externalEventConfiguration ?? []).map((item) => ({
          type: item.type ?? '',
          enabled: item.enabled ?? false,
        })),
      );
    });
  }

  onSave(): void {
    this.isSaving.set(true);
    const externalEventConfigurations: Record<string, boolean> = {};
    for (const event of this.events()) {
      externalEventConfigurations[event.type] = event.enabled;
    }
    this.service.putExternaleventsConfiguration({ externalEventConfigurations }).subscribe({
      next: () => this.isSaving.set(false),
      error: () => this.isSaving.set(false),
    });
  }
}
