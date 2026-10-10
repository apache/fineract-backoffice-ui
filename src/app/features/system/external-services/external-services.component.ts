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
import { ExternalServicesService, PutExternalServiceRequest } from '../../../api';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';

interface ServiceProperty {
  name: string;
  value: string;
}

/**
 * External services configuration: pick a service (S3 / SMTP / NOTIFICATION),
 * load its name/value properties, edit and save them.
 */
@Component({
  selector: 'app-external-services',
  standalone: true,
  imports: [
    FormsModule,
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
    IonSelectOption,
    IonSelect,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'EXTERNAL_SERVICES.TITLE' | appTranslate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <ion-item fill="outline">
            <ion-label position="stacked">{{
              'EXTERNAL_SERVICES.SERVICE' | appTranslate
            }}</ion-label>
            <ion-select
              [attr.aria-label]="'EXTERNAL_SERVICES.SERVICE' | appTranslate"
              interface="popover"
              [(ngModel)]="selectedService"
              (ionChange)="load()"
            >
              @for (name of serviceNames; track name) {
                <ion-select-option [value]="name">{{ name }}</ion-select-option>
              }
            </ion-select>
          </ion-item>

          @for (prop of properties(); track prop.name) {
            <ion-item fill="outline">
              <ion-label position="stacked">{{ prop.name }}</ion-label>
              <ion-input
                [attr.aria-label]="prop.name"
                [name]="prop.name"
                [(ngModel)]="prop.value"
              ></ion-input>
            </ion-item>
          }

          <div class="form-actions">
            <ion-button
              color="primary"
              type="button"
              [disabled]="!properties().length || isSaving()"
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
    `,
  ],
})
export class ExternalServicesComponent implements OnInit {
  private readonly service = inject(ExternalServicesService);

  readonly serviceNames = ['S3', 'SMTP', 'NOTIFICATION'];
  selectedService = '';
  readonly properties = signal<ServiceProperty[]>([]);
  readonly isSaving = signal(false);

  ngOnInit(): void {
    this.selectedService = this.serviceNames[0];
    this.load();
  }

  load(): void {
    if (!this.selectedService) return;
    this.service.getExternalserviceServicename(this.selectedService).subscribe((data) => {
      const list = (data as unknown as ServiceProperty[]) ?? [];
      this.properties.set(list.map((p) => ({ name: p.name ?? '', value: p.value ?? '' })));
    });
  }

  onSave(): void {
    if (!this.selectedService) return;
    this.isSaving.set(true);
    const request: Record<string, string> = {};
    for (const prop of this.properties()) {
      request[prop.name] = prop.value;
    }
    this.service
      .putExternalserviceServicename(
        this.selectedService,
        request as unknown as PutExternalServiceRequest,
      )
      .subscribe({
        next: () => this.isSaving.set(false),
        error: () => this.isSaving.set(false),
      });
  }
}
